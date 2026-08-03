-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Incident Review Queue · Migration
-- Phase 7 — additive, no existing tables modified
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. incident_reports ──────────────────────────────────────────────────────

CREATE TYPE public.incident_type AS ENUM (
  'missing_package',
  'delivered_not_found',
  'misdelivered',
  'damaged',
  'tampered',
  'suspicious_activity',
  'held_too_long',
  'wrong_pickup',
  'rule_violation',
  'carrier_failure',
  'duplicate_complaint',
  'other'
);

CREATE TYPE public.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.incident_status AS ENUM (
  'flagged',
  'intake',
  'investigating',
  'escalated',
  'resolved',
  'closed'
);

CREATE TYPE public.incident_resolution_code AS ENUM (
  'package_found',
  'misdelivery_corrected',
  'resident_recovered',
  'carrier_contacted',
  'replacement_handled',
  'insufficient_evidence',
  'duplicate',
  'escalated_board',
  'escalated_security',
  'escalated_carrier',
  'monitoring',
  'other'
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id            uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id                uuid REFERENCES public.units(id) ON DELETE SET NULL,
  reporter_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  package_log_id         uuid REFERENCES public.package_log_items(id) ON DELETE SET NULL,
  -- Linked duplicate / related incident
  related_incident_id    uuid REFERENCES public.incident_reports(id) ON DELETE SET NULL,
  type                   public.incident_type NOT NULL,
  severity               public.incident_severity NOT NULL DEFAULT 'medium',
  status                 public.incident_status NOT NULL DEFAULT 'flagged',
  title                  text NOT NULL,
  description            text,
  -- Separate resident-facing summary from internal detail
  resident_visible_update text,
  resolution_code        public.incident_resolution_code,
  resolution_notes       text,
  -- SLA / aging
  due_date               timestamptz,
  closed_at              timestamptz,
  -- Escalation metadata
  escalation_target      text,           -- 'board' | 'security' | 'carrier' | 'vendor'
  escalation_note        text,
  -- Trend / pattern tags stored as an array for fast querying
  trend_tags             text[] DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_org_id         ON public.incident_reports(org_id);
CREATE INDEX idx_incidents_status         ON public.incident_reports(status);
CREATE INDEX idx_incidents_severity       ON public.incident_reports(severity);
CREATE INDEX idx_incidents_reporter       ON public.incident_reports(reporter_id);
CREATE INDEX idx_incidents_assignee       ON public.incident_reports(assignee_id);
CREATE INDEX idx_incidents_created_at     ON public.incident_reports(created_at DESC);
CREATE INDEX idx_incidents_due_date       ON public.incident_reports(due_date) WHERE due_date IS NOT NULL;

-- ── 2. incident_comments ─────────────────────────────────────────────────────
-- Dual-visibility: is_internal=true means staff-only; false = resident can see.

CREATE TABLE IF NOT EXISTS public.incident_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         text NOT NULL,
  is_internal  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inc_comments_incident ON public.incident_comments(incident_id);
CREATE INDEX idx_inc_comments_org      ON public.incident_comments(org_id);

-- ── 3. incident_status_history ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incident_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_status   public.incident_status,
  new_status   public.incident_status NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inc_history_incident ON public.incident_status_history(incident_id);

-- ── 4. incident_evidence ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incident_evidence (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url          text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inc_evidence_incident ON public.incident_evidence(incident_id);

-- ── 5. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_incidents_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER incidents_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_incidents_updated_at();

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.incident_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_evidence      ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user an active org member?
CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Helper: is the calling user staff/admin in org?
CREATE OR REPLACE FUNCTION public.is_org_staff(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin', 'board_member')
  );
$$;

-- incident_reports: members see own; staff see all in org
CREATE POLICY incidents_select ON public.incident_reports
  FOR SELECT TO authenticated USING (
    reporter_id = auth.uid()
    OR public.is_org_staff(org_id)
  );

CREATE POLICY incidents_insert ON public.incident_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND public.is_active_org_member(org_id)
  );

CREATE POLICY incidents_update ON public.incident_reports
  FOR UPDATE TO authenticated USING (
    public.is_org_staff(org_id)
  );

-- incident_comments: internal notes hidden from non-staff reporters
CREATE POLICY inc_comments_select ON public.incident_comments
  FOR SELECT TO authenticated USING (
    (is_internal = false AND EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_id AND ir.reporter_id = auth.uid()
    ))
    OR public.is_org_staff(org_id)
  );

CREATE POLICY inc_comments_insert ON public.incident_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_org_member(org_id)
    AND (
      is_internal = false
      OR public.is_org_staff(org_id)
    )
  );

-- Status history: staff only
CREATE POLICY inc_history_select ON public.incident_status_history
  FOR SELECT TO authenticated USING (public.is_org_staff(org_id));

CREATE POLICY inc_history_insert ON public.incident_status_history
  FOR INSERT TO authenticated WITH CHECK (
    changed_by = auth.uid()
    AND public.is_org_staff(org_id)
  );

-- Evidence: member uploads their own; staff see all
CREATE POLICY inc_evidence_select ON public.incident_evidence
  FOR SELECT TO authenticated USING (
    uploaded_by = auth.uid()
    OR public.is_org_staff(org_id)
  );

CREATE POLICY inc_evidence_insert ON public.incident_evidence
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid()
    AND public.is_active_org_member(org_id)
  );

-- ── 7. RPC: file_org_incident ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.file_org_incident(
  p_org_id            uuid,
  p_type              text,
  p_severity          text,
  p_title             text,
  p_description       text DEFAULT NULL,
  p_unit_number       text DEFAULT NULL,
  p_package_log_id    uuid DEFAULT NULL,
  p_due_date          timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unit_id   uuid;
  v_incident_id uuid;
BEGIN
  -- Verify caller is active member of this org
  IF NOT public.is_active_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Resolve unit_id from unit_number if provided
  IF p_unit_number IS NOT NULL THEN
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE org_id = p_org_id
      AND unit_number = p_unit_number
    LIMIT 1;
  END IF;

  INSERT INTO public.incident_reports (
    org_id, reporter_id, unit_id, package_log_id,
    type, severity, status, title, description, due_date
  )
  VALUES (
    p_org_id, auth.uid(), v_unit_id, p_package_log_id,
    p_type::public.incident_type,
    p_severity::public.incident_severity,
    'flagged',
    p_title, p_description, p_due_date
  )
  RETURNING id INTO v_incident_id;

  -- Log initial status history
  INSERT INTO public.incident_status_history (
    incident_id, org_id, changed_by, old_status, new_status, note
  ) VALUES (
    v_incident_id, p_org_id, auth.uid(), NULL, 'flagged', 'Incident filed'
  );

  RETURN v_incident_id;
END;
$$;

-- ── 8. RPC: update_incident_status_rpc ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_incident_status_rpc(
  p_incident_id       uuid,
  p_org_id            uuid,
  p_new_status        text,
  p_note              text DEFAULT NULL,
  p_assignee_id       uuid DEFAULT NULL,
  p_resolution_code   text DEFAULT NULL,
  p_resolution_notes  text DEFAULT NULL,
  p_escalation_target text DEFAULT NULL,
  p_escalation_note   text DEFAULT NULL,
  p_resident_update   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_status public.incident_status;
BEGIN
  IF NOT public.is_org_staff(p_org_id) THEN
    RAISE EXCEPTION 'Insufficient role to update incidents';
  END IF;

  SELECT status INTO v_old_status
  FROM public.incident_reports
  WHERE id = p_incident_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;

  UPDATE public.incident_reports SET
    status              = p_new_status::public.incident_status,
    assignee_id         = COALESCE(p_assignee_id, assignee_id),
    resolution_code     = CASE
                            WHEN p_resolution_code IS NOT NULL
                            THEN p_resolution_code::public.incident_resolution_code
                            ELSE resolution_code
                          END,
    resolution_notes    = COALESCE(p_resolution_notes, resolution_notes),
    escalation_target   = COALESCE(p_escalation_target, escalation_target),
    escalation_note     = COALESCE(p_escalation_note, escalation_note),
    resident_visible_update = COALESCE(p_resident_update, resident_visible_update),
    closed_at           = CASE
                            WHEN p_new_status IN ('resolved', 'closed') THEN now()
                            ELSE closed_at
                          END
  WHERE id = p_incident_id AND org_id = p_org_id;

  INSERT INTO public.incident_status_history (
    incident_id, org_id, changed_by, old_status, new_status, note
  ) VALUES (
    p_incident_id, p_org_id, auth.uid(),
    v_old_status, p_new_status::public.incident_status, p_note
  );
END;
$$;

-- ── 9. RPC: get_org_incidents ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_incidents(
  p_org_id   uuid,
  p_status   text DEFAULT NULL,    -- NULL = all open statuses
  p_severity text DEFAULT NULL,
  p_limit    int  DEFAULT 50,
  p_offset   int  DEFAULT 0
)
RETURNS TABLE (
  id                  uuid,
  org_id              uuid,
  unit_id             uuid,
  unit_number         text,
  reporter_id         uuid,
  reporter_name       text,
  assignee_id         uuid,
  assignee_name       text,
  package_log_id      uuid,
  related_incident_id uuid,
  type                text,
  severity            text,
  status              text,
  title               text,
  description         text,
  resident_visible_update text,
  resolution_code     text,
  due_date            timestamptz,
  closed_at           timestamptz,
  escalation_target   text,
  trend_tags          text[],
  comment_count       bigint,
  evidence_count      bigint,
  created_at          timestamptz,
  updated_at          timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Require staff to see all; residents get own incidents only
  IF NOT public.is_org_staff(p_org_id) THEN
    RETURN QUERY
      SELECT
        ir.id, ir.org_id, ir.unit_id,
        u.unit_number,
        ir.reporter_id,
        COALESCE(rp.display_name, 'Unknown') AS reporter_name,
        ir.assignee_id,
        COALESCE(ap.display_name, NULL) AS assignee_name,
        ir.package_log_id, ir.related_incident_id,
        ir.type::text, ir.severity::text, ir.status::text,
        ir.title, ir.description, ir.resident_visible_update,
        ir.resolution_code::text,
        ir.due_date, ir.closed_at, ir.escalation_target, ir.trend_tags,
        (SELECT COUNT(*) FROM public.incident_comments ic
         WHERE ic.incident_id = ir.id AND ic.is_internal = false),
        (SELECT COUNT(*) FROM public.incident_evidence ie WHERE ie.incident_id = ir.id),
        ir.created_at, ir.updated_at
      FROM public.incident_reports ir
      LEFT JOIN public.units u ON u.id = ir.unit_id
      LEFT JOIN public.profiles rp ON rp.id = ir.reporter_id
      LEFT JOIN public.profiles ap ON ap.id = ir.assignee_id
      WHERE ir.org_id = p_org_id
        AND ir.reporter_id = auth.uid()
        AND (p_status IS NULL OR ir.status::text = p_status)
      ORDER BY ir.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Staff: see all org incidents with optional filters
  RETURN QUERY
    SELECT
      ir.id, ir.org_id, ir.unit_id,
      u.unit_number,
      ir.reporter_id,
      COALESCE(rp.display_name, 'Unknown') AS reporter_name,
      ir.assignee_id,
      COALESCE(ap.display_name, NULL) AS assignee_name,
      ir.package_log_id, ir.related_incident_id,
      ir.type::text, ir.severity::text, ir.status::text,
      ir.title, ir.description, ir.resident_visible_update,
      ir.resolution_code::text,
      ir.due_date, ir.closed_at, ir.escalation_target, ir.trend_tags,
      (SELECT COUNT(*) FROM public.incident_comments ic WHERE ic.incident_id = ir.id),
      (SELECT COUNT(*) FROM public.incident_evidence ie WHERE ie.incident_id = ir.id),
      ir.created_at, ir.updated_at
    FROM public.incident_reports ir
    LEFT JOIN public.units u ON u.id = ir.unit_id
    LEFT JOIN public.profiles rp ON rp.id = ir.reporter_id
    LEFT JOIN public.profiles ap ON ap.id = ir.assignee_id
    WHERE ir.org_id = p_org_id
      AND (
        p_status IS NULL
        OR (p_status = 'open' AND ir.status IN ('flagged', 'intake', 'investigating'))
        OR ir.status::text = p_status
      )
      AND (p_severity IS NULL OR ir.severity::text = p_severity)
    ORDER BY
      -- Critical + overdue first, then by created_at
      CASE ir.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      ir.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ── 10. RPC: get_incident_counts ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_incident_counts(p_org_id uuid)
RETURNS TABLE (
  open_count       bigint,
  escalated_count  bigint,
  overdue_count    bigint,
  unassigned_count bigint,
  flagged_count    bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_staff(p_org_id) THEN
    RAISE EXCEPTION 'Insufficient role';
  END IF;

  RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE status IN ('flagged', 'intake', 'investigating')),
      COUNT(*) FILTER (WHERE status = 'escalated'),
      COUNT(*) FILTER (
        WHERE status NOT IN ('resolved', 'closed')
          AND due_date IS NOT NULL
          AND due_date < now()
      ),
      COUNT(*) FILTER (
        WHERE status NOT IN ('resolved', 'closed')
          AND assignee_id IS NULL
      ),
      COUNT(*) FILTER (WHERE status = 'flagged')
    FROM public.incident_reports
    WHERE org_id = p_org_id;
END;
$$;

-- ── 11. RPC: assign_incident ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_incident(
  p_incident_id uuid,
  p_org_id      uuid,
  p_assignee_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_staff(p_org_id) THEN
    RAISE EXCEPTION 'Insufficient role';
  END IF;

  UPDATE public.incident_reports
  SET assignee_id = p_assignee_id,
      status = CASE WHEN status = 'flagged' THEN 'intake' ELSE status END
  WHERE id = p_incident_id AND org_id = p_org_id;

  INSERT INTO public.incident_status_history (
    incident_id, org_id, changed_by, old_status, new_status, note
  )
  SELECT
    p_incident_id, p_org_id, auth.uid(),
    status,
    CASE WHEN status = 'flagged' THEN 'intake' ELSE status END,
    'Assigned to staff'
  FROM public.incident_reports
  WHERE id = p_incident_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grant execute to authenticated role
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.file_org_incident TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_incident_status_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_incidents TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incident_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_incident TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_org_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_staff TO authenticated;
