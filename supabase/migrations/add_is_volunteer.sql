-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Add is_volunteer to partner_verifications + partner_public_stats view
--
-- Allows Porch Partners to mark themselves as "volunteer" — they hold packages
-- for free, no charge to homeowners. The flag is exposed via the public stats
-- view so homeowners can see which neighbors don't charge.
--
-- Run order: after master-deploy.sql (or can be run standalone on an existing DB)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add is_volunteer column to partner_verifications
alter table public.partner_verifications
  add column if not exists is_volunteer boolean not null default false;

comment on column public.partner_verifications.is_volunteer is
  'True if this partner holds packages for free (no charge to homeowners). '
  'Volunteer partners skip the Stripe payment flow entirely.';

-- 2. Rebuild the partner_public_stats view to include is_volunteer
create or replace view public.partner_public_stats as
  select
    user_id,
    tier,
    idv_status,
    payout_status,
    completed_assignments,
    total_assignments,
    average_rating,
    is_volunteer
  from public.partner_verifications;

grant select on public.partner_public_stats to authenticated;

comment on view public.partner_public_stats is
  'Public, non-PII trust signals for partners (tier, rating, completion counts, volunteer status). '
  'Use this for cross-user reads; the partner_verifications table is owner-only.';
