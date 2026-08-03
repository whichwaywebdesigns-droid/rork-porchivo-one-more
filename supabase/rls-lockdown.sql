-- ============================================================
-- PORCHIVO — RLS LOCKDOWN (BETA PRE-FLIGHT)
-- Run in Supabase SQL Editor AFTER partner-verification-migration.sql.
-- Idempotent — safe to re-run.
--
-- Closes the partner_verifications PII/KYC leak: the previous
-- "Authenticated view partner tier" policy exposed EVERY column
-- (legal name, DOB, ID type, Stripe account id, lifetime earnings)
-- to any logged-in user. Only tier/rating/status are ever needed
-- cross-user, so we drop the broad table policy and expose a
-- minimal, safe view instead.
-- ============================================================

-- ── 1. Drop the over-broad cross-user SELECT on the raw table ──────────────
-- After this, partner_verifications is owner-only:
--   "Users view own verification"   (full row, owner)
--   "Users insert own verification" (owner)
--   "Users update own verification" (owner)
drop policy if exists "Authenticated view partner tier" on public.partner_verifications;

-- Re-affirm the owner-only SELECT policy exists (idempotent).
drop policy if exists "Users view own verification" on public.partner_verifications;
create policy "Users view own verification"
  on public.partner_verifications for select
  using (auth.uid() = user_id);

-- ── 2. Safe cross-user view — non-sensitive columns only ───────────────────
-- SECURITY DEFINER view (runs as owner) so any authenticated user can read
-- another partner's PUBLIC trust signals, while the raw table stays owner-only.
-- Deliberately excludes: legal_first_name, legal_last_name, dob, id_country,
-- id_type, idv_session_id, idv_report_id, idv_failure_reason, stripe_account_id,
-- stripe_onboarding_url, lifetime_earnings_cents.
create or replace view public.partner_public_stats as
  select
    user_id,
    tier,
    idv_status,
    payout_status,
    completed_assignments,
    total_assignments,
    average_rating
  from public.partner_verifications;

grant select on public.partner_public_stats to authenticated;

comment on view public.partner_public_stats is
  'Public, non-PII trust signals for partners (tier, rating, completion counts). '
  'Use this for cross-user reads; the partner_verifications table is owner-only.';

-- ── 3. Re-affirm own-profile SELECT (guards against the master-deploy bug
--       that previously left this policy malformed) ─────────────────────────
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- ── 4. VERIFY ──────────────────────────────────────────────────────────────
-- Confirm no public table is missing RLS:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: only rate_limit_log (service-role only, RLS intentionally off).
--
-- Confirm the leak is closed (run as a normal authenticated user — should
-- error "permission denied" or return only your own row):
--   SELECT legal_first_name FROM public.partner_verifications;
