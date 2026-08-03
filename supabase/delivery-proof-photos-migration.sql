-- ============================================================
-- PORCHIVO: Proof-of-Delivery Photos
-- Adds completion_photo_url column to shipments + a dedicated
-- delivery-photos Storage bucket with owner-scoped RLS.
-- Safe to re-run — all statements are idempotent.
-- ============================================================

-- ── 1. Add completion_photo_url column ──────────────────────────
alter table public.shipments
  add column if not exists completion_photo_url text;

comment on column public.shipments.completion_photo_url is
  'Public CDN URL of the proof-of-delivery photo uploaded by the porch partner when marking a shipment as completed. Null if no photo was captured.';


-- ── 2. Storage bucket: delivery-photos ──────────────────────────
-- Public-read so homeowners can view the photo via URL, but writes
-- are restricted to the authenticated partner who captured it.
-- Object paths are namespaced by user id: delivery-photos/<uid>/<shipmentId>/<file>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-photos',
  'delivery-photos',
  true,
  10485760,                               -- 10 MB hard cap per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ── 3. Storage object RLS policies ───────────────────────────────

-- Anyone can read delivery proof photos (homeowner viewing the URL).
DROP POLICY IF EXISTS "Public can read delivery photos" ON storage.objects;
CREATE POLICY "Public can read delivery photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-photos');

-- Authenticated users can INSERT only into their own uid-prefixed path.
DROP POLICY IF EXISTS "Users insert own delivery photo" ON storage.objects;
CREATE POLICY "Users insert own delivery photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can DELETE only their own delivery photos.
DROP POLICY IF EXISTS "Users delete own delivery photo" ON storage.objects;
CREATE POLICY "Users delete own delivery photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'delivery-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 4. Verification ─────────────────────────────────────────────
-- After running, confirm:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'shipments' AND column_name = 'completion_photo_url';
--
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'delivery-photos';
--
--   SELECT polname, polcmd FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND polname LIKE '%delivery photo%';
