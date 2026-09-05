-- ═══════════════════════════════════════════════════════════════════════════
-- package-incident-email-split-migration.sql
--
-- Splits the single "Package Reported Stolen" email into two distinct
-- states (per the 2026-09-05 email update):
--
--   1. Package Reported MISSING  (slug 'package-missing', Resend template
--      5e8ca4c5-cd80-47ed-a7b6-5bbb38df3fd9) — fires when a package incident
--      is reported (missing_package / delivered_not_found / misdelivered /
--      tampered) and cannot yet be confirmed stolen. Neutral/investigating
--      tone; includes investigation_status.
--
--   2. Package Reported STOLEN   (slug 'package-stolen', Resend template
--      ecca98b7-3a21-44de-9358-0578f4b952b4 — revised) — fires when the case
--      is confirmed stolen. Includes item_value.
--
-- Escalation: a missing case still unresolved 24h after creation is
-- auto-moved to status 'confirmed_stolen' by the new hourly pg_cron job
-- run_incident_escalation_job(); the status-change trigger then sends the
-- stolen email. Any manual move to 'confirmed_stolen' sends the same email
-- (dedupe key makes double-sends impossible).
--
-- Both templates CTA report_url → the same /reports/<id> case detail page.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. New status value: confirmed_stolen ───────────────────────────────────
DO $$ BEGIN
  ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'confirmed_stolen'
    AFTER 'escalated';
EXCEPTION WHEN others THEN raise warning 'incident_status: %', sqlerrm;
END $$;

-- ── 2. Template id map — add 'package-missing' (stolen id unchanged) ────────
create or replace function public.resend_template_id(p_slug text)
returns text language sql immutable as $$
  select case p_slug
    when 'account-deletion-confirmation' then '7b22e47a-d069-45ad-b6d7-4d999e6f17a3'
    when 'partner-request-received'      then 'f8489094-77b5-4c96-9d7f-b64a2083d466'
    when 'partner-request-accepted'      then 'cb59f4da-b96a-443d-902b-1754f22d5dd3'
    when 'partner-request-declined'      then '49e26a80-a801-41ae-9289-59c5abdfffb6'
    when 'added-as-partner'              then 'aa55c2e6-b724-4c1c-ab9c-842c511a1307'
    when 'high-risk-alert'               then 'b0ca0216-15f0-4ed8-8be5-df6902462239'
    when 'suspicious-activity'           then '816c7f3c-f73d-43e0-b1cd-014837a67b27'
    when 'safety-digest'                 then '15ceef92-b528-436a-97a4-b9e9c47c097f'
    when 'subscription-started'          then 'ab9dddf7-7a40-4bbb-9d18-3e23d2387ad2'
    when 'member-joined'                 then '4c0f785c-1735-4b65-b817-1cacfea7cc8d'
    when 'admin-invitation'              then '6c7e0d60-ecea-41de-9d9e-27ed68780c35'
    when 're-engagement'                 then '31742da1-b531-4e33-8389-098d686361a9'
    when 'referral-reward'               then '9384d07c-cae5-49cb-8a9e-002fb04599bb'
    when 'milestone'                     then '646531e9-4384-4ab5-8657-a6678f0bf71b'
    when 'app-update'                    then '8c5e6d78-155f-46ff-b673-0c9ca99ddfa4'
    when 'hoa-pilot-welcome'             then '26401046-4a64-4381-b48c-e5a6285af393'
    when 'review-request'                then 'ef78436a-6f95-4962-9995-ad7344114ab0'
    when 'package-arriving'              then '86bb7c58-e8d4-4e81-965f-ff665a583aee'
    when 'package-picked-up'             then '2b6c2547-5749-4d9a-83e8-9bb9dc8e5a7e'
    when 'package-at-risk'               then '4c30f947-fe0c-45a0-8fb0-5cb0025b28eb'
    when 'package-missing'               then '5e8ca4c5-cd80-47ed-a7b6-5bbb38df3fd9'
    when 'package-stolen'                then 'ecca98b7-3a21-44de-9358-0578f4b952b4'
    when 'theft-resolved'                then 'd26e7d14-c2bc-4575-9cb2-5ac7f146bd70'
    else null end
$$;

-- ── 3. Insert trigger: MISSING vs (already) STOLEN ──────────────────────────
create or replace function public.notify_incident_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record; v_item_name text; v_investigation text;
begin
  select id, name, email into v_reporter from public.profiles where id = new.reporter_id;
  if v_reporter.email is null or position('@' in v_reporter.email) = 0 then return new; end if;
  if new.package_log_id is not null then
    select coalesce(nullif(notes, ''), 'Your package') into v_item_name
    from public.package_log_items where id = new.package_log_id;
  end if;

  -- Reports that arrive already-confirmed stolen go straight to the stolen email.
  if new.status::text = 'confirmed_stolen' then
    begin
      perform public.enqueue_template_email(
        'package-stolen', v_reporter.email, v_reporter.id, 'security',
        'inc-esc:' || new.id::text,
        jsonb_build_object(
          'first_name',     coalesce(split_part(v_reporter.name, ' ', 1), 'there'),
          'item_name',      coalesce(v_item_name, 'Your package'),
          'last_seen_time', to_char(new.created_at, 'Mon DD at HH12:MI AM'),
          'report_id',      left(new.id::text, 8),
          'item_value',     '—',
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
        'first_name',           coalesce(split_part(v_reporter.name, ' ', 1), 'there'),
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

drop trigger if exists trg_incident_stolen on public.incident_reports;
drop trigger if exists trg_incident_reported on public.incident_reports;
drop function if exists public.notify_incident_stolen();
create trigger trg_incident_reported
  after insert on public.incident_reports
  for each row when (new.type in ('missing_package','delivered_not_found','misdelivered','tampered'))
  execute function public.notify_incident_reported();

-- ── 4. Update trigger: status → confirmed_stolen (manual or auto) ───────────
create or replace function public.notify_incident_confirmed_stolen()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record; v_item_name text;
begin
  select id, name, email into v_reporter from public.profiles where id = new.reporter_id;
  if v_reporter.email is null or position('@' in v_reporter.email) = 0 then return new; end if;
  if new.package_log_id is not null then
    select coalesce(nullif(notes, ''), 'Your package') into v_item_name
    from public.package_log_items where id = new.package_log_id;
  end if;
  begin
    perform public.enqueue_template_email(
      'package-stolen', v_reporter.email, v_reporter.id, 'security',
      'inc-esc:' || new.id::text,
      jsonb_build_object(
        'first_name',     coalesce(split_part(v_reporter.name, ' ', 1), 'there'),
        'item_name',      coalesce(v_item_name, 'Your package'),
        'last_seen_time', to_char(new.created_at, 'Mon DD at HH12:MI AM'),
        'report_id',      left(new.id::text, 8),
        'item_value',     '—',
        'report_url',     public.email_web_base() || '/reports/' || new.id::text
      ),
      'incident_reports', new.id
    );
  exception when others then raise warning 'notify_incident_confirmed_stolen: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_incident_confirmed_stolen on public.incident_reports;
create trigger trg_incident_confirmed_stolen
  after update on public.incident_reports
  for each row when (
    new.status::text = 'confirmed_stolen'
    and (old.status is null or old.status::text <> 'confirmed_stolen')
    and new.type in ('missing_package','delivered_not_found','misdelivered','tampered'))
  execute function public.notify_incident_confirmed_stolen();

-- ── 5. Escalation job: missing → confirmed_stolen after 24h unresolved ──────
-- Pure SQL; enqueues nothing itself — the update trigger sends the stolen
-- email when the status flips.
create or replace function public.run_incident_escalation_job()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select id, reporter_id, status
    from public.incident_reports
    where type in ('missing_package','delivered_not_found','misdelivered','tampered')
      and status in ('flagged','intake','investigating','escalated')
      and closed_at is null
      and created_at < now() - interval '24 hours'
  loop
    insert into public.incident_status_history
      (incident_id, org_id, changed_by, old_status, new_status, note)
    select v_row.id, r.org_id, r.reporter_id, v_row.status, 'confirmed_stolen',
           'Auto-escalated: missing case unresolved past 24 hours'
    from public.incident_reports r
    where r.id = v_row.id;

    update public.incident_reports
      set status = 'confirmed_stolen', updated_at = now()
    where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    raise notice 'run_incident_escalation_job: escalated % incident(s)', v_count;
  end if;
end; $$;

-- ── 6. pg_cron schedule (hourly at :30) ─────────────────────────────────────
do $job$ begin
  begin
    perform cron.unschedule('email-incident-escalation');
  exception when others then null;  -- first run: job not scheduled yet
  end;
  perform cron.schedule('email-incident-escalation', '30 * * * *',
    $$select public.run_incident_escalation_job()$$);
exception when others then raise warning 'cron schedule (incident escalation): %', sqlerrm;
end $job$;
