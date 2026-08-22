-- ============================================================
-- PORCHIVO: 3-Stage Billing Grace Period (property subscriptions)
-- ============================================================
-- Billing is scoped to the ORGANIZATION (the property), not the
-- individual. A missed payment must NOT immediately paywall every
-- resident and staff member on the property.
--
-- Stage timeline (derived from payment_failed_at, never stored):
--   Day 0-14   past_due       "silent grace" — only the manager sees
--                              a billing banner. Residents/staff: zero change.
--   Day 14-30  grace_readonly residents read-only (settings writes blocked,
--                              package views stay live). Staff intake unchanged.
--                              Manager admin tools read-only except billing.
--   Day 30+    restricted     full restriction (BILL-07 paywall behavior),
--                              including staff package intake.
--
-- The stage is COMPUTED from payment_failed_at — there is no separate
-- grace-period table or workflow. `sync_org_billing_stage()` persists the
-- derived status lazily (called opportunistically by clients) so other
-- consumers of subscription_status see the right value without a scheduler.
--
-- Resume behavior: the Stripe webhook is the source of truth. The instant
-- payment succeeds, subscription_status -> 'active' and payment_failed_at
-- is cleared. A later failure starts the clock from zero.
--
-- Safe to run multiple times — idempotent statements.
-- ============================================================

-- ─── 1. Timestamp when the payment first failed ──────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz;

-- Dedupe marker for manager dunning emails (day 0/7/14/21 cadence).
-- Stores the largest cadence marker already sent (NULL = none sent).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dunning_last_marker_sent int;

-- ─── 2. Widen subscription_status to include the grace stages ────────────────
-- The original CHECK (from 20260814120000_add_org_subscriptions.sql) does not
-- allow 'grace_readonly' or 'restricted'. Postgres names inline column CHECKs
-- <table>_<column>_check, so drop that name and recreate.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (subscription_status IN (
    'none', 'pending', 'active', 'past_due', 'grace_readonly', 'restricted', 'canceled', 'trialing'
  ));

-- ─── 3. Lazy stage sync RPC ──────────────────────────────────────────────────
-- Called opportunistically by org members' clients (and safe to call from
-- edge functions). Recomputes subscription_status from payment_failed_at and
-- persists drift, so the stored status reflects the derived stage without
-- requiring pg_cron. SECURITY DEFINER lets non-admin members trigger the sync;
-- the only write is to the caller's own org's billing columns.
CREATE OR REPLACE FUNCTION public.sync_org_billing_stage()
RETURNS TABLE (
  org_id             uuid,
  subscription_status text,
  payment_failed_at  timestamptz,
  grace_stage        text,
  days_since_failure int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     uuid;
  v_status     text;
  v_failed_at  timestamptz;
  v_days       int;
  v_stage      text;
BEGIN
  -- Caller must have an active membership in an org
  SELECT m.org_id, o.subscription_status, o.payment_failed_at
    INTO v_org_id, v_status, v_failed_at
  FROM public.org_memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
  ORDER BY m.joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN; -- no active org → no rows
  END IF;

  v_days  := NULL;
  v_stage := 'ok';

  IF v_failed_at IS NOT NULL
     AND v_status IN ('past_due', 'grace_readonly', 'restricted', 'active') THEN
    -- 'active' with a stale payment_failed_at shouldn't happen (webhook clears
    -- it), but treat the timestamp as authoritative if present.
    v_days := GREATEST(0, EXTRACT(DAY FROM (now() - v_failed_at))::int);
    IF v_days < 14 THEN
      v_stage := 'past_due';
    ELSIF v_days < 30 THEN
      v_stage := 'grace_readonly';
    ELSE
      v_stage := 'restricted';
    END IF;
  END IF;

  -- Persist drift so non-client consumers see the correct stage
  IF v_stage <> 'ok' AND v_status <> v_stage THEN
    UPDATE public.organizations
       SET subscription_status = v_stage,
           updated_at = now()
     WHERE id = v_org_id;
    v_status := v_stage;
  END IF;

  -- Clear the failure clock if payment resumed but the timestamp survived
  IF v_stage = 'ok' AND v_status = 'active' AND v_failed_at IS NOT NULL THEN
    UPDATE public.organizations
       SET payment_failed_at = NULL,
           dunning_last_marker_sent = NULL,
           updated_at = now()
     WHERE id = v_org_id;
    v_failed_at := NULL;
  END IF;

  RETURN QUERY
    SELECT v_org_id, v_status, v_failed_at, v_stage,
           COALESCE(v_days, 0)::int;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_org_billing_stage() TO authenticated;

-- ─── Notes ───────────────────────────────────────────────────────────────────
-- • No new tables: grace state is DERIVED from organizations.payment_failed_at.
-- • stripe-webhook (edge function) writes payment_failed_at:
--     invoice.payment_failed → status='past_due',
--                              payment_failed_at = COALESCE(existing, now())
--                              (fresh lapse after resume resets the clock;
--                               Stripe retries within one cycle must NOT)
--     invoice.paid / checkout.session.completed (org) → status='active',
--                              payment_failed_at = NULL (instant resume)
--     customer.subscription.deleted (org) → status='canceled', clock cleared
-- • RLS: the existing org_admin_update policy continues to govern direct
--   UPDATEs; this RPC performs only stage-derivation writes on the caller's
--   own org.
