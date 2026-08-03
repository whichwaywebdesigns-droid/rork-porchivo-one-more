-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Maintenance Requests
-- Phase 13 — additive migration
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE maintenance_category AS ENUM (
    'plumbing', 'electrical', 'hvac', 'structural', 'pest_control',
    'landscaping', 'common_area', 'appliance', 'security', 'parking',
    'elevator', 'amenity', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_priority AS ENUM ('low', 'normal', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM (
    'submitted', 'acknowledged', 'scheduled', 'in_progress',
    'on_hold', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_resolution AS ENUM (
    'completed_by_staff', 'completed_by_vendor', 'resident_resolved',
    'duplicate', 'outside_scope', 'cancelled_by_resident', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id           uuid REFERENCES properties(id) ON DELETE SET NULL,
  unit_id               uuid REFERENCES units(id) ON DELETE SET NULL,
  reporter_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignee_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category              maintenance_category NOT NULL DEFAULT 'other',
  priority              maintenance_priority NOT NULL DEFAULT 'normal',
  status                maintenance_status NOT NULL DEFAULT 'submitted',
  title                 text NOT NULL,
  description           text,
  location_detail       text,              -- e.g. "kitchen sink", "hallway B2"
  preferred_time        text,              -- e.g. "Weekday mornings"
  is_urgent             boolean NOT NULL DEFAULT false,
  allow_entry           boolean NOT NULL DEFAULT false,  -- resident grants entry permission
  resolution_code       maintenance_resolution,
  resolution_notes      text,
  resident_visible_note text,              -- what resident sees on status changes
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  due_date              timestamptz,
  photo_url             text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  author_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  is_internal     boolean NOT NULL DEFAULT false,  -- true = staff-only; false = resident-visible
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL,
  changed_by  uuid NOT NULL REFERENCES profiles(id),
  from_status maintenance_status,
  to_status   maintenance_status NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_maint_requests_org        ON maintenance_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_reporter   ON maintenance_requests(reporter_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_assignee   ON maintenance_requests(assignee_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_status     ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maint_requests_priority   ON maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_maint_requests_created    ON maintenance_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maint_comments_request    ON maintenance_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_maint_history_request     ON maintenance_status_history(request_id);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_maintenance_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON maintenance_requests;
CREATE TRIGGER trg_maintenance_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE maintenance_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status_history  ENABLE ROW LEVEL SECURITY;

-- Helper: is caller an active member of org?
CREATE OR REPLACE FUNCTION _maint_is_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

-- Helper: is caller staff/admin of org?
CREATE OR REPLACE FUNCTION _maint_is_staff(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  );
$$;

-- maintenance_requests: residents see own; staff sees all in org
CREATE POLICY maint_req_select ON maintenance_requests FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR _maint_is_staff(org_id)
  );

CREATE POLICY maint_req_insert ON maintenance_requests FOR INSERT
  WITH CHECK (_maint_is_member(org_id));

CREATE POLICY maint_req_update ON maintenance_requests FOR UPDATE
  USING (_maint_is_staff(org_id))
  WITH CHECK (_maint_is_staff(org_id));

-- maintenance_comments: residents see non-internal on own requests; staff sees all
CREATE POLICY maint_comment_select ON maintenance_comments FOR SELECT
  USING (
    (is_internal = false AND EXISTS (
      SELECT 1 FROM maintenance_requests r
      WHERE r.id = request_id AND r.reporter_id = auth.uid()
    ))
    OR _maint_is_staff(org_id)
  );

CREATE POLICY maint_comment_insert ON maintenance_comments FOR INSERT
  WITH CHECK (_maint_is_member(org_id));

-- status history: same as requests
CREATE POLICY maint_history_select ON maintenance_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests r
      WHERE r.id = request_id AND (r.reporter_id = auth.uid() OR _maint_is_staff(r.org_id))
    )
  );

-- ── 6. RPCs ───────────────────────────────────────────────────────────────────

-- 6a. Submit a new maintenance request (any active org member)
CREATE OR REPLACE FUNCTION submit_maintenance_request(
  p_org_id       uuid,
  p_category     maintenance_category,
  p_priority     maintenance_priority,
  p_title        text,
  p_description  text DEFAULT NULL,
  p_location     text DEFAULT NULL,
  p_preferred    text DEFAULT NULL,
  p_allow_entry  boolean DEFAULT false,
  p_unit_id      uuid DEFAULT NULL,
  p_photo_url    text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT _maint_is_member(p_org_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO maintenance_requests (
    org_id, reporter_id, category, priority, title, description,
    location_detail, preferred_time, allow_entry, unit_id, photo_url,
    is_urgent
  ) VALUES (
    p_org_id, auth.uid(), p_category, p_priority, p_title, p_description,
    p_location, p_preferred, p_allow_entry, p_unit_id, p_photo_url,
    p_priority = 'emergency'
  )
  RETURNING id INTO v_id;

  -- seed status history
  INSERT INTO maintenance_status_history (request_id, org_id, changed_by, from_status, to_status)
  VALUES (v_id, p_org_id, auth.uid(), NULL, 'submitted');

  RETURN v_id;
END;
$$;

-- 6b. Staff: update status + optional resident-visible note
CREATE OR REPLACE FUNCTION update_maintenance_status(
  p_request_id  uuid,
  p_status      maintenance_status,
  p_note        text DEFAULT NULL,
  p_resolution  maintenance_resolution DEFAULT NULL,
  p_scheduled   timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_old    maintenance_status;
BEGIN
  SELECT org_id, status INTO v_org_id, v_old FROM maintenance_requests WHERE id = p_request_id;

  IF NOT _maint_is_staff(v_org_id) THEN
    RAISE EXCEPTION 'not_staff';
  END IF;

  UPDATE maintenance_requests SET
    status                = p_status,
    resident_visible_note = COALESCE(p_note, resident_visible_note),
    resolution_code       = COALESCE(p_resolution, resolution_code),
    scheduled_for         = COALESCE(p_scheduled, scheduled_for),
    completed_at          = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_request_id;

  INSERT INTO maintenance_status_history (request_id, org_id, changed_by, from_status, to_status, note)
  VALUES (p_request_id, v_org_id, auth.uid(), v_old, p_status, p_note);
END;
$$;

-- 6c. Staff: assign request to a staff member
CREATE OR REPLACE FUNCTION assign_maintenance_request(
  p_request_id  uuid,
  p_assignee_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id uuid; BEGIN
  SELECT org_id INTO v_org_id FROM maintenance_requests WHERE id = p_request_id;
  IF NOT _maint_is_staff(v_org_id) THEN RAISE EXCEPTION 'not_staff'; END IF;
  UPDATE maintenance_requests SET assignee_id = p_assignee_id WHERE id = p_request_id;
END;
$$;

-- 6d. Add comment (internal flag restricted to staff)
CREATE OR REPLACE FUNCTION add_maintenance_comment(
  p_request_id  uuid,
  p_body        text,
  p_internal    boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_id     uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM maintenance_requests WHERE id = p_request_id;

  IF p_internal AND NOT _maint_is_staff(v_org_id) THEN
    RAISE EXCEPTION 'not_staff';
  END IF;

  IF NOT _maint_is_member(v_org_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO maintenance_comments (request_id, org_id, author_id, body, is_internal)
  VALUES (p_request_id, v_org_id, auth.uid(), p_body, p_internal)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6e. Staff queue — paginated, filterable
CREATE OR REPLACE FUNCTION get_maintenance_queue(
  p_org_id    uuid,
  p_status    maintenance_status DEFAULT NULL,
  p_category  maintenance_category DEFAULT NULL,
  p_priority  maintenance_priority DEFAULT NULL,
  p_limit     int DEFAULT 40,
  p_offset    int DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  org_id                uuid,
  unit_id               uuid,
  unit_number           text,
  reporter_id           uuid,
  reporter_name         text,
  assignee_id           uuid,
  assignee_name         text,
  category              maintenance_category,
  priority              maintenance_priority,
  status                maintenance_status,
  title                 text,
  description           text,
  location_detail       text,
  preferred_time        text,
  allow_entry           boolean,
  is_urgent             boolean,
  resident_visible_note text,
  resolution_code       maintenance_resolution,
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  due_date              timestamptz,
  photo_url             text,
  comment_count         bigint,
  created_at            timestamptz,
  updated_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    r.id, r.org_id, r.unit_id,
    u.unit_number,
    r.reporter_id,
    COALESCE(rp.display_name, 'Unknown') AS reporter_name,
    r.assignee_id,
    ap.display_name AS assignee_name,
    r.category, r.priority, r.status, r.title, r.description,
    r.location_detail, r.preferred_time, r.allow_entry, r.is_urgent,
    r.resident_visible_note, r.resolution_code,
    r.scheduled_for, r.completed_at, r.due_date, r.photo_url,
    (SELECT COUNT(*) FROM maintenance_comments c WHERE c.request_id = r.id) AS comment_count,
    r.created_at, r.updated_at
  FROM maintenance_requests r
  LEFT JOIN units u          ON u.id = r.unit_id
  LEFT JOIN profiles rp      ON rp.id = r.reporter_id
  LEFT JOIN profiles ap      ON ap.id = r.assignee_id
  WHERE r.org_id = p_org_id
    AND _maint_is_staff(p_org_id)
    AND (p_status   IS NULL OR r.status   = p_status)
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_priority IS NULL OR r.priority = p_priority)
  ORDER BY
    CASE r.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6f. Resident — own requests only
CREATE OR REPLACE FUNCTION get_my_maintenance_requests(p_org_id uuid)
RETURNS TABLE (
  id                    uuid,
  category              maintenance_category,
  priority              maintenance_priority,
  status                maintenance_status,
  title                 text,
  description           text,
  location_detail       text,
  resident_visible_note text,
  resolution_code       maintenance_resolution,
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  comment_count         bigint,
  created_at            timestamptz,
  updated_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    r.id, r.category, r.priority, r.status, r.title, r.description,
    r.location_detail, r.resident_visible_note, r.resolution_code,
    r.scheduled_for, r.completed_at,
    (SELECT COUNT(*) FROM maintenance_comments c WHERE c.request_id = r.id AND c.is_internal = false),
    r.created_at, r.updated_at
  FROM maintenance_requests r
  WHERE r.org_id = p_org_id AND r.reporter_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

-- 6g. Queue counts for dashboard badges
CREATE OR REPLACE FUNCTION get_maintenance_counts(p_org_id uuid)
RETURNS TABLE (
  open_count        bigint,
  emergency_count   bigint,
  in_progress_count bigint,
  scheduled_count   bigint,
  completed_today   bigint,
  unassigned_count  bigint
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS open_count,
    COUNT(*) FILTER (WHERE priority = 'emergency' AND status NOT IN ('completed','cancelled')) AS emergency_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
    COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= now() - interval '1 day') AS completed_today,
    COUNT(*) FILTER (WHERE assignee_id IS NULL AND status NOT IN ('completed','cancelled')) AS unassigned_count
  FROM maintenance_requests
  WHERE org_id = p_org_id AND _maint_is_staff(p_org_id);
$$;
