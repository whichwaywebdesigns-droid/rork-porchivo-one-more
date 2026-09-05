-- ============================================================
-- PORCHIVO: Resend Template Email Infrastructure (22 templates)
-- Run AFTER email-queue-migration.sql.
-- ============================================================
-- Wires Porchivo's 22 Resend templates to real triggers:
--   • enqueue_template_email()  — the SQL-side email service: per-category
--     preference check, dedupe guard (email_sends.dedupe_key UNIQUE),
--     reference-number generation, footer variable merge, queue insert.
--   • DB triggers on partner_connections / suspicious_alerts /
--     org_memberships / incident_reports / partner_assignments /
--     package_holds / shipments — the automatic event sources.
--   • Scheduled job RPCs (digest, at-risk, re-engagement, milestone,
--     review-request, risk-spike, arriving-today) + pg_cron schedules.
--   • Minimal referral program (profiles.referral_code + referrals table).
--
-- Variable names passed here MUST match the {{snake_case}} placeholders
-- baked into the Resend template HTML. Template ids live in
-- resend_template_id() below.
--
-- Email never blocks a write: every trigger body swallows its own errors.
-- ============================================================

-- ── 0. Config seeds (do not overwrite existing values) ──────────────────────
insert into public.app_config (key, value) values
  ('web_base_url',    'https://porchivo.com'),
  ('support_email',   'support@porchivo.com'),
  ('company_address', 'Porchivo')
on conflict (key) do nothing;

-- ── 1. email_preferences — per-category opt-outs + unsubscribe token ───────
-- security (account deletion, theft reports) and billing (subscription)
-- categories have no opt-out column: they always send.
create table if not exists public.email_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  unsubscribe_token  text not null unique default gen_random_uuid()::text,
  opt_out_partners   boolean not null default false,
  opt_out_packages   boolean not null default false,
  opt_out_community  boolean not null default false,
  opt_out_marketing  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

drop policy if exists "own email prefs" on public.email_preferences;
create policy "own email prefs" on public.email_preferences
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own email prefs update" on public.email_preferences;
create policy "own email prefs update" on public.email_preferences
  for update to authenticated using (auth.uid() = user_id);

-- ── 2. email_sends — send log + dedupe guard ────────────────────────────────
-- One row per (dedupe_key). dedupe_key is UNIQUE: the insert-or-skip IS the
-- dedupe. user_id is SET NULL on delete so the audit trail survives purges.
create table if not exists public.email_sends (
  id                uuid primary key default gen_random_uuid(),
  template_slug     text not null,
  recipient         text not null,
  user_id           uuid references public.profiles(id) on delete set null,
  category          text not null default 'community'
                      check (category in ('security','billing','partners','packages','community','marketing')),
  reference_number  text not null unique,
  dedupe_key        text not null unique,
  source_table      text,
  source_id         uuid,
  queue_id          uuid,
  status            text not null default 'queued'
                      check (status in ('queued','sent','failed')),
  provider_message_id text,
  error             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

create index if not exists idx_email_sends_slug_time
  on public.email_sends (template_slug, created_at desc);

-- ── 3. partner decline reason ────────────────────────────────────────────────
alter table public.partner_connections
  add column if not exists decline_reason text;

-- ── 4. Minimal referral program ─────────────────────────────────────────────
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
create unique index if not exists idx_profiles_referral_code on public.profiles (referral_code) where referral_code is not null;

create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  referred_id  uuid not null unique references public.profiles(id) on delete cascade,
  code         text not null,
  status       text not null default 'pending' check (status in ('pending','credited')),
  reward_type  text not null default 'account credit',
  reward_amount text not null default '$10',
  credited_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

-- Auto-assign a referral code to every new profile
create or replace function public.ensure_referral_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(md5(new.id::text || random()::text), 1, 8));
  end if;
  return new;
end; $$;

drop trigger if exists trg_ensure_referral_code on public.profiles;
create trigger trg_ensure_referral_code
  before insert on public.profiles
  for each row execute function public.ensure_referral_code();

-- Backfill codes for existing profiles
update public.profiles set referral_code = upper(substr(md5(id::text || random()::text), 1, 8))
where referral_code is null;

-- Caller applies someone's referral code (no-op if already referred / self)
create or replace function public.apply_referral_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_referrer public.profiles%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if exists (select 1 from public.referrals where referred_id = v_uid) then
    return jsonb_build_object('success', false, 'error', 'Already referred');
  end if;
  select * into v_referrer from public.profiles where referral_code = upper(trim(p_code)) and id <> v_uid;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Code not found');
  end if;
  update public.profiles set referred_by = v_referrer.id where id = v_uid;
  insert into public.referrals (referrer_id, referred_id, code)
  values (v_referrer.id, v_uid, upper(trim(p_code)))
  on conflict (referred_id) do nothing;
  return jsonb_build_object('success', true);
end; $$;

revoke all on function public.apply_referral_code(text) from public, anon;
grant execute on function public.apply_referral_code(text) to authenticated;

-- ── 5. Template id map (slugs → Resend template uuids) ──────────────────────
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
    when 'package-stolen'                then 'ecca98b7-3a21-44de-9358-0578f4b952b4'
    when 'theft-resolved'                then 'd26e7d14-c2bc-4575-9cb2-5ac7f146bd70'
    else null end
$$;

-- ── 6. THE EMAIL SERVICE (SQL side) ─────────────────────────────────────────
-- Steps: validate slug → resolve/create prefs (token) → category opt-out
-- check → dedupe guard → reference number → footer merge → queue insert.
-- Returns the email_sends id, or NULL when skipped / duplicate / opted out.
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
  v_token       text;
  v_opted_out   boolean := false;
  v_send_id     uuid;
  v_queue_id    uuid;
  v_ref         text;
  v_web         text;
  v_support     text;
  v_address     text;
begin
  v_template_id := public.resend_template_id(p_slug);
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
  -- template subject; the drainer branches on metadata->>'template_id'.
  insert into public.email_queue (
    recipient, subject, template, metadata
  ) values (
    v_recipient,
    '(Porchivo template: ' || p_slug || ')',
    'resend-template',
    jsonb_build_object(
      'slug', p_slug,
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

-- Drainer callbacks: keep email_sends in sync with queue outcomes
create or replace function public.mark_email_send_settled(p_queue_id uuid, p_ok boolean, p_message_id text default null, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_sends
  set status = case when p_ok then 'sent' else 'failed' end,
      provider_message_id = p_message_id,
      error = left(p_error, 1000),
      sent_at = case when p_ok then now() else sent_at end
  where queue_id = p_queue_id
    and status <> 'sent';
$$;

revoke all on function public.mark_email_send_settled(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.mark_email_send_settled(uuid, boolean, text, text) to service_role;

-- ── 7. Shared helpers for triggers ──────────────────────────────────────────
create or replace function public.email_web_base()
returns text language sql stable as $$
  select coalesce((select value from public.app_config where key = 'web_base_url'), 'https://porchivo.com')
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. AUTOMATIC TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

-- 8a. Partner request received → notify the partner ──────────────────────────
create or replace function public.notify_partner_request_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_partner record; v_homeowner record; v_open_ships int;
begin
  if new.status <> 'pending' then return new; end if;
  select id, name, email, address into v_partner from public.profiles where id = new.partner_id;
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  if v_partner.email is null or position('@' in v_partner.email) = 0 then return new; end if;
  select count(*) into v_open_ships from public.shipments
    where homeowner_id = new.homeowner_id and status in ('open','accepted');
  begin
    perform public.enqueue_template_email(
      'partner-request-received', v_partner.email, v_partner.id, 'partners',
      'ptnr-req:' || new.id::text,
      jsonb_build_object(
        'first_name',        coalesce(split_part(v_partner.name, ' ', 1), 'there'),
        'requester_name',    coalesce(nullif(v_homeowner.name, ''), 'A neighbor'),
        'requester_address', coalesce(nullif(v_homeowner.address, ''), 'Nearby'),
        'start_date',        to_char(new.requested_at, 'Mon DD, YYYY'),
        'end_date',          'Open-ended',
        'package_count',     v_open_ships::text,
        'request_url',       public.email_web_base() || '/partners'
      ),
      'partner_connections', new.id
    );
  exception when others then raise warning 'notify_partner_request_received: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_partner_request_received on public.partner_connections;
create trigger trg_partner_request_received
  after insert on public.partner_connections
  for each row when (new.status = 'pending')
  execute function public.notify_partner_request_received();

-- 8b. Partner accepted / declined ────────────────────────────────────────────
create or replace function public.notify_partner_connection_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record;
begin
  if old.status <> 'pending' then return new; end if;
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select id, name, email, address into v_partner  from public.profiles where id = new.partner_id;

  if new.status = 'active' then
    -- To the requester: request accepted
    if v_homeowner.email is not null and position('@' in v_homeowner.email) > 0 then
      begin
        perform public.enqueue_template_email(
          'partner-request-accepted', v_homeowner.email, v_homeowner.id, 'partners',
          'ptnr-acc:' || new.id::text,
          jsonb_build_object(
            'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
            'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your partner'),
            'partner_address', coalesce(nullif(v_partner.address, ''), 'Nearby'),
            'start_date',      to_char(coalesce(new.accepted_at, now()), 'Mon DD, YYYY'),
            'end_date',        'Open-ended',
            'coverage_url',    public.email_web_base() || '/partners'
          ),
          'partner_connections', new.id
        );
      exception when others then raise warning 'notify_partner_connection_status(accepted): %', sqlerrm;
      end;
    end if;
    -- To the partner: you've been added
    if v_partner.email is not null and position('@' in v_partner.email) > 0 then
      begin
        perform public.enqueue_template_email(
          'added-as-partner', v_partner.email, v_partner.id, 'partners',
          'ptnr-add:' || new.id::text,
          jsonb_build_object(
            'first_name',        coalesce(split_part(v_partner.name, ' ', 1), 'there'),
            'requester_name',    coalesce(nullif(v_homeowner.name, ''), 'A neighbor'),
            'requester_address', coalesce(nullif(v_homeowner.address, ''), 'Nearby'),
            'start_date',        to_char(coalesce(new.accepted_at, now()), 'Mon DD, YYYY'),
            'end_date',          'Open-ended',
            'settings_url',      public.email_web_base() || '/app'
          ),
          'partner_connections', new.id
        );
      exception when others then raise warning 'notify_partner_connection_status(added): %', sqlerrm;
      end;
    end if;

  elsif new.status in ('removed','paused') and new.decline_reason is not null then
    -- Declined with a reason → notify the requester
    if v_homeowner.email is not null and position('@' in v_homeowner.email) > 0 then
      begin
        perform public.enqueue_template_email(
          'partner-request-declined', v_homeowner.email, v_homeowner.id, 'partners',
          'ptnr-dec:' || new.id::text,
          jsonb_build_object(
            'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
            'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your neighbor'),
            'start_date',      to_char(new.requested_at, 'Mon DD, YYYY'),
            'end_date',        '—',
            'decline_reason',  new.decline_reason,
            'find_partner_url', public.email_web_base() || '/partners'
          ),
          'partner_connections', new.id
        );
      exception when others then raise warning 'notify_partner_connection_status(declined): %', sqlerrm;
      end;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_partner_connection_status on public.partner_connections;
create trigger trg_partner_connection_status
  after update on public.partner_connections
  for each row when (old.status = 'pending' and new.status <> 'pending')
  execute function public.notify_partner_connection_status();

-- 8c. Suspicious activity reported → notify same-community neighbors ─────────
create or replace function public.notify_suspicious_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record;
  v_rec record;
  v_category_label text;
begin
  select name, email into v_reporter from public.profiles where id = new.user_id;
  v_category_label := case new.category
    when 'suspicious_person' then 'suspicious person'
    when 'package_taken'     then 'package theft'
    when 'unknown_vehicle'   then 'unknown vehicle'
    else 'unusual activity' end;
  for v_rec in
    select distinct om.user_id, p.email, p.name
    from public.org_memberships om
    join public.profiles p on p.id = om.user_id
    where om.org_id in (
        select org_id from public.org_memberships
        where user_id = new.user_id and status = 'active')
      and om.status = 'active'
      and om.user_id <> new.user_id
      and p.email like '%@%'
    limit 100
  loop
    begin
      perform public.enqueue_template_email(
        'suspicious-activity', v_rec.email, v_rec.user_id, 'community',
        'susp:' || new.id::text || ':' || v_rec.user_id::text,
        jsonb_build_object(
          'first_name',           coalesce(split_part(v_rec.name, ' ', 1), 'there'),
          'location',             coalesce(nullif(new.approximate_location, ''), 'Your neighborhood'),
          'report_time',          to_char(new.created_at, 'Mon DD at HH12:MI AM'),
          'activity_description', v_category_label || coalesce(' — ' || nullif(new.description, ''), ''),
          'reporter_label',       coalesce(nullif(v_reporter.name, ''), 'A neighbor') || ' (verified neighbor)',
          'report_url',           public.email_web_base() || '/reports/' || new.id::text
        ),
        'suspicious_alerts', new.id
      );
    exception when others then raise warning 'notify_suspicious_alert: %', sqlerrm;
    end;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_suspicious_alert_email on public.suspicious_alerts;
create trigger trg_suspicious_alert_email
  after insert on public.suspicious_alerts
  for each row execute function public.notify_suspicious_alert();

-- 8d. New member joined an existing community → notify other members ─────────
create or replace function public.notify_org_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org record; v_member record; v_rec record; v_member_count int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  select name, admin_user_id into v_org from public.organizations where id = new.org_id;
  if v_org.admin_user_id = new.user_id then return new; end if;  -- org creator's own org
  select count(*) into v_member_count from public.org_memberships
    where org_id = new.org_id and status = 'active';
  if v_member_count < 2 then return new; end if;  -- not an existing community
  select name, email, address into v_member from public.profiles where id = new.user_id;
  for v_rec in
    select om.user_id, p.email, p.name
    from public.org_memberships om
    join public.profiles p on p.id = om.user_id
    where om.org_id = new.org_id and om.status = 'active'
      and om.user_id <> new.user_id and p.email like '%@%'
    limit 100
  loop
    begin
      perform public.enqueue_template_email(
        'member-joined', v_rec.email, v_rec.user_id, 'community',
        'join:' || new.id::text || ':' || v_rec.user_id::text,
        jsonb_build_object(
          'first_name',     coalesce(split_part(v_rec.name, ' ', 1), 'there'),
          'member_name',    coalesce(nullif(v_member.name, ''), 'A new neighbor'),
          'member_address', coalesce(nullif(v_member.address, ''), 'Your community'),
          'join_date',      to_char(coalesce(new.joined_at, now()), 'Mon DD, YYYY'),
          'community_name', v_org.name,
          'directory_url',  public.email_web_base() || '/app'
        ),
        'org_memberships', new.id
      );
    exception when others then raise warning 'notify_org_member_joined: %', sqlerrm;
    end;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_org_member_joined on public.org_memberships;
create trigger trg_org_member_joined
  after insert or update on public.org_memberships
  for each row execute function public.notify_org_member_joined();

-- 8e. Package reported stolen/missing → notify the reporter ──────────────────
create or replace function public.notify_incident_stolen()
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
      'inc-new:' || new.id::text,
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
  exception when others then raise warning 'notify_incident_stolen: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_incident_stolen on public.incident_reports;
create trigger trg_incident_stolen
  after insert on public.incident_reports
  for each row when (new.type in ('missing_package','delivered_not_found','misdelivered','tampered'))
  execute function public.notify_incident_stolen();

-- 8f. Theft resolved/recovered → notify the reporter ─────────────────────────
create or replace function public.notify_incident_resolved()
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
      'theft-resolved', v_reporter.email, v_reporter.id, 'security',
      'inc-res:' || new.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_reporter.name, ' ', 1), 'there'),
        'item_name',       coalesce(v_item_name, 'Your package'),
        'recovery_date',   to_char(coalesce(new.closed_at, now()), 'Mon DD, YYYY'),
        'recovery_source', coalesce(initcap(replace(new.resolution_code::text, '_', ' ')), 'Resolved'),
        'report_id',       left(new.id::text, 8),
        'close_report_url', public.email_web_base() || '/reports/' || new.id::text
      ),
      'incident_reports', new.id
    );
  exception when others then raise warning 'notify_incident_resolved: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_incident_resolved on public.incident_reports;
create trigger trg_incident_resolved
  after update on public.incident_reports
  for each row when (
    new.status in ('resolved','closed')
    and (old.status is null or old.status::text not in ('resolved','closed'))
    and new.type in ('missing_package','delivered_not_found','misdelivered','tampered'))
  execute function public.notify_incident_resolved();

-- 8g. Package picked up by Porch Partner (assignment goes active) ────────────
create or replace function public.notify_assignment_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record; v_item_name text;
begin
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select id, name, email, address into v_partner  from public.profiles where id = new.partner_id;
  if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then return new; end if;
  if new.shipment_id is not null then
    select coalesce(nullif(packages_expected, ''), 'Your package') into v_item_name
    from public.shipments where id = new.shipment_id;
  end if;
  begin
    perform public.enqueue_template_email(
      'package-picked-up', v_homeowner.email, v_homeowner.id, 'packages',
      'asg-act:' || new.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
        'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your Porch Partner'),
        'item_name',       coalesce(v_item_name, 'Your package'),
        'pickup_time',     to_char(now(), 'Mon DD at HH12:MI AM'),
        'partner_address', coalesce(nullif(v_partner.address, ''), 'Nearby'),
        'message_url',     public.email_web_base() || '/app'
      ),
      'partner_assignments', new.id
    );
  exception when others then raise warning 'notify_assignment_pickup: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_assignment_pickup on public.partner_assignments;
create trigger trg_assignment_pickup
  after update on public.partner_assignments
  for each row when (new.status = 'active' and coalesce(old.status,'') <> 'active')
  execute function public.notify_assignment_pickup();

-- 8h. Package hold picked up (second pickup path) ────────────────────────────
create or replace function public.notify_package_hold_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record;
begin
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select id, name, email, address into v_partner  from public.profiles where id = new.partner_id;
  if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then return new; end if;
  begin
    perform public.enqueue_template_email(
      'package-picked-up', v_homeowner.email, v_homeowner.id, 'packages',
      'hold-pu:' || new.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
        'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your Porch Partner'),
        'item_name',       'Package ' || left(new.package_id, 12),
        'pickup_time',     to_char(coalesce(new.picked_up_at, now()), 'Mon DD at HH12:MI AM'),
        'partner_address', coalesce(nullif(v_partner.address, ''), 'Nearby'),
        'message_url',     public.email_web_base() || '/app'
      ),
      'package_holds', new.id
    );
  exception when others then raise warning 'notify_package_hold_pickup: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_package_hold_pickup on public.package_holds;
create trigger trg_package_hold_pickup
  after update on public.package_holds
  for each row when (new.status = 'picked_up' and coalesce(old.status,'') <> 'picked_up')
  execute function public.notify_package_hold_pickup();

-- 8i. Referral credited on first verified activity (first shipment) ──────────
create or replace function public.credit_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_referral record; v_referrer record; v_referred record; v_total int;
begin
  select * into v_referral from public.referrals
    where referred_id = new.homeowner_id and status = 'pending'
    limit 1;
  if not found then return new; end if;
  select id, name, email into v_referrer from public.profiles where id = v_referral.referrer_id;
  select name, email into v_referred from public.profiles where id = new.homeowner_id;
  if v_referrer.email is null or position('@' in v_referrer.email) = 0 then return new; end if;
  update public.referrals set status = 'credited', credited_at = now() where id = v_referral.id;
  select count(*) into v_total from public.referrals
    where referrer_id = v_referral.referrer_id and status = 'credited';
  begin
    perform public.enqueue_template_email(
      'referral-reward', v_referrer.email, v_referrer.id, 'community',
      'ref:' || v_referral.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_referrer.name, ' ', 1), 'there'),
        'referred_name',   coalesce(nullif(v_referred.name, ''), 'Your friend'),
        'reward_amount',   v_referral.reward_amount,
        'reward_type',     v_referral.reward_type,
        'total_referrals', v_total::text,
        'referral_url',    public.email_web_base() || '/referral'
      ),
      'referrals', v_referral.id
    );
  exception when others then raise warning 'credit_referral: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_credit_referral on public.shipments;
create trigger trg_credit_referral
  after insert on public.shipments
  for each row execute function public.credit_referral();

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Admin invitation hook — OR REPLACE with the email enqueue appended
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION invite_org_member_by_email(
  p_org_id   UUID,
  p_email    TEXT,
  p_role     TEXT DEFAULT 'resident'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_target_user   UUID;
  v_membership_id UUID;
  v_org_name      TEXT;
  v_invite_code   TEXT;
  v_inviter_name  TEXT;
BEGIN
  -- Guard: caller must be admin
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Look up user by email in profiles
  SELECT id INTO v_target_user
  FROM profiles
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;

  -- If not found, try auth.users (email may be there but profile not yet written)
  IF v_target_user IS NULL THEN
    SELECT id INTO v_target_user
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email))
    LIMIT 1;
  END IF;

  IF v_target_user IS NULL THEN
    -- Return NULL to signal "user not found in Porchivo"
    RETURN NULL;
  END IF;

  -- Upsert: if already a member re-activate with new role
  INSERT INTO org_memberships (user_id, org_id, role, status, invited_by, created_at, updated_at)
  VALUES (v_target_user, p_org_id, p_role, 'active', auth.uid(), NOW(), NOW())
  ON CONFLICT (user_id, org_id)
  DO UPDATE SET
    role       = EXCLUDED.role,
    status     = 'active',
    invited_by = EXCLUDED.invited_by,
    joined_at  = COALESCE(org_memberships.joined_at, NOW()),
    updated_at = NOW()
  RETURNING id INTO v_membership_id;

  -- Admin invitation email (best-effort; never blocks the invite)
  BEGIN
    SELECT o.name, o.invite_code INTO v_org_name, v_invite_code
    FROM organizations o WHERE o.id = p_org_id;
    SELECT COALESCE(NULLIF(p.name, ''), 'An admin') INTO v_inviter_name
    FROM profiles p WHERE p.id = auth.uid();
    PERFORM enqueue_template_email(
      'admin-invitation', LOWER(TRIM(p_email)), v_target_user, 'community',
      'adm-inv:' || v_membership_id::text,
      jsonb_build_object(
        'first_name',      COALESCE(SPLIT_PART(COALESCE(v_inviter_name, ''), ' ', 1), 'there'),
        'community_name',  COALESCE(v_org_name, 'your community'),
        'inviter_name',    COALESCE(v_inviter_name, 'An admin'),
        'admin_role',      p_role,
        'expiry_date',     TO_CHAR(NOW() + INTERVAL '7 days', 'Mon DD, YYYY'),
        'accept_invite_url', email_web_base() || '/invite?code=' || COALESCE(v_invite_code, '')
      ),
      'org_memberships', v_membership_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'invite email failed: %', SQLERRM;
  END;

  RETURN v_membership_id;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Account deletion confirmation — hook inside the purge loop (email must
--     reach the user BEFORE the account rows are destroyed)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purge_deleted_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count INT := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find all accounts past the 30-day grace period
  FOR v_user IN
    SELECT id, email, name, deletion_requested_at
    FROM public.profiles
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      -- Deletion confirmation email — queued BEFORE the rows are purged so
      -- the queue row (user-scoped-free) survives and the user is told.
      BEGIN
        PERFORM enqueue_template_email(
          'account-deletion-confirmation', v_user.email, v_user.id, 'security',
          'acct-del:' || v_user.id::text,
          jsonb_build_object(
            'first_name',      COALESCE(SPLIT_PART(COALESCE(v_user.name, ''), ' ', 1), 'there'),
            'request_date',    TO_CHAR(v_user.deletion_requested_at, 'Mon DD, YYYY'),
            'deletion_date',   TO_CHAR(NOW(), 'Mon DD, YYYY'),
            'recovery_window', '30 days',
            'support_url',     email_web_base() || '/guide'
          ),
          'profiles', v_user.id
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'purge deletion email failed for %: %', v_user.id, SQLERRM;
      END;

      -- Delete dependent rows in order (children before parents)
      BEGIN
        DELETE FROM public.analytics_events WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.rate_limit_log WHERE key LIKE '%:' || v_user.id::TEXT;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.chat_messages WHERE sender_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      DELETE FROM public.notifications WHERE recipient_id = v_user.id;

      BEGIN
        DELETE FROM public.invoice_periods WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_payouts WHERE partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_assignments
        WHERE homeowner_id = v_user.id OR partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_connections
        WHERE homeowner_id = v_user.id OR partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.support_tickets WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_verifications WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      DELETE FROM public.shipments
      WHERE homeowner_id = v_user.id OR partner_id = v_user.id;

      DELETE FROM public.profiles WHERE id = v_user.id;

      -- Purge Storage objects (avatars + delivery-photos) for this user.
      BEGIN
        DELETE FROM storage.objects
        WHERE bucket_id IN ('avatars', 'delivery-photos')
          AND (storage.foldername(name))[1] = v_user.id::text;
      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, format('User %s storage cleanup: %s', v_user.id, SQLERRM));
      END;

      DELETE FROM auth.users WHERE id = v_user.id;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format('User %s: %s', v_user.id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_count,
    'errors', to_jsonb(v_errors)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- No GRANT — only service_role can call the purge job

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. SCHEDULED JOB RPCs (called directly by pg_cron — pure SQL, no HTTP)
-- ═════════════════════════════════════════════════════════════════════════════

-- 11a. Weekly Safety Digest — per community, once per ISO week ───────────────
create or replace function public.run_safety_digest_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_org record;
  v_rec record;
  v_sent int := 0;
  v_delivered int; v_at_risk int; v_thefts int;
  v_hour numeric; v_window text;
begin
  for v_org in
    select o.id, o.name
    from public.organizations o
    where (select count(*) from public.org_memberships m
           where m.org_id = o.id and m.status = 'active') >= 2
  loop
    select count(*) into v_delivered
    from public.shipments s
    join public.org_memberships om on om.user_id = s.homeowner_id and om.org_id = v_org.id and om.status = 'active'
    where s.delivery_status in ('delivered','delivered_to_homeowner')
      and s.updated_at > now() - interval '7 days';

    select count(*) into v_at_risk
    from public.shipments s
    join public.org_memberships om on om.user_id = s.homeowner_id and om.org_id = v_org.id and om.status = 'active'
    where s.delivery_status = 'delivered' and s.status in ('open','accepted')
      and s.updated_at < now() - interval '24 hours';

    select count(*) into v_thefts
    from public.incident_reports i
    where i.org_id = v_org.id and i.created_at > now() - interval '7 days'
      and i.type in ('missing_package','delivered_not_found','tampered','suspicious_activity');

    select extract(hour from created_at) into v_hour
    from public.incident_reports
    where org_id = v_org.id and created_at > now() - interval '60 days'
    group by extract(hour from created_at)
    order by count(*) asc limit 1;
    v_window := case when v_hour is null then '10 AM – 2 PM'
      else (case when v_hour::int = 0 then '12 AM'
                 when v_hour::int < 12 then (v_hour::int)::text || ' AM'
                 when v_hour::int = 12 then '12 PM'
                 else ((v_hour::int - 12)::text || ' PM') end)
        || ' – ' ||
        (case when (v_hour::int + 2) % 24 = 0 then '12 AM'
              when (v_hour::int + 2) % 24 < 12 then (((v_hour::int + 2) % 24)::text || ' AM')
              when (v_hour::int + 2) % 24 = 12 then '12 PM'
              else ((((v_hour::int + 2) % 24) - 12)::text || ' PM') end)
    end;

    for v_rec in
      select om.user_id, p.email, p.name
      from public.org_memberships om
      join public.profiles p on p.id = om.user_id
      where om.org_id = v_org.id and om.status = 'active' and p.email like '%@%'
      limit 200
    loop
      begin
        perform public.enqueue_template_email(
          'safety-digest', v_rec.email, v_rec.user_id, 'community',
          'digest:' || v_org.id::text || ':' || v_rec.user_id::text || ':' || to_char(now(), 'IYYY-IW'),
          jsonb_build_object(
            'first_name',         coalesce(split_part(v_rec.name, ' ', 1), 'there'),
            'neighborhood',       v_org.name,
            'packages_delivered', v_delivered::text,
            'packages_at_risk',   v_at_risk::text,
            'theft_reports',      v_thefts::text,
            'safest_window',      v_window,
            'digest_url',         public.email_web_base() || '/safety'
          ),
          'organizations', v_org.id
        );
        v_sent := v_sent + 1;
      exception when others then raise warning 'digest %: %', v_rec.user_id, sqlerrm;
      end;
    end loop;
  end loop;
  return v_sent;
end; $$;

-- 11b. At-risk package alerts — delivered but unclaimed; round 1 at 2h, round 2 at 12h
create or replace function public.run_at_risk_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_s record; v_homeowner record;
  v_sent int := 0;
begin
  for v_s in
    select s.*, coalesce(nullif(packages_expected,''), 'Your package') as item_name
    from public.shipments s
    where s.delivery_status = 'delivered'
      and s.status in ('open','accepted')
      and (
        (s.updated_at < now() - interval '2 hours'  and s.updated_at >= now() - interval '12 hours')
        or (s.updated_at < now() - interval '12 hours' and s.updated_at >= now() - interval '36 hours')
      )
    limit 100
  loop
    select id, name, email into v_homeowner from public.profiles where id = v_s.homeowner_id;
    if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then continue; end if;
    begin
      perform public.enqueue_template_email(
        'package-at-risk', v_homeowner.email, v_homeowner.id, 'packages',
        'atrisk:' || v_s.id::text || ':' || case
          when v_s.updated_at < now() - interval '12 hours' then '2' else '1' end,
        jsonb_build_object(
          'first_name',        coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
          'item_name',         v_s.item_name,
          'time_elapsed',      case
            when v_s.updated_at < now() - interval '12 hours' then '12+ hours' else '2+ hours' end,
          'risk_level',        case
            when v_s.updated_at < now() - interval '12 hours' then 'high' else 'elevated' end,
          'delivery_location', coalesce(nullif(v_s.address_text, ''), 'Your porch'),
          'request_partner_url', public.email_web_base() || '/partners'
        ),
        'shipments', v_s.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'at-risk %: %', v_s.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

-- 11c. Re-engagement — inactive 30+ days, once per month ─────────────────────
create or replace function public.run_reengagement_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_sent int := 0;
  v_packages int; v_partners int;
begin
  for v_u in
    select p.id, p.email, p.name, max(ae.created_at) as last_active
    from public.profiles p
    join public.analytics_events ae on ae.user_id = p.id
    where p.deletion_requested_at is null and p.email like '%@%'
    group by p.id, p.email, p.name
    having max(ae.created_at) < now() - interval '30 days'
    order by max(ae.created_at) asc
    limit 200
  loop
    select count(*) into v_packages from public.shipments
      where homeowner_id = v_u.id and delivery_status in ('delivered','delivered_to_homeowner');
    select count(*) into v_partners from public.partner_connections
      where (homeowner_id = v_u.id or partner_id = v_u.id) and status = 'active';
    begin
      perform public.enqueue_template_email(
        're-engagement', v_u.email, v_u.id, 'marketing',
        'reengage:' || v_u.id::text || ':' || to_char(now(), 'IYYY-MM'),
        jsonb_build_object(
          'first_name',        coalesce(split_part(v_u.name, ' ', 1), 'there'),
          'days_inactive',     extract(day from now() - v_u.last_active)::int::text,
          'last_active_date',  to_char(v_u.last_active, 'Mon DD, YYYY'),
          'lifetime_packages', v_packages::text,
          'partner_count',     v_partners::text,
          'return_url',        public.email_web_base() || '/app'
        ),
        'profiles', v_u.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'reengage %: %', v_u.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

-- 11d. Milestone — lifetime packages-protected crossing 10/50/100/250/500/1000
create or replace function public.run_milestone_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_sent int := 0; v_count int; v_threshold int;
  v_join date; v_partner_uses int; v_blocked int;
begin
  for v_u in
    select p.id, p.email, p.name, p.created_at,
           (select count(*) from public.shipments s
            where s.homeowner_id = p.id
              and s.delivery_status in ('delivered','delivered_to_homeowner')) as lifetime
    from public.profiles p
    where p.deletion_requested_at is null and p.email like '%@%'
  loop
    v_count := v_u.lifetime;
    if v_count not in (10,50,100,250,500,1000) then continue; end if;
    select count(*) into v_partner_uses from public.partner_assignments
      where homeowner_id = v_u.id and status = 'completed';
    select count(*) into v_blocked from public.suspicious_alerts
      where user_id = v_u.id and category = 'package_taken';
    begin
      perform public.enqueue_template_email(
        'milestone', v_u.email, v_u.id, 'community',
        'mile:' || v_u.id::text || ':' || v_count::text,
        jsonb_build_object(
          'first_name',             coalesce(split_part(v_u.name, ' ', 1), 'there'),
          'package_milestone',      v_count::text,
          'join_date',              to_char(v_u.created_at, 'Mon DD, YYYY'),
          'partner_uses',           v_partner_uses::text,
          'theft_attempts_blocked', v_blocked::text,
          'stats_url',              public.email_web_base() || '/app'
        ),
        'profiles', v_u.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'milestone %: %', v_u.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

-- 11e. Review request — 3-14 days after a completed hand-off, if unreviewed
create or replace function public.run_review_request_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_a record; v_homeowner record; v_partner record; v_item text;
  v_sent int := 0;
begin
  for v_a in
    select pa.*, s.packages_expected
    from public.partner_assignments pa
    left join public.shipments s on s.id = pa.shipment_id
    where pa.status = 'completed'
      and pa.completion_confirmed_at < now() - interval '3 days'
      and pa.completion_confirmed_at > now() - interval '14 days'
      and pa.homeowner_rating is null
    limit 100
  loop
    select id, name, email into v_homeowner from public.profiles where id = v_a.homeowner_id;
    select name into v_partner from public.profiles where id = v_a.partner_id;
    if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then continue; end if;
    v_item := coalesce(nullif(v_a.packages_expected, ''), 'Your package');
    begin
      perform public.enqueue_template_email(
        'review-request', v_homeowner.email, v_homeowner.id, 'community',
        'review:' || v_a.id::text,
        jsonb_build_object(
          'first_name',     coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
          'item_name',      v_item,
          'partner_name',   coalesce(nullif(v_partner, ''), 'your Porch Partner'),
          'delivered_date', to_char(v_a.completion_confirmed_at, 'Mon DD, YYYY'),
          'review_url',     'https://apps.apple.com/app/id6797350605?action=write-review'
        ),
        'partner_assignments', v_a.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'review %: %', v_a.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

-- 11f. High-risk spike — theft reports in 72h vs 30-day baseline ─────────────
create or replace function public.run_risk_spike_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_org record; v_rec record;
  v_recent int; v_baseline numeric; v_last timestamptz;
  v_sent int := 0;
begin
  for v_org in
    select o.id, o.name
    from public.organizations o
    where (select count(*) from public.incident_reports i
           where i.org_id = o.id and i.created_at > now() - interval '72 hours'
             and i.type in ('missing_package','delivered_not_found','tampered','suspicious_activity')) >= 3
  loop
    select count(*) into v_recent
    from public.incident_reports
    where org_id = v_org.id and created_at > now() - interval '72 hours'
      and type in ('missing_package','delivered_not_found','tampered','suspicious_activity');
    select max(created_at) into v_last
    from public.incident_reports
    where org_id = v_org.id and created_at > now() - interval '72 hours';
    select count(*) / 10.0 into v_baseline
    from public.incident_reports
    where org_id = v_org.id
      and created_at between now() - interval '30 days' and now() - interval '72 hours'
      and type in ('missing_package','delivered_not_found','tampered','suspicious_activity');
    if v_recent < greatest(3, coalesce(v_baseline, 0) * 2) then continue; end if;
    for v_rec in
      select om.user_id, p.email, p.name
      from public.org_memberships om
      join public.profiles p on p.id = om.user_id
      where om.org_id = v_org.id and om.status = 'active' and p.email like '%@%'
      limit 200
    loop
      begin
        perform public.enqueue_template_email(
          'high-risk-alert', v_rec.email, v_rec.user_id, 'community',
          'risk:' || v_org.id::text || ':' || v_rec.user_id::text || ':' || to_char(now(), 'IYYY-MM-DD'),
          jsonb_build_object(
            'first_name',         coalesce(split_part(v_rec.name, ' ', 1), 'there'),
            'neighborhood',       v_org.name,
            'radius',             '1 mile',
            'risk_level',         case when v_recent >= 5 then 'high' else 'elevated' end,
            'incident_count',     v_recent::text,
            'last_incident_time', to_char(v_last, 'Mon DD at HH12:MI AM'),
            'risk_map_url',       public.email_web_base() || '/safety'
          ),
          'organizations', v_org.id
        );
        v_sent := v_sent + 1;
      exception when others then raise warning 'risk %: %', v_rec.user_id, sqlerrm;
      end;
    end loop;
  end loop;
  return v_sent;
end; $$;

-- 11g. Arriving today — shipments flagged out-for-delivery with today's window
create or replace function public.run_arriving_today_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_s record; v_homeowner record;
  v_sent int := 0;
begin
  for v_s in
    select *
    from public.shipments
    where delivery_status = 'out_for_delivery'
      and status in ('open','accepted')
      and (delivery_window_start::date = current_date or delivery_window_end::date = current_date)
    limit 200
  loop
    select id, name, email into v_homeowner from public.profiles where id = v_s.homeowner_id;
    if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then continue; end if;
    begin
      perform public.enqueue_template_email(
        'package-arriving', v_homeowner.email, v_homeowner.id, 'packages',
        'arrive:' || v_s.id::text,
        jsonb_build_object(
          'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
          'item_name',       coalesce(nullif(v_s.packages_expected, ''), 'Your package'),
          'carrier_name',    v_s.carrier,
          'delivery_window', to_char(v_s.delivery_window_start, 'HH12:MI AM') || ' – ' || to_char(v_s.delivery_window_end, 'HH12:MI AM'),
          'tracking_number', coalesce(v_s.tracking_number, '—'),
          'tracking_url',    coalesce(v_s.carrier_tracking_url, public.email_web_base() || '/app')
        ),
        'shipments', v_s.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'arriving %: %', v_s.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

revoke all on function public.run_safety_digest_job()   from public, anon, authenticated;
revoke all on function public.run_at_risk_job()          from public, anon, authenticated;
revoke all on function public.run_reengagement_job()     from public, anon, authenticated;
revoke all on function public.run_milestone_job()        from public, anon, authenticated;
revoke all on function public.run_review_request_job()   from public, anon, authenticated;
revoke all on function public.run_risk_spike_job()       from public, anon, authenticated;
revoke all on function public.run_arriving_today_job()   from public, anon, authenticated;

-- ── 12. pg_cron schedules (direct RPC calls — jobs are pure SQL) ────────────
do $job$ begin
  perform cron.schedule('email-safety-digest', '0 14 * * 1',  $$select public.run_safety_digest_job()$$);
  perform cron.schedule('email-at-risk',       '0 * * * *',   $$select public.run_at_risk_job()$$);
  perform cron.schedule('email-re-engagement', '0 15 * * *',  $$select public.run_reengagement_job()$$);
  perform cron.schedule('email-milestone',     '10 15 * * *', $$select public.run_milestone_job()$$);
  perform cron.schedule('email-review-request','20 15 * * *', $$select public.run_review_request_job()$$);
  perform cron.schedule('email-risk-spike',    '0 */6 * * *', $$select public.run_risk_spike_job()$$);
  perform cron.schedule('email-arriving-today','0 */2 * * *', $$select public.run_arriving_today_job()$$);
exception when others then
  raise warning 'cron schedule: %', sqlerrm;
end $job$;
