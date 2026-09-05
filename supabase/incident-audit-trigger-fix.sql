-- ═══════════════════════════════════════════════════════════════════════════
-- incident-audit-trigger-fix.sql
--
-- Fixes a critical pre-existing bug discovered while wiring item_value:
--
--   trg_audit_incident() referenced NEW.incident_type, but the column on
--   incident_reports is `type`. Because audit_incident_changes fires on
--   AFTER INSERT OR UPDATE, EVERY insert (and every status-changing update)
--   on incident_reports aborted with 42703 — silently breaking:
--     • the app's File Incident flow (file_org_incident RPC)
--     • the missing/stolen email triggers (trg_incident_reported /
--       trg_incident_confirmed_stolen — audit trigger fires first and
--       aborts the transaction before the email enqueues)
--     • the 24h auto-escalation job and the theft-resolved email
--   (The empty incident_reports table is the proof: zero successful
--   inserts since this trigger existed.)
--
--   Fix: NEW.incident_type → NEW.type. Trigger is only attached to
--   incident_reports (verified), so no other table is affected.
--
-- Also drops the now-superseded 8-arg overload of file_org_incident so a
-- single 9-arg function (with p_estimated_value) remains — existing 8-arg
-- callers resolve via the default.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Fix the audit trigger: NEW.incident_type → NEW.type ──────────────────
create or replace function public.trg_audit_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
      'incident_type', NEW.type,
      'severity',      NEW.severity,
      'status',        NEW.status
    )
  );

  RETURN NEW;
END;
$function$;

-- ── 2. Collapse file_org_incident to the single 9-arg signature ──────────────
drop function if exists public.file_org_incident(
  uuid, text, text, text, text, text, uuid, timestamp with time zone
);
