-- ============================================================================
-- ONBOARDING REMINDER MIGRATION (2026-10-01)
-- ============================================================================
-- "Finish setting up" email — v1. One behavioral nudge for abandoned signups:
--   fired 24h+ after signup ONLY if the user never completed onboarding
--   (no analytics_events row with event = 'onboarding_complete').
--
-- Design (mirrors the established scheduled-job pattern):
--   • Daily pg_cron job 'email-onboarding-reminder' at 15:25 UTC (after the
--     15:00/15:10/15:20 cluster, before safety-digest Monday 14:00 concerns
--     nothing — different slot).
--   • Goes through enqueue_template_email() like every other email: dedupe,
--     reference numbers, footer, marketing opt-outs, daily cap all inherited.
--   • PERMANENT dedupe key 'onboard-reminder:<user_id>' — one reminder ever,
--     even if the user completes onboarding and re-abandons later.
--   • Category 'marketing' — respects one-click opt-outs (the right call for
--     a nudge; security/billing classes are the only ones that may ignore).
--   • Spanish: 'onboarding-reminder' is deliberately NOT added to
--     resend_template_es_alias() — Spanish recipients fall back to the
--     English template (same rule as milestone until ES is published).
--   • Deep-link CTA lands on /app/onboarding-setup (routeAccess: 'free'),
--     which the marketing shell forwards via pv_deep and webDeepLink.ts
--     reconstructs pre-boot; the sessionStorage fallback survives the login
--     redirect, so logged-out users resume setup after magic-link sign-in.
--
-- ⚠️ DEPLOY GATE — SATISFIED 2026-10-02:
--   1. Email copy approved by the owner (with Resend-required edits:
--      UPPERCASE vars, name-free subject, "a few minutes").
--   2. Template PUBLISHED in Resend: "Porchivo — Finish setup",
--      UUID d7026d98-0224-408a-8658-b59fda594457 (used below).
--      Resend alias is porchivo-finish-setup — irrelevant to this pipeline:
--      sends go by template UUID, never alias. Publish warnings (From not
--      set, SETUP_URL no fallback, button href "invalid link") are expected:
--      send-email supplies From, the job always sends SETUP_URL, and the
--      href is substituted at send time like every other template's CTA.
-- ============================================================================

-- ── 1. Template map — extend the canonical resend_template_id() ────────────
-- Recreation of the live mapping (master-deploy.sql, incl. package-missing
-- from package-incident-email-split-migration.sql) + the new slug.
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
    when 'onboarding-reminder'           then 'd7026d98-0224-408a-8658-b59fda594457'
    else null end
$$;

-- ── 2. The job ──────────────────────────────────────────────────────────────
create or replace function public.run_onboarding_reminder_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_u record;
  v_sent int := 0;
begin
  for v_u in
    select p.id, p.email, p.name
    from public.profiles p
    where p.deletion_requested_at is null
      and p.email like '%@%'
      -- 24h delay after signup, capped at 30 days so ancient signups are
      -- never nagged (dedupe is permanent anyway; this keeps the scan small)
      and p.created_at <  now() - interval '24 hours'
      and p.created_at >  now() - interval '30 days'
      -- never completed onboarding (the activation event from the app)
      and not exists (
        select 1 from public.analytics_events ae
        where ae.user_id = p.id and ae.event = 'onboarding_complete'
      )
      -- belt-and-suspenders: anyone who logged a package doesn't need it
      and not exists (
        select 1 from public.shipments s where s.homeowner_id = p.id
      )
    order by p.created_at asc
    limit 100  -- stays under DAILY_EMAIL_CAP (100) even on a full first run
  loop
    begin
      perform public.enqueue_template_email(
        'onboarding-reminder', v_u.email, v_u.id, 'marketing',
        'onboard-reminder:' || v_u.id::text,   -- permanent: once, ever
        -- Resend templates require UPPERCASE variable keys (FIRST_NAME is
        -- reserved there), and the RECIPIENT_NAME dashboard fallback is 'there'.
        -- nullif handles empty-string names, not just NULL ones.
        jsonb_build_object(
          'RECIPIENT_NAME', coalesce(nullif(split_part(coalesce(v_u.name, ''), ' ', 1), ''), 'there'),
          'SETUP_URL',      public.email_web_base() || '/app/onboarding-setup'
        ),
        'profiles', v_u.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'onboard-reminder %: %', v_u.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

revoke all on function public.run_onboarding_reminder_job() from public, anon, authenticated;

-- ── 3. Schedule (idempotent) ────────────────────────────────────────────────
do $$
begin
  begin
    perform cron.unschedule('email-onboarding-reminder');
  exception when others then null;  -- first run: job doesn't exist yet
  end;
  perform cron.schedule('email-onboarding-reminder', '25 15 * * *',
    $$select public.run_onboarding_reminder_job()$$);
end $$;

-- ── 4. Verify (run manually after deploy) ───────────────────────────────────
-- Who WOULD get the email right now (dry run — no writes):
--   select p.email, p.created_at from public.profiles p
--   where p.deletion_requested_at is null and p.email like '%@%'
--     and p.created_at <  now() - interval '24 hours'
--     and p.created_at >  now() - interval '30 days'
--     and not exists (select 1 from public.analytics_events ae
--                     where ae.user_id = p.id and ae.event = 'onboarding_complete')
--     and not exists (select 1 from public.shipments s where s.homeowner_id = p.id)
--   order by p.created_at asc limit 100;
--
-- Force one job run and see the count:
--   select public.run_onboarding_reminder_job();
--
-- Cron + queue health:
--   select jobname, schedule, active from cron.job where jobname = 'email-onboarding-reminder';
--   select status, count(*) from email_queue group by status;
--
-- To pause the job later:
--   select cron.unschedule('email-onboarding-reminder');
