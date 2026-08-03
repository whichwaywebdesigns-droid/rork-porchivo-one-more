-- ============================================================
-- PORCHIVO — VERSIONED LEGAL CONSENT TRACKING
-- Append-only audit trail of each user's acceptance of the
-- Terms of Service + Privacy Policy. Every acceptance is stamped
-- with the legal document version and a server timestamp so we can
-- prove who agreed to what, and when — and force re-acceptance
-- whenever the version string changes.
--
-- Idempotent — safe to re-run.
-- Run in Supabase SQL Editor AFTER migration.sql.
-- ============================================================

create table if not exists public.user_consents (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- Legal version string the user accepted (see expo/constants/legal.ts LEGAL_VERSION).
  version     text        not null,
  -- Which documents this acceptance covers.
  documents   text[]      not null default array['terms_of_service', 'privacy_policy'],
  -- Lightweight client context for the audit record (no PII).
  platform    text,
  app_version text,
  accepted_at timestamptz not null default now()
);

create index if not exists user_consents_user_id_idx
  on public.user_consents (user_id);

-- Fast "latest accepted version for this user" lookup.
create index if not exists user_consents_user_accepted_idx
  on public.user_consents (user_id, accepted_at desc);

alter table public.user_consents enable row level security;

-- Users may record their own consent.
drop policy if exists "Users insert own consent" on public.user_consents;
create policy "Users insert own consent"
  on public.user_consents for insert to authenticated
  with check (auth.uid() = user_id);

-- Users may read their own consent history.
drop policy if exists "Users read own consent" on public.user_consents;
create policy "Users read own consent"
  on public.user_consents for select to authenticated
  using (auth.uid() = user_id);

-- NOTE: There are intentionally NO update or delete policies.
-- Consent records are immutable and append-only — a new acceptance
-- (e.g. after a Terms change) inserts a new row rather than mutating
-- an existing one, preserving the full historical audit trail.
-- Rows are removed only when the auth.users row is deleted (FK cascade).
