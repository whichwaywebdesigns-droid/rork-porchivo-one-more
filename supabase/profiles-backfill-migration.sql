-- Profiles Backfill
-- Run this in Supabase SQL Editor AFTER master-deploy.sql / migration.sql.
--
-- Safety net before publish: inserts a profiles row for any auth.users that
-- somehow has no matching public.profiles row (e.g. created before the
-- handle_new_user trigger existed, or if a trigger insert was skipped).
--
-- This mirrors the handle_new_user trigger exactly — it only sets id, email,
-- and name, leaving every other column to its schema default.
--
-- Idempotent: safe to run multiple times. The NOT EXISTS guard + ON CONFLICT
-- means already-present profiles are never touched or duplicated.

-- ── Pre-check (read-only): how many users are missing a profile ─────────────
-- SELECT count(*) AS missing_profiles
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL;

-- ── Backfill ────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'full_name',
    split_part(u.email, '@', 1)
  ) AS name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── Post-check (read-only): should return 0 after running ───────────────────
-- SELECT count(*) AS missing_profiles
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL;
