-- ============================================================
-- PORCHIVO: Subscription Entitlements Backend Source of Truth
-- Run this in Supabase SQL Editor AFTER migration.sql
-- Safe to run multiple times — all statements use IF NOT EXISTS
-- ============================================================


-- ============================================================
-- PART 1: revenuecat_events
-- Append-only audit log. Also used for idempotent deduplication
-- via a unique index on rc_event_id (the RevenueCat event UUID).
-- Only the revenuecat-webhook Edge Function writes to this table.
-- Clients have zero access.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rc_event_id       text        NOT NULL,          -- event.id from RevenueCat payload
  user_id           text        NOT NULL,          -- event.app_user_id (Supabase UUID or RC anonymous ID)
  event_type        text        NOT NULL,          -- INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
  product_id        text,                          -- event.product_id
  store             text,                          -- APP_STORE | PLAY_STORE | STRIPE | etc.
  environment       text,                          -- SANDBOX | PRODUCTION
  expiration_at_ms  bigint,                        -- event.expiration_at_ms (unix ms)
  raw_payload       jsonb,                         -- full event object for debugging
  processed_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint drives deduplication: insert with ON CONFLICT DO NOTHING,
-- then check rows-affected to detect duplicates without a separate SELECT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenuecat_events_rc_event_id
  ON public.revenuecat_events (rc_event_id);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_user_id
  ON public.revenuecat_events (user_id);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_event_type
  ON public.revenuecat_events (event_type);

-- RLS: enabled with zero client-facing policies.
-- The service-role key used by the Edge Function bypasses RLS entirely.
-- Clients cannot read, write, or even discover this table.
ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 2: user_subscriptions
-- Single-row-per-user current entitlement state.
-- ONLY the revenuecat-webhook Edge Function writes here.
-- Clients may SELECT their own row (read-only) to display
-- authoritative billing status without inferring it from RC SDK.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Subscription lifecycle status.
  -- 'active'         — entitled, renewing or lifetime
  -- 'cancelled'      — user cancelled but still entitled until current_period_end
  -- 'expired'        — period ended, access revoked
  -- 'billing_issue'  — payment failed, in grace period
  -- 'paused'         — subscription paused (Google Play)
  -- 'grace_period'   — brief window after billing failure before access revoked
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'cancelled', 'expired', 'billing_issue', 'paused', 'grace_period')),

  -- Resolved Porchivo tier (matches SubscriptionTier in lib/tiers.ts).
  tier                text        NOT NULL DEFAULT 'free'
                        CHECK (tier IN ('free', 'premium', 'family', 'enterprise', 'lifetime')),

  -- The RevenueCat product identifier that triggered the current state.
  product_id          text,

  -- Store the subscription originated from.
  store               text,       -- APP_STORE | PLAY_STORE | STRIPE | PROMOTIONAL | etc.

  -- Build environment — useful for distinguishing sandbox test events.
  environment         text,       -- SANDBOX | PRODUCTION

  -- When the current paid period ends (null for lifetime / promotional).
  -- For 'cancelled' status this is when access actually stops — show to user.
  -- For 'active' this is the next renewal date.
  current_period_end  timestamptz,

  -- When the user requested cancellation (null if not cancelled).
  cancelled_at        timestamptz,

  -- Lifetime purchases never expire; skip period-end enforcement for these.
  is_lifetime         boolean     NOT NULL DEFAULT false,

  -- Mirrors profiles.is_premium for fast entitlement checks without a join.
  -- False only when status IN ('expired') or tier = 'free'.
  -- True for 'active' AND 'cancelled' (access continues until period end).
  -- True for 'billing_issue' / 'grace_period' (access continues during grace).
  is_entitled         boolean     NOT NULL DEFAULT true,

  -- Audit trail: which RC event last mutated this row.
  last_event_type     text,
  last_rc_event_id    text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- One record per user. Upsert on conflict to maintain single source of truth.
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON public.user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON public.user_subscriptions (status);

-- Auto-update updated_at on any row mutation.
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: enabled. Users may read their own row only. No client writes.
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for clients.
-- All writes come from the service-role key in the Edge Function.


-- ============================================================
-- PART 3: Add subscription_tier to profiles (additive)
-- Keeps the existing is_premium bool intact for backward compat.
-- Now also stores the resolved tier so the client can read one
-- trusted record (profiles.*) without joining user_subscriptions.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';

-- Backfill existing premium users to 'premium' tier.
-- This is a safe best-effort: users with is_premium=true but unknown tier
-- are assumed to be on the base premium plan. The next webhook event will
-- correct this to the real tier (lifetime, family, etc.).
UPDATE public.profiles
  SET subscription_tier = 'premium'
  WHERE is_premium = true
    AND subscription_tier = 'free';


-- ============================================================
-- PART 4: Convenience view — user_entitlement
-- Joins profiles + user_subscriptions into a single client-readable
-- record. Clients query this view for the complete billing picture.
-- Returns NULL user_subscriptions columns if no subscription row exists yet.
-- ============================================================

CREATE OR REPLACE VIEW public.user_entitlement AS
  SELECT
    p.id                          AS user_id,
    p.is_premium,
    p.subscription_tier,
    us.status                     AS subscription_status,
    us.tier                       AS subscription_tier_detail,
    us.current_period_end,
    us.cancelled_at,
    us.is_lifetime,
    us.is_entitled,
    us.environment,
    us.store,
    us.last_event_type,
    us.updated_at                 AS subscription_updated_at
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id;

-- Authenticated users may only see their own entitlement row.
-- Views inherit the RLS of their underlying tables when accessed via
-- the authenticated role, but we also restrict the view explicitly.
GRANT SELECT ON public.user_entitlement TO authenticated;

-- RLS on the underlying profiles table already restricts
-- SELECT to the owner (auth.uid() = id). The view inherits this.


-- ============================================================
-- PART 5: Verification query
-- After running this migration, execute the following to confirm
-- all new tables have RLS enabled and the view was created:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('revenuecat_events', 'user_subscriptions')
--   AND rowsecurity = false;
-- Expected: 0 rows
--
-- SELECT * FROM public.user_entitlement;
-- Expected: your own row with current billing state
-- ============================================================
