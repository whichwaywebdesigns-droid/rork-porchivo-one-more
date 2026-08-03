-- ============================================================
-- PORCHIVO: Avatar Storage Bucket + RLS
-- Run in Supabase SQL Editor. Safe to re-run — all statements
-- use IF NOT EXISTS / DROP IF EXISTS / idempotent storage calls.
-- ============================================================
--
-- Creates a public-read Storage bucket `avatars` so profile
-- pictures uploaded from the app (expo/app/edit-profile.tsx via
-- expo/lib/avatar.ts) are reachable as CDN URLs and render in
-- chat, resident directory, partner cards, and other devices.
--
-- Security model
--   * Bucket is PUBLIC (public read). Anyone can fetch a stored
--     avatar by URL — this is intentional, avatars are display
--     data shown to neighbors/partners, not PII.
--   * WRITE is restricted via Storage RLS policies:
--       - authenticated users can INSERT/UPDATE/DELETE only
--         objects whose path prefix matches their own auth.uid()
--         (paths are `<uid>/<filename>`), so users can manage
--         only their own avatar.
--       - service_role bypasses RLS (used by edge functions).
--   * We also keep a 2 MB per-object upload guard client-side;
--     Storage itself caps object size by plan, not policy.
-- ============================================================


-- ── 1. Bucket ───────────────────────────────────────────────────────────────
-- `insert into storage.buckets` is idempotent on (id) via ON CONFLICT.
-- public = true makes the bucket readable by anyone with the object URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,                                -- 5 MB hard cap per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public           = EXCLUDED.public,
    file_size_limit  = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ── 2. Storage object RLS policies ───────────────────────────────────────────
-- Object paths are namespaced by user id: `avatars/<auth.uid()>/<file>`.
-- This lets a user manage only the objects whose first path segment
-- equals their own uid, while anyone (anon + authenticated) can read.

-- Anyone can SELECT (read) avatar objects — bucket is public, but the
-- policy is still required for the RLS check to pass on the objects table.
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
CREATE POLICY "Public can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can INSERT only into their own uid-prefixed path.
DROP POLICY IF EXISTS "Users insert own avatar" ON storage.objects;
CREATE POLICY "Users insert own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can UPDATE only their own avatar.
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can DELETE only their own avatar (e.g. on remove).
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 3. Verification ─────────────────────────────────────────────────────────
-- After running, confirm:
--
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'avatars';
--   -- Expected: public = true, file_size_limit = 5242880
--
--   SELECT polname, polcmd FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND polname LIKE '%avatar%';
--   -- Expected: 4 policies (public read, insert, update, delete)
