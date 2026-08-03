-- ─── Announcements V2 Migration ───────────────────────────────────────────────
-- Adds scheduled publishing, author caching, and view-count tracking
-- to org_announcements. Includes updated RLS for scheduled visibility.
--
-- Run AFTER multi-context-migration.sql
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns
ALTER TABLE public.org_announcements
  ADD COLUMN IF NOT EXISTS scheduled_at      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS author_display_name TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS view_count        INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category          TEXT         DEFAULT 'general'
    CHECK (category IN ('general','package','maintenance','safety','meeting','parking','amenity','emergency'));

-- 2. Index for scheduled-publish queries
CREATE INDEX IF NOT EXISTS org_announcements_scheduled_at_idx
  ON public.org_announcements (org_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- 3. Index for category filtering
CREATE INDEX IF NOT EXISTS org_announcements_category_idx
  ON public.org_announcements (org_id, category);

-- 4. Drop & recreate member-view RLS to respect scheduled_at
--    Members: only see published (scheduled_at IS NULL OR scheduled_at <= NOW())
--    Staff/board: can preview future-scheduled announcements
DROP POLICY IF EXISTS "Members can view their org announcements" ON public.org_announcements;

CREATE POLICY "Members can view their org announcements"
  ON public.org_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.status  = 'active'
    )
    AND (
      -- Published (no schedule or schedule is in the past)
      scheduled_at IS NULL
      OR scheduled_at <= NOW()
      -- OR caller is staff/board and can preview future posts
      OR EXISTS (
        SELECT 1 FROM public.org_memberships om2
        WHERE om2.org_id  = org_announcements.org_id
          AND om2.user_id = auth.uid()
          AND om2.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
          AND om2.status  = 'active'
      )
    )
  );

-- 5. Insert policy (already exists from phase 1 — idempotent recreate)
DROP POLICY IF EXISTS "Staff can post announcements" ON public.org_announcements;

CREATE POLICY "Staff can post announcements"
  ON public.org_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
        AND om.status  = 'active'
    )
  );

-- 6. Delete policy — own post or admin
DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON public.org_announcements;

CREATE POLICY "Authors and admins can delete announcements"
  ON public.org_announcements FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('hoa_admin','property_manager','super_admin')
        AND om.status  = 'active'
    )
  );

-- 7. Update policy — own post or admin
DROP POLICY IF EXISTS "Authors and admins can update announcements" ON public.org_announcements;

CREATE POLICY "Authors and admins can update announcements"
  ON public.org_announcements FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('hoa_admin','property_manager','super_admin')
        AND om.status  = 'active'
    )
  );

-- 8. RPC: increment view count (fire-and-forget style from client)
CREATE OR REPLACE FUNCTION public.increment_announcement_view(p_announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.org_announcements
  SET view_count = view_count + 1
  WHERE id = p_announcement_id;
END;
$$;

-- 9. RPC: get scheduled announcements for staff (future-dated)
CREATE OR REPLACE FUNCTION public.get_scheduled_announcements(p_org_id UUID)
RETURNS SETOF public.org_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff/board
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id  = p_org_id
      AND om.user_id = auth.uid()
      AND om.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
      AND om.status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT * FROM public.org_announcements
  WHERE org_id     = p_org_id
    AND scheduled_at IS NOT NULL
    AND scheduled_at > NOW()
  ORDER BY scheduled_at ASC;
END;
$$;
