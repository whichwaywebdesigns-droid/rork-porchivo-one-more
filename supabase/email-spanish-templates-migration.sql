-- ═══════════════════════════════════════════════════════════════════════════
-- EMAIL SPANISH TEMPLATES MIGRATION (2026-09-12)
-- ═══════════════════════════════════════════════════════════════════════════
-- Locale-aware Resend template resolution for the Porchivo email pipeline.
--
-- What it does:
--   1. profiles.preferred_language  — 'en' | 'es', default 'en' (additive).
--   2. resend_template_es_alias()   — internal slug → published Spanish
--      Resend template alias (English alias + '-espanol', per the work-order
--      mapping table; legacy English '-1' suffixes dropped).
--   3. enqueue_template_email() recreated to resolve the recipient's language
--      (by user id, falling back to email) and send the Spanish alias for
--      'es' recipients — falling back to the English template whenever the
--      event has no Spanish mapping.
--
-- Why aliases, not UUIDs: Resend's send API accepts the template alias
-- anywhere it accepts the UUID (docs: "the id or the alias of the published
-- template"). All 36 Spanish templates are PUBLISHED except
-- 'milestone-email-espanol' (still Draft — milestone is deliberately NOT in
-- the map, so Spanish recipients keep getting the English milestone email
-- until the owner confirms publication and it gets added to the map).
--
-- Callers: unchanged. All call sites (DB triggers, pg_cron jobs, stripe-webhook
-- via emailService.ts) already funnel through enqueue_template_email(), which
-- is the single interception point. The send-email drainer is unchanged (it
-- sends metadata->>'template_id' verbatim, alias or UUID).
--
-- Fallback rule (general, not milestone-specific): any slug missing from the
-- Spanish map, or any non-'es' language, resolves to the English template.
--
-- Resend housekeeping (not a code change): the orphaned English draft
-- 'High Risk Alert in Your Area (Copy)' (alias high-risk-alert-in-your-area-copy)
-- should be deleted in the Resend dashboard — it is referenced nowhere.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Locale field ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists preferred_language text not null default 'en';

-- Keep values constrained (en/es only) — re-adding is a no-op if present.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_preferred_language_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_preferred_language_check
      check (preferred_language in ('en', 'es'));
  end if;
end $$;

comment on column public.profiles.preferred_language is
  'Email locale: en | es. Synced from the in-app language toggle; defaults to en. Spanish emails use the published -espanol Resend templates (milestone falls back to English until milestone-email-espanol is published).';

-- ── 2. Spanish alias map (internal slug → Resend alias) ─────────────────────
-- Resend aliases are the English alias + '-espanol' (legacy '-1' suffixes
-- dropped), exactly as published. 'milestone' intentionally absent —
-- milestone-email-espanol is still Draft in Resend.
create or replace function public.resend_template_es_alias(p_slug text)
returns text language sql immutable as $$
  select case p_slug
    when 'account-deletion-confirmation' then 'account-deletion-confirmation-espanol'
    when 'partner-request-received'      then 'porch-partner-request-received-espanol'
    when 'partner-request-accepted'      then 'porch-partner-request-accepted-espanol'
    when 'partner-request-declined'      then 'porch-partner-request-declined-espanol'
    when 'added-as-partner'              then 'youve-been-added-as-a-porch-partner-espanol'
    when 'high-risk-alert'               then 'high-risk-alert-in-your-area-espanol'
    when 'suspicious-activity'           then 'suspicious-activity-reported-near-you-espanol'
    when 'safety-digest'                 then 'neighborhood-safety-digest-espanol'
    when 'subscription-started'          then 'subscription-started-upgraded-espanol'
    when 'member-joined'                 then 'new-member-joined-your-community-espanol'
    when 'admin-invitation'              then 'community-admin-invitation-espanol'
    when 're-engagement'                 then 're-engagement-espanol'
    when 'referral-reward'               then 'referral-reward-confirmation-espanol'
    when 'app-update'                    then 'app-update-new-feature-announcement-espanol'
    when 'hoa-pilot-welcome'             then 'hoa-pilot-welcome-espanol'
    when 'review-request'                then 'review-request-espanol'
    when 'package-arriving'              then 'package-arriving-today-espanol'
    when 'package-picked-up'             then 'package-picked-up-by-porch-partner-espanol'
    when 'package-at-risk'               then 'package-left-too-long-at-risk-alert-espanol'
    when 'package-stolen'                then 'package-reported-stolen-espanol'
    when 'package-missing'               then 'package-reported-missing-espanol'
    when 'theft-resolved'                then 'package-theft-resolved-recovered-espanol'
    else null end
$$;

-- ── 3. Recreate THE EMAIL SERVICE with locale resolution ────────────────────
-- Same signature and behavior as email-templates-migration.sql; only the
-- template resolution block changes (language lookup + es → Spanish alias).
create or replace function public.enqueue_template_email(
  p_slug         text,
  p_recipient    text,
  p_user_id      uuid,
  p_category     text,
  p_dedupe_key   text,
  p_variables    jsonb,
  p_source_table text default null,
  p_source_id    uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_template_id text;
  v_recipient   text := lower(trim(coalesce(p_recipient, '')));
  v_lang        text;
  v_token       text;
  v_opted_out   boolean := false;
  v_send_id     uuid;
  v_queue_id    uuid;
  v_ref         text;
  v_web         text;
  v_support     text;
  v_address     text;
begin
  -- Recipient's email locale: profile by user id, falling back to email
  -- (covers recipients recorded before their profile row, or admin invites).
  if p_user_id is not null then
    select preferred_language into v_lang
      from public.profiles where id = p_user_id;
  end if;
  if v_lang is null then
    select preferred_language into v_lang
      from public.profiles where email = v_recipient limit 1;
  end if;
  v_lang := coalesce(v_lang, 'en');

  -- Central resolver: es → published Spanish alias, else the English UUID.
  -- Any slug without a Spanish mapping (milestone, future events) falls
  -- back to English — the general safe-fallback rule, not a special case.
  v_template_id := case when v_lang = 'es'
    then coalesce(public.resend_template_es_alias(p_slug),
                  public.resend_template_id(p_slug))
    else public.resend_template_id(p_slug) end;

  if v_template_id is null then
    raise warning 'enqueue_template_email: unknown slug %', p_slug;
    return null;
  end if;
  if v_recipient = '' or position('@' in v_recipient) = 0 then
    return null;
  end if;

  -- Preferences row + unsubscribe token (created lazily)
  if p_user_id is not null then
    insert into public.email_preferences (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
    select unsubscribe_token, p_category in ('partners','packages','community','marketing')
             and case p_category
                   when 'partners'  then opt_out_partners
                   when 'packages'  then opt_out_packages
                   when 'community' then opt_out_community
                   when 'marketing' then opt_out_marketing
                   else false
                 end
      into v_token, v_opted_out
    from public.email_preferences where user_id = p_user_id;
    if v_opted_out then
      return null;  -- opted out: no send, no dedupe row (re-subscribing re-enables)
    end if;
  end if;

  select value into v_web     from public.app_config where key = 'web_base_url';
  select value into v_support from public.app_config where key = 'support_email';
  select value into v_address from public.app_config where key = 'company_address';

  -- Dedupe guard: the UNIQUE insert-or-skip
  insert into public.email_sends (
    template_slug, recipient, user_id, category, dedupe_key,
    reference_number, source_table, source_id
  ) values (
    p_slug, v_recipient, p_user_id, p_category, p_dedupe_key,
    'PV-' || upper(substr(replace(p_slug, '-', ''), 1, 8)) || '-'
      || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
    p_source_table, p_source_id
  )
  on conflict (dedupe_key) do nothing
  returning id into v_send_id;

  if v_send_id is null then
    return null;  -- already sent for this event
  end if;
  select reference_number into v_ref from public.email_sends where id = v_send_id;

  -- Queue insert. subject is a placeholder — template emails take Resend's
  -- template subject; the drainer branches on metadata->>'template_id'
  -- (now a UUID for en, or the published Spanish alias for es — Resend
  -- accepts either).
  insert into public.email_queue (
    recipient, subject, template, metadata
  ) values (
    v_recipient,
    '(Porchivo template: ' || p_slug || ' [' || v_lang || '])',
    'resend-template',
    jsonb_build_object(
      'slug', p_slug,
      'language', v_lang,
      'template_id', v_template_id,
      'email_send_id', v_send_id,
      'reference_number', v_ref,
      'category', p_category,
      'variables', coalesce(p_variables, '{}'::jsonb) || jsonb_build_object(
        'company_address', coalesce(v_address, 'Porchivo'),
        'support_email',   coalesce(v_support, 'support@porchivo.com'),
        'unsubscribe_url', coalesce(v_web, 'https://porchivo.com')
          || '/unsubscribe' || case when v_token is not null then '?token=' || v_token else '' end
      )
    )
  ) returning id into v_queue_id;

  update public.email_sends set queue_id = v_queue_id where id = v_send_id;
  return v_send_id;
end; $$;

revoke all on function public.enqueue_template_email(text, text, uuid, text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_template_email(text, text, uuid, text, text, jsonb, text, uuid) to service_role;
