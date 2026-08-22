-- ─────────────────────────────────────────────────────────────────────────────
-- Package Operations Board — Migration
-- Phase 6: Full staff package board with enriched views, logging, and status
-- transitions. Extends existing package_log_items table (already created in
-- multi-context-migration.sql). No destructive changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Ensure package_log_items has the columns we need ─────────────────────────
-- (Safe: IF NOT EXISTS guards mean re-running this is harmless)

ALTER TABLE public.package_log_items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS size_hint TEXT,            -- 'small' | 'medium' | 'large' | 'oversized'
  ADD COLUMN IF NOT EXISTS location_in_office TEXT,   -- where staff put it: "Mailroom B" etc.
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,   -- when resident was notified
  ADD COLUMN IF NOT EXISTS exception_reason TEXT;     -- filled when status = 'exception'

-- ── Package status audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.package_status_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES public.package_log_items(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  changed_by      UUID NOT NULL REFERENCES auth.users(id),
  from_status     TEXT NOT NULL,
  to_status       TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.package_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_staff_see_events" ON public.package_status_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = package_status_events.org_id
        AND m.status = 'active'
        AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
    )
  );

CREATE POLICY "org_staff_insert_events" ON public.package_status_events
  FOR INSERT WITH CHECK (
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = package_status_events.org_id
        AND m.status = 'active'
        AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
    )
  );

-- ── Enriched board view (security_definer RPC) ────────────────────────────────
-- Returns package_log_items joined with units and a resolved display name.
-- Caller must be an active staff member of the org.

CREATE OR REPLACE FUNCTION public.get_org_packages_board(
  p_org_id    UUID,
  p_status    TEXT DEFAULT NULL,   -- NULL = all statuses
  p_limit     INT  DEFAULT 50,
  p_offset    INT  DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  org_id            UUID,
  property_id       UUID,
  unit_id           UUID,
  unit_number       TEXT,
  resident_id       UUID,
  logged_by         UUID,
  logged_by_name    TEXT,
  carrier           TEXT,
  tracking_number   TEXT,
  status            TEXT,
  notes             TEXT,
  description       TEXT,
  size_hint         TEXT,
  location_in_office TEXT,
  exception_reason  TEXT,
  photo_url         TEXT,
  received_at       TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Permission check: caller must be active staff in this org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT
    pkg.id,
    pkg.org_id,
    pkg.property_id,
    pkg.unit_id,
    u.unit_number::TEXT,
    pkg.resident_id,
    pkg.logged_by,
    COALESCE(p.name, 'Staff')::TEXT AS logged_by_name,
    pkg.carrier,
    pkg.tracking_number,
    pkg.status::TEXT,
    pkg.notes,
    pkg.description,
    pkg.size_hint,
    pkg.location_in_office,
    pkg.exception_reason,
    pkg.photo_url,
    pkg.received_at,
    pkg.picked_up_at,
    pkg.notified_at,
    pkg.created_at,
    pkg.updated_at
  FROM package_log_items pkg
  LEFT JOIN units u ON u.id = pkg.unit_id
  LEFT JOIN profiles p ON p.id = pkg.logged_by
  WHERE pkg.org_id = p_org_id
    AND (p_status IS NULL OR pkg.status::TEXT = p_status)
  ORDER BY
    CASE pkg.status::TEXT
      WHEN 'exception'         THEN 1
      WHEN 'received'          THEN 2
      WHEN 'ready_for_pickup'  THEN 3
      WHEN 'picked_up'         THEN 4
      WHEN 'returned_to_sender' THEN 5
      ELSE 6
    END,
    pkg.received_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ── Log a new package (staff action) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_org_package(
  p_org_id         UUID,
  p_carrier        TEXT,
  p_tracking       TEXT        DEFAULT NULL,
  p_unit_number    TEXT        DEFAULT NULL,
  p_notes          TEXT        DEFAULT NULL,
  p_description    TEXT        DEFAULT NULL,
  p_size_hint      TEXT        DEFAULT NULL,
  p_location       TEXT        DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unit_id  UUID;
  v_pkg_id   UUID;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Resolve unit by number within the org
  IF p_unit_number IS NOT NULL THEN
    SELECT id INTO v_unit_id
    FROM units u
    WHERE u.org_id = p_org_id
      AND u.unit_number ILIKE p_unit_number
    LIMIT 1;
  END IF;

  INSERT INTO package_log_items (
    org_id, unit_id, logged_by, carrier, tracking_number,
    status, notes, description, size_hint, location_in_office, received_at
  ) VALUES (
    p_org_id, v_unit_id, auth.uid(), p_carrier, p_tracking,
    'received', p_notes, p_description, p_size_hint, p_location, now()
  )
  RETURNING id INTO v_pkg_id;

  -- Audit event
  INSERT INTO package_status_events (package_id, org_id, changed_by, from_status, to_status, notes)
  VALUES (v_pkg_id, p_org_id, auth.uid(), 'none', 'received', 'Package logged');

  RETURN v_pkg_id;
END;
$$;

-- ── Update package status (staff action) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_org_package_status(
  p_package_id     UUID,
  p_org_id         UUID,
  p_new_status     TEXT,
  p_notes          TEXT DEFAULT NULL,
  p_exception_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Get current status
  SELECT status::TEXT INTO v_old_status
  FROM package_log_items
  WHERE id = p_package_id AND org_id = p_org_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  -- Update
  UPDATE package_log_items SET
    status = p_new_status::package_log_status,
    notes = COALESCE(p_notes, notes),
    exception_reason = CASE WHEN p_new_status = 'exception' THEN p_exception_reason ELSE exception_reason END,
    picked_up_at = CASE WHEN p_new_status = 'picked_up' THEN now() ELSE picked_up_at END,
    updated_at = now()
  WHERE id = p_package_id AND org_id = p_org_id;

  -- Audit event
  INSERT INTO package_status_events (package_id, org_id, changed_by, from_status, to_status, notes)
  VALUES (p_package_id, p_org_id, auth.uid(), v_old_status, p_new_status, p_notes);
END;
$$;

-- ── Board summary counts ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_package_board_counts(p_org_id UUID)
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT pkg.status::TEXT, COUNT(*) AS count
  FROM package_log_items pkg
  WHERE pkg.org_id = p_org_id
  GROUP BY pkg.status;
END;
$$;
