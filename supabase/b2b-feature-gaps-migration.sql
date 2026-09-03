-- ═══════════════════════════════════════════════════════════════════════════
-- B2B FEATURE GAPS MIGRATION (2026-09-02)
-- Closes the last three advertised-but-missing community-tier features:
--   * Document library (Starter+)        → org_documents + private `org-documents` bucket
--   * Amenity reservations (Community+)  → org_amenities + org_amenity_reservations
--   * Ledger exports (Community+)        → client-side CSV from org_payments (no schema change)
-- Patterns: org_vendors (RLS roles) + avatar-storage-migration (bucket/policies).
-- Fully idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. org_documents — community document library ───────────────────────────
-- Two document kinds (exactly one source per row):
--   external_url : link to an external doc (Google Drive, Dropbox, HOA site…)
--   file_path    : object inside the private `org-documents` bucket, path
--                  `{org_id}/{filename}` (org-scoped for storage RLS).
CREATE TABLE IF NOT EXISTS public.org_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  external_url text,
  file_path    text,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_documents_source_check CHECK (
    (external_url IS NOT NULL AND file_path IS NULL)
    OR (file_path IS NOT NULL AND external_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_org_documents_org ON public.org_documents(org_id, created_at DESC);

ALTER TABLE public.org_documents ENABLE ROW LEVEL SECURITY;

-- Every active member of the org can read the library.
DROP POLICY IF EXISTS org_documents_select ON public.org_documents;
CREATE POLICY org_documents_select ON public.org_documents
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Only org staff/board can add documents.
DROP POLICY IF EXISTS org_documents_insert ON public.org_documents;
CREATE POLICY org_documents_insert ON public.org_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS org_documents_update ON public.org_documents;
CREATE POLICY org_documents_update ON public.org_documents
  FOR UPDATE TO authenticated
  USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));

DROP POLICY IF EXISTS org_documents_delete ON public.org_documents;
CREATE POLICY org_documents_delete ON public.org_documents
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));

-- ── 2. `org-documents` storage bucket (private) ─────────────────────────────
-- 25 MB per file; paths are `{org_id}/{uuid}-{filename}` so RLS is org-scoped.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  26214400, -- 25 MB hard cap per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public            = EXCLUDED.public,
    file_size_limit   = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members of the org (first path segment = org uuid) can read.
DROP POLICY IF EXISTS "Org members read org documents" ON storage.objects;
CREATE POLICY "Org members read org documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_active_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Only staff/board can upload into their org's folder.
DROP POLICY IF EXISTS "Org staff insert org documents" ON storage.objects;
CREATE POLICY "Org staff insert org documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org staff update org documents" ON storage.objects;
CREATE POLICY "Org staff update org documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org staff delete org documents" ON storage.objects;
CREATE POLICY "Org staff delete org documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

-- ── 3. org_amenities — bookable community amenities ─────────────────────────
CREATE TABLE IF NOT EXISTS public.org_amenities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_amenities_org ON public.org_amenities(org_id, name);

ALTER TABLE public.org_amenities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_amenities_select ON public.org_amenities;
CREATE POLICY org_amenities_select ON public.org_amenities
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

DROP POLICY IF EXISTS org_amenities_insert ON public.org_amenities;
CREATE POLICY org_amenities_insert ON public.org_amenities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS org_amenities_delete ON public.org_amenities;
CREATE POLICY org_amenities_delete ON public.org_amenities
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));

-- ── 4. org_amenity_reservations — member time-slot bookings ─────────────────
-- Double-booking is impossible at the DB level: a GiST exclusion constraint
-- rejects overlapping confirmed reservations for the same amenity.
CREATE TABLE IF NOT EXISTS public.org_amenity_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amenity_id  uuid NOT NULL REFERENCES public.org_amenities(id) ON DELETE CASCADE,
  reserved_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('confirmed', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_amenity_reservations_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_org_amenity_res_amenity
  ON public.org_amenity_reservations(amenity_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_org_amenity_res_org
  ON public.org_amenity_reservations(org_id, starts_at);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.org_amenity_reservations
  DROP CONSTRAINT IF EXISTS org_amenity_reservations_no_overlap;
ALTER TABLE public.org_amenity_reservations
  ADD CONSTRAINT org_amenity_reservations_no_overlap
  EXCLUDE USING gist (
    amenity_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');

ALTER TABLE public.org_amenity_reservations ENABLE ROW LEVEL SECURITY;

-- All members see the reservation book (transparency).
DROP POLICY IF EXISTS org_amenity_res_select ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_select ON public.org_amenity_reservations
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Members book for themselves (confirmed only).
DROP POLICY IF EXISTS org_amenity_res_insert ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_insert ON public.org_amenity_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_org_member(org_id)
    AND reserved_by = auth.uid()
    AND status = 'confirmed'
  );

-- A member can cancel their own booking; staff can cancel any.
DROP POLICY IF EXISTS org_amenity_res_update ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_update ON public.org_amenity_reservations
  FOR UPDATE TO authenticated
  USING (public.is_active_org_member(org_id) AND (reserved_by = auth.uid() OR public.is_org_staff(org_id)))
  WITH CHECK (public.is_active_org_member(org_id));

-- Staff can clean up junk rows.
DROP POLICY IF EXISTS org_amenity_res_delete ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_delete ON public.org_amenity_reservations
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));
