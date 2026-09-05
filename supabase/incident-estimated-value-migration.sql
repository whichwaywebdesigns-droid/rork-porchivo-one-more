-- ═══════════════════════════════════════════════════════════════════════════
-- incident-estimated-value-migration.sql
--
-- Wires real item_value into the "Package Reported Stolen" email:
--
--   1. incident_reports.estimated_value (numeric(12,2), nullable) — captured
--      by the resident when filing a package incident (USD).
--   2. file_org_incident() gains an optional p_estimated_value param
--      (appended, defaulted — existing callers unaffected).
--   3. Both stolen-email trigger functions (notify_incident_reported for
--      already-confirmed inserts, notify_incident_confirmed_stolen for
--      transitions) format item_value as '$1,234.56' from estimated_value,
--      falling back to '—' when the resident didn't provide one.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Column ────────────────────────────────────────────────────────────────
alter table public.incident_reports
  add column if not exists estimated_value numeric(12, 2);

comment on column public.incident_reports.estimated_value is
  'Resident-declared estimated value of the item (USD) at incident filing; feeds the item_value variable of the stolen-report email.';

-- ── 2. file_org_incident(): accept + persist the value ───────────────────────
create or replace function public.file_org_incident(
  p_org_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_description text default null,
  p_unit_number text default null,
  p_package_log_id uuid default null,
  p_due_date timestamptz default null,
  p_estimated_value numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
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
    type, severity, status, title, description, due_date, estimated_value
  )
  VALUES (
    p_org_id, auth.uid(), v_unit_id, p_package_log_id,
    p_type::public.incident_type,
    p_severity::public.incident_severity,
    'flagged',
    p_title, p_description, p_due_date,
    p_estimated_value
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
$function$;

-- ── 3. Insert trigger: real item_value for already-confirmed inserts ─────────
create or replace function public.notify_incident_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record; v_item_name text; v_investigation text; v_item_value text;
begin
  select id, name, email into v_reporter from public.profiles where id = new.reporter_id;
  if v_reporter.email is null or position('@' in v_reporter.email) = 0 then return new; end if;
  if new.package_log_id is not null then
    select coalesce(nullif(notes, ''), 'Your package') into v_item_name
    from public.package_log_items where id = new.package_log_id;
  end if;
  v_item_value := case
    when new.estimated_value is not null
      then '$' || to_char(new.estimated_value, 'FM999,999,990.00')
    else '—'
  end;

  -- Reports that arrive already-confirmed stolen go straight to the stolen email.
  if new.status::text = 'confirmed_stolen' then
    begin
      perform public.enqueue_template_email(
        'package-stolen', v_reporter.email, v_reporter.id, 'security',
        'inc-esc:' || new.id::text,
        jsonb_build_object(
          'first_name',     coalesce(nullif(split_part(v_reporter.name, ' ', 1), ''), 'there'),
          'item_name',      coalesce(v_item_name, 'Your package'),
          'last_seen_time', to_char(new.created_at, 'Mon DD at HH12:MI AM'),
          'report_id',      left(new.id::text, 8),
          'item_value',     v_item_value,
          'report_url',     public.email_web_base() || '/reports/' || new.id::text
        ),
        'incident_reports', new.id
      );
    exception when others then raise warning 'notify_incident_reported: %', sqlerrm;
    end;
    return new;
  end if;

  -- Otherwise this is a MISSING report — neutral, investigating tone.
  v_investigation := case
    when now() - new.created_at < interval '1 hour'  then 'Checking nearby cameras'
    when now() - new.created_at < interval '6 hours' then 'Reviewing delivery logs'
    else 'Awaiting your confirmation'
  end;

  begin
    perform public.enqueue_template_email(
      'package-missing', v_reporter.email, v_reporter.id, 'security',
      'inc-new:' || new.id::text,
      jsonb_build_object(
        'first_name',           coalesce(nullif(split_part(v_reporter.name, ' ', 1), ''), 'there'),
        'item_name',            coalesce(v_item_name, 'Your package'),
        'last_seen_time',       to_char(new.created_at, 'Mon DD at HH12:MI AM'),
        'report_id',            left(new.id::text, 8),
        'investigation_status', v_investigation,
        'report_url',           public.email_web_base() || '/reports/' || new.id::text
      ),
      'incident_reports', new.id
    );
  exception when others then raise warning 'notify_incident_reported: %', sqlerrm;
  end;
  return new;
end; $$;

-- ── 4. Update trigger: real item_value on confirmed-stolen transitions ───────
create or replace function public.notify_incident_confirmed_stolen()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record; v_item_name text; v_item_value text;
begin
  select id, name, email into v_reporter from public.profiles where id = new.reporter_id;
  if v_reporter.email is null or position('@' in v_reporter.email) = 0 then return new; end if;
  if new.package_log_id is not null then
    select coalesce(nullif(notes, ''), 'Your package') into v_item_name
    from public.package_log_items where id = new.package_log_id;
  end if;
  v_item_value := case
    when new.estimated_value is not null
      then '$' || to_char(new.estimated_value, 'FM999,999,990.00')
    else '—'
  end;
  begin
    perform public.enqueue_template_email(
      'package-stolen', v_reporter.email, v_reporter.id, 'security',
      'inc-esc:' || new.id::text,
      jsonb_build_object(
        'first_name',     coalesce(nullif(split_part(v_reporter.name, ' ', 1), ''), 'there'),
        'item_name',      coalesce(v_item_name, 'Your package'),
        'last_seen_time', to_char(new.created_at, 'Mon DD at HH12:MI AM'),
        'report_id',      left(new.id::text, 8),
        'item_value',     v_item_value,
        'report_url',     public.email_web_base() || '/reports/' || new.id::text
      ),
      'incident_reports', new.id
    );
  exception when others then raise warning 'notify_incident_confirmed_stolen: %', sqlerrm;
  end;
  return new;
end; $$;
