-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Security Gateway — Migration
-- Additive; aligns with existing migrations (multi-context, package-ops-board,
-- activity-audit, rate-limit). No existing tables are dropped or re-created.
--
-- Creates:
--   idempotency_keys        — 24h TTL cache for POST mutation replay protection
--   stripe_processed_events — Stripe webhook event-id idempotency ledger
--   security_events         — gateway security log (rate limit breaches,
--                             auth failures, cross-context attempts)
--   cleanup_idempotency_keys() — TTL sweeper (call opportunistically or via cron)
--
-- Alters:
--   package_log_items.status CHECK — adds 'pending' (pre-arrival state used by
--   the gateway status machine; all other API statuses map onto existing values)
--
-- API ↔ DB status mapping (enforced in the api-gateway edge function):
--   pending   ↔ pending
--   arrived   ↔ received
--   held      ↔ ready_for_pickup
--   picked_up ↔ picked_up
--   returned  ↔ returned_to_sender
--   lost      ↔ exception (exception_reason = 'lost')
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Idempotency keys ───────────────────────────────────────────────────────
-- Written ONLY by Edge Functions via service role. Never exposed to clients.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key              UUID        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route            TEXT        NOT NULL,
  response_status  INTEGER     NOT NULL,
  response_body    JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON public.idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user
  ON public.idempotency_keys (user_id, route);

-- Service-role only: enable RLS with NO policies → anon/authenticated are
-- denied everything; service role bypasses RLS.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- TTL sweeper. Safe to call opportunistically from Edge Functions.
CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
END;
$$;

-- ── 2. Stripe processed events (webhook replay/duplicate protection) ──────────
-- Insert-first pattern: the webhook INSERTs the event id BEFORE processing;
-- a unique violation means the event was already handled → return 200.

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id     TEXT        PRIMARY KEY,
  event_type   TEXT        NOT NULL,
  outcome      TEXT        NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_at
  ON public.stripe_processed_events (processed_at);

-- Service-role only.
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- ── 3. Security events (gateway security log) ─────────────────────────────────
-- Complements org_audit_log: org_audit_log is org-scoped (org_id NOT NULL),
-- while security events often occur before any org context is known
-- (unauthenticated probes, malformed tokens, rate-limit breaches).

CREATE TABLE IF NOT EXISTS public.security_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL
                 CHECK (event_type IN (
                   'rate_limit_breach',
                   'auth_failure',
                   'role_claim_mismatch',
                   'cross_context_denied',
                   'invalid_transition',
                   'validation_rejected',
                   'payload_too_large',
                   'webhook_signature_invalid',
                   'webhook_replay_rejected'
                 )),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id       UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  route        TEXT,
  -- Never store raw payloads or PII here — only coarse diagnostic metadata.
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_at
  ON public.security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON public.security_events (user_id, created_at DESC);

-- Service-role writes only; super_admins may read via RPC below.
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Super-admin read access (checked at DB level, not from JWT claims)
DROP POLICY IF EXISTS "super_admin_read_security_events" ON public.security_events;
CREATE POLICY "super_admin_read_security_events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.role    = 'super_admin'
    )
  );

-- ── 4. Widen package_log_items.status to include 'pending' ────────────────────
-- Pre-arrival state used by the gateway package status machine.
-- All existing values remain valid; this is additive.

ALTER TABLE public.package_log_items
  DROP CONSTRAINT IF EXISTS package_log_items_status_check;

ALTER TABLE public.package_log_items
  ADD CONSTRAINT package_log_items_status_check
  CHECK (status IN (
    'pending',
    'received',
    'ready_for_pickup',
    'picked_up',
    'returned_to_sender',
    'exception'
  ));

-- ── 5. Auth context RPC ────────────────────────────────────────────────────────
-- Authoritative role + enrolled contexts, fetched at the DB level for the
-- calling user. The gateway calls this AFTER verifying the JWT signature and
-- compares the result against any role claim embedded in the token.

CREATE OR REPLACE FUNCTION public.get_gateway_auth_context()
RETURNS TABLE (
  org_id       UUID,
  property_id  UUID,
  unit_id      UUID,
  role         TEXT,
  is_primary   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.org_id,
      u.property_id,
      m.unit_id,
      m.role::TEXT,
      (ROW_NUMBER() OVER (ORDER BY m.joined_at ASC NULLS LAST, m.created_at ASC) = 1) AS is_primary
    FROM public.org_memberships m
    LEFT JOIN public.units u ON u.id = m.unit_id
    WHERE m.user_id = auth.uid()
      AND m.status  = 'active';
END;
$$;
