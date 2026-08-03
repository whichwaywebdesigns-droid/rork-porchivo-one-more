-- ============================================================
-- PORCHIVO: Welcome Email Trigger
-- Run this in Supabase SQL Editor AFTER email-queue-migration.sql.
-- ============================================================
-- Sends a branded welcome email to every newly-confirmed user. The email is
-- composed through the `send-email` Edge Function's `branded` template, so it
-- automatically carries the porchivo.com/guide Field Guide link in the footer.
--
-- Flow:
--   auth.users INSERT  →  trigger  →  pg_net POST to send-email (action=enqueue,
--   template=branded)  →  durable email_queue  →  pg_cron drains via Resend.
--
-- Why call the Edge Function (not enqueue_email directly)?
--   The branded shell + Field Guide link live in TypeScript (_shared/
--   emailTemplate.ts) so there is a single source of truth. Going through the
--   function keeps the SQL free of duplicated HTML.
--
-- Resilience: if the function URL / secret are not configured, or the HTTP
-- call fails, the trigger swallows the error so a transient email problem can
-- NEVER block a user signing up.
--
-- PREREQUISITES:
--   1. pg_net extension enabled (Database → Extensions → pg_net).
--   2. email-queue-migration.sql + the send-email Edge Function deployed.
--   3. Configure the two settings below (project-specific, contain a secret):
--
--        insert into public.app_config (key, value) values
--          ('functions_base_url', 'https://<your-ref>.supabase.co/functions/v1'),
--          ('email_fn_secret',    '<EMAIL_FN_SECRET>')
--        on conflict (key) do update set value = excluded.value;
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ── Private config table (service-role only) ────────────────────────────────
-- Holds the project-specific function base URL and the shared email secret so
-- they are not hardcoded into the trigger body. RLS on + no policies = no
-- client (anon/authenticated) can ever read it.
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

-- ── Trigger function ────────────────────────────────────────────────────────
create or replace function public.send_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url    text;
  v_secret      text;
  v_email       text;
  v_name        text;
  v_greeting    text;
  v_body_html   text;
  v_body_text   text;
begin
  v_email := lower(trim(coalesce(new.email, '')));

  -- No address → nothing to send (e.g. phone-only / anonymous signups).
  if v_email = '' or position('@' in v_email) = 0 then
    return new;
  end if;

  select value into v_base_url from public.app_config where key = 'functions_base_url';
  select value into v_secret   from public.app_config where key = 'email_fn_secret';

  -- Not configured yet → skip silently; signup must never fail on email.
  if v_base_url is null or v_secret is null then
    return new;
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    'there'
  );
  v_greeting := 'Welcome to Porchivo, ' || v_name || '!';

  v_body_html :=
    '<p>You''re all set. Porchivo helps you keep every porch delivery tracked, '
    || 'protected, and stress-free.</p>'
    || '<p>New here? Our Field Guide walks you through everything, step by step — '
    || 'no jargon, just what you need.</p>';

  v_body_text :=
    'You''re all set. Porchivo helps you keep every porch delivery tracked, '
    || 'protected, and stress-free.' || chr(10) || chr(10)
    || 'New here? Our Field Guide walks you through everything: '
    || 'https://porchivo.com/guide';

  -- Fire-and-forget; wrapped so any failure cannot abort the INSERT.
  begin
    perform net.http_post(
      url     := v_base_url || '/send-email',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-email-secret', v_secret
      ),
      body    := jsonb_build_object(
        'action',    'enqueue',
        'recipient', v_email,
        'subject',   'Welcome to Porchivo',
        'template',  'branded',
        'heading',   v_greeting,
        'bodyHtml',  v_body_html,
        'bodyText',  v_body_text,
        'cta',       jsonb_build_object(
          'label', 'Open the Field Guide',
          'url',   'https://porchivo.com/guide'
        ),
        'metadata',  jsonb_build_object('kind', 'welcome', 'user_id', new.id)
      )
    );
  exception when others then
    raise warning 'send_welcome_email: enqueue failed for % (%):', v_email, sqlerrm;
  end;

  return new;
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────
-- Fires once per new auth user. Runs alongside the existing
-- `on_auth_user_created` (handle_new_user) trigger that seeds the profile row.
drop trigger if exists on_auth_user_welcome_email on auth.users;
create trigger on_auth_user_welcome_email
  after insert on auth.users
  for each row execute function public.send_welcome_email();

-- ── Permissions ─────────────────────────────────────────────────────────────
revoke all on function public.send_welcome_email() from public, anon, authenticated;
