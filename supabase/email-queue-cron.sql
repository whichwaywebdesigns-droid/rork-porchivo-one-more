-- ============================================================
-- PORCHIVO: Email Queue Drainer (pg_cron)
-- Run this in Supabase SQL Editor AFTER email-queue-migration.sql
-- and welcome-email-trigger.sql.
-- ============================================================
-- Drains the durable email_queue automatically. Without this schedule the
-- queue fills (welcome emails, etc.) but never sends — the `send-email` Edge
-- Function's `process` action has to be invoked on a timer, and pg_cron is that
-- timer.
--
-- Flow:
--   pg_cron (every minute)  →  pg_net POST send-email (action=process)
--                           →  claims a batch  →  Resend  →  marks sent/failed.
--
-- Config: reuses the same public.app_config rows the welcome trigger uses, so
-- the function URL and shared secret live in exactly one place:
--
--     insert into public.app_config (key, value) values
--       ('functions_base_url', 'https://<your-ref>.supabase.co/functions/v1'),
--       ('email_fn_secret',    '<EMAIL_FN_SECRET>')
--     on conflict (key) do update set value = excluded.value;
--
-- PREREQUISITES:
--   1. pg_cron extension enabled (Database → Extensions → pg_cron).
--   2. pg_net extension enabled (already required by the welcome trigger).
--   3. public.app_config populated with functions_base_url + email_fn_secret.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ── Drainer function ────────────────────────────────────────────────────────
-- Reads the function URL + secret from app_config and POSTs a single `process`
-- request. Wrapped so a transient failure never errors the cron run (which would
-- otherwise spam the cron.job_run_details log). Skips silently until configured.
create or replace function public.drain_email_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret   text;
begin
  select value into v_base_url from public.app_config where key = 'functions_base_url';
  select value into v_secret   from public.app_config where key = 'email_fn_secret';

  -- Not configured yet → nothing to do.
  if v_base_url is null or v_secret is null then
    return;
  end if;

  begin
    perform net.http_post(
      url     := v_base_url || '/send-email',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-email-secret', v_secret
      ),
      body    := jsonb_build_object('action', 'process')
    );
  exception when others then
    raise warning 'drain_email_queue: process call failed (%):', sqlerrm;
  end;
end;
$$;

revoke all on function public.drain_email_queue() from public, anon, authenticated;

-- ── Schedule: every minute ──────────────────────────────────────────────────
-- Idempotent: unschedule any prior definition before (re)creating it so this
-- file is safe to re-run.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'drain-email-queue') then
    perform cron.unschedule('drain-email-queue');
  end if;

  perform cron.schedule(
    'drain-email-queue',
    '* * * * *',
    $cron$ select public.drain_email_queue(); $cron$
  );
end $$;

-- ── Verification ────────────────────────────────────────────────────────────
-- Run after applying. Expect one active row: jobname 'drain-email-queue',
-- schedule '* * * * *', active = true. If no rows, the schedule did not register.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'drain-email-queue';

-- Recent run history (last 5) — confirms the job is actually firing and whether
-- each run succeeded. status 'succeeded' = cron invoked the drainer cleanly.
select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'drain-email-queue')
order by start_time desc
limit 5;
