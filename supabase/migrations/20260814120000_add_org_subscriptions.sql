-- ============================================================
-- PORCHIVO: Org Subscription Columns
-- Adds B2B subscription tracking to the organizations table.
-- Safe to run multiple times — all statements use IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'starter'
    CHECK (plan_tier IN ('starter', 'community', 'professional', 'enterprise')),
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'pending', 'active', 'past_due', 'canceled', 'trialing')),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS max_units int,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Index for lookup by stripe customer/subscription
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
  ON public.organizations(subscription_status);

-- RLS: org admin can still update their org (existing policy covers new columns).
-- No additional policy needed — the existing "org_admin_update" policy
-- already allows admin_user_id = auth.uid() to UPDATE any column.
