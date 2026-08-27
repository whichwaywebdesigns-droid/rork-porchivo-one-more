-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Activity / Audit History · Migration
-- Phase 10 — additive; no existing tables modified
--
-- Creates:
--   org_audit_log            — timestamped community action log
--   log_org_action()         — security-definer helper for RPCs to call
--   trg_audit_*              — triggers on memberships, packages, announcements,
--                              incidents, and properties
--   get_org_audit_log()      — paginated, filterable log RPC (staff-gated)
--   get_org_audit_summary()  — 30-day entity-type counts for dashboard strip
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Audit log table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name    TEXT        NOT NULL DEFAULT 'System',
  action_type   TEXT        NOT NULL,
  -- entity_type: 'member' | 'package' | 'announcement' | 'incident' | 'property' | 'unit' | 'role' | 'org'
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT,
  entity_label  TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_log_org_created
  ON public.org_audit_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_audit_log_entity_type
  ON public.org_audit_log(org_id, entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_audit_log_actor
  ON public.org_audit_log(actor_id, created_at DESC);

ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff / admin / board can read the log for their org
DROP POLICY IF EXISTS "org_staff_read_audit_log" ON public.org_audit_log;
CREATE POLICY "org_staff_read_audit_log"
  ON public.org_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id  = auth.uid()
        AND m.org_id   = public.org_audit_log.org_id
        AND m.status   = 'active'
        AND m.role     IN ('hoa_admin','property_manager','property_staff','super_admin','board_member')
    )
  );

-- Audit rows are written ONLY via the SECURITY DEFINER function log_org_action,
-- which bypasses RLS. No client INSERT policy exists: a permissive policy here
-- would let any authenticated user forge audit entries, destroying the audit
-- trail's evidentiary value. (Drops the old permissive policy on upgrade.)
DROP POLICY IF EXISTS "service_insert_audit_log" ON public.org_audit_log;

-- ── 2. Helper: log_org_action ─────────────────────────────────────────────────
-- Called by triggers and RPCs to write a single audit event.
-- Resolves the actor's display name from profiles so triggers don't need to.

CREATE OR REPLACE FUNCTION public.log_org_action(
  p_org_id       uuid,
  p_actor_id     uuid,
  p_action_type  text,
  p_entity_type  text,
  p_entity_id    text    DEFAULT NULL,
  p_entity_label text    DEFAULT NULL,
  p_metadata     jsonb   DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
BEGIN
  SELECT COALESCE(NULLIF(name, ''), 'Unknown')
    INTO v_actor_name
    FROM profiles
   WHERE id = p_actor_id;

  INSERT INTO public.org_audit_log (
    org_id, actor_id, actor_name,
    action_type, entity_type, entity_id, entity_label, metadata
  ) VALUES (
    p_org_id,
    p_actor_id,
    COALESCE(v_actor_name, 'System'),
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_entity_label,
    COALESCE(p_metadata, '{}')
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit logging should never block the primary operation
  NULL;
END;
$$;

-- ── 3. Trigger: org_memberships ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action      text;
  v_member_name text;
BEGIN
  SELECT COALESCE(NULLIF(name, ''), 'Unknown')
    INTO v_member_name
    FROM profiles
   WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'member_joined';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'active' THEN
      v_action := 'member_approved';
    ELSIF NEW.status = 'suspended'   THEN v_action := 'member_suspended';
    ELSIF OLD.status = 'suspended'
       AND NEW.status = 'active'     THEN v_action := 'member_reinstated';
    ELSIF NEW.status = 'removed'     THEN v_action := 'member_removed';
    ELSIF OLD.role   != NEW.role     THEN v_action := 'role_assigned';
    ELSE RETURN NEW;
    END IF;
  END IF;

  PERFORM public.log_org_action(
    p_org_id       := NEW.org_id,
    p_actor_id     := auth.uid(),
    p_action_type  := v_action,
    p_entity_type  := 'member',
    p_entity_id    := NEW.user_id::text,
    p_entity_label := v_member_name,
    p_metadata     := jsonb_build_object(
      'role',    NEW.role,
      'status',  NEW.status,
      'unit_id', NEW.unit_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_membership_changes ON public.org_memberships;
CREATE TRIGGER audit_membership_changes
  AFTER INSERT OR UPDATE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_membership();

-- ── 4. Trigger: package_log_items ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action   text;
  v_unit_num text;
BEGIN
  SELECT unit_number INTO v_unit_num
    FROM public.units
   WHERE id = COALESCE(NEW.unit_id, OLD.unit_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'package_logged';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'exception' THEN
      v_action := 'package_exception_flagged';
    ELSE
      v_action := 'package_status_updated';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.log_org_action(
    p_org_id       := NEW.org_id,
    p_actor_id     := auth.uid(),
    p_action_type  := v_action,
    p_entity_type  := 'package',
    p_entity_id    := NEW.id::text,
    p_entity_label := COALESCE(v_unit_num, 'Unassigned'),
    p_metadata     := jsonb_build_object(
      'carrier',     NEW.carrier,
      'status',      NEW.status,
      'old_status',  CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      'tracking',    NEW.tracking_number
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_package_changes ON public.package_log_items;
CREATE TRIGGER audit_package_changes
  AFTER INSERT OR UPDATE ON public.package_log_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_package();

-- ── 5. Trigger: org_announcements ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_org_action(
      p_org_id       := NEW.org_id,
      p_actor_id     := auth.uid(),
      p_action_type  := 'announcement_posted',
      p_entity_type  := 'announcement',
      p_entity_id    := NEW.id::text,
      p_entity_label := NEW.title,
      p_metadata     := jsonb_build_object(
        'priority', NEW.priority,
        'category', NEW.category
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_announcement_insert ON public.org_announcements;
CREATE TRIGGER audit_announcement_insert
  AFTER INSERT ON public.org_announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_announcement();

-- ── 6. Trigger: incident_reports ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'incident_filed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    CASE NEW.status::text
      WHEN 'investigating' THEN v_action := 'incident_assigned';
      WHEN 'escalated'     THEN v_action := 'incident_escalated';
      WHEN 'resolved'      THEN v_action := 'incident_resolved';
      WHEN 'closed'        THEN v_action := 'incident_closed';
      ELSE                      v_action := 'incident_status_changed';
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.log_org_action(
    p_org_id       := NEW.org_id,
    p_actor_id     := auth.uid(),
    p_action_type  := v_action,
    p_entity_type  := 'incident',
    p_entity_id    := NEW.id::text,
    p_entity_label := NEW.title,
    p_metadata     := jsonb_build_object(
      'incident_type', NEW.incident_type,
      'severity',      NEW.severity,
      'status',        NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_incident_changes ON public.incident_reports;
CREATE TRIGGER audit_incident_changes
  AFTER INSERT OR UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_incident();

-- ── 7. Trigger: properties ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_org_action(
      p_org_id       := NEW.org_id,
      p_actor_id     := auth.uid(),
      p_action_type  := 'property_created',
      p_entity_type  := 'property',
      p_entity_id    := NEW.id::text,
      p_entity_label := NEW.name,
      p_metadata     := '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_property_insert ON public.properties;
CREATE TRIGGER audit_property_insert
  AFTER INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_property();

-- ── 8. Trigger: units ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_audit_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'unit_created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'unit_removed';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.log_org_action(
    p_org_id       := COALESCE(NEW.org_id, OLD.org_id),
    p_actor_id     := auth.uid(),
    p_action_type  := v_action,
    p_entity_type  := 'unit',
    p_entity_id    := COALESCE(NEW.id, OLD.id)::text,
    p_entity_label := COALESCE(NEW.unit_number, OLD.unit_number),
    p_metadata     := '{}'::jsonb
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_unit_changes ON public.units;
CREATE TRIGGER audit_unit_changes
  AFTER INSERT OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_unit();

-- ── 9. RPC: get_org_audit_log ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_audit_log(
  p_org_id      uuid,
  p_limit       int  DEFAULT 50,
  p_offset      int  DEFAULT 0,
  p_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  actor_id      uuid,
  actor_name    text,
  action_type   text,
  entity_type   text,
  entity_id     text,
  entity_label  text,
  metadata      jsonb,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = auth.uid()
      AND org_id  = p_org_id
      AND status  = 'active'
      AND role    IN ('hoa_admin','property_manager','property_staff','super_admin','board_member')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_id,
    al.actor_name,
    al.action_type,
    al.entity_type,
    al.entity_id,
    al.entity_label,
    al.metadata,
    al.created_at
  FROM public.org_audit_log al
  WHERE al.org_id = p_org_id
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
  ORDER BY al.created_at DESC
  LIMIT  LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;

-- ── 10. RPC: get_org_audit_summary ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_audit_summary(p_org_id uuid)
RETURNS TABLE (
  entity_type  text,
  action_count bigint,
  last_action  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = auth.uid()
      AND org_id  = p_org_id
      AND status  = 'active'
      AND role    IN ('hoa_admin','property_manager','property_staff','super_admin','board_member')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    al.entity_type,
    COUNT(*)::bigint        AS action_count,
    MAX(al.created_at)      AS last_action
  FROM public.org_audit_log al
  WHERE al.org_id    = p_org_id
    AND al.created_at >= now() - interval '30 days'
  GROUP BY al.entity_type
  ORDER BY action_count DESC;
END;
$$;
