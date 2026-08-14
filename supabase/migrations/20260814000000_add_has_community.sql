-- Migration: Add has_community column to profiles
-- Date: 2026-08-14
--
-- Hybrid Navigation Restructure: The app checks this boolean on login
-- to determine which navigation tier to render:
--   false → Free Tier (3-tab nav: Deliveries, Porch Partner, Account)
--   true  → Community Tier (4-tab nav: Home, Payments, Requests, More)
--
-- Set to TRUE when a user successfully accepts an HOA invitation.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS has_community BOOLEAN DEFAULT FALSE;

-- Backfill: set has_community = true for users who already have an
-- active org membership.
UPDATE profiles
SET has_community = true
WHERE id IN (
  SELECT DISTINCT user_id
  FROM org_memberships
  WHERE status = 'active'
);

-- Add an index for quick lookups during auth.
CREATE INDEX IF NOT EXISTS idx_profiles_has_community
ON profiles (has_community)
WHERE has_community = true;
