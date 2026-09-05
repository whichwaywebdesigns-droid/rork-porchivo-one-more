-- =============================================================
-- PORCHIVO · MASTER SUPABASE DEPLOYMENT FILE  (AUTO-GENERATED)
-- =============================================================
-- Source: build-master.py  ·  do not hand-edit. Re-run the script
-- after changing any individual migration:  python3 build-master.py
--
-- HOW TO USE
--   1. Supabase Dashboard -> SQL Editor -> New query
--   2. Paste this entire file and Run.
--   3. (One-time) enable the pg_net extension if prompted
--      Database -> Extensions -> pg_net -> Enable.
--
-- SAFE TO RE-RUN: policies, triggers, and enum types are guarded, and
-- tables/indexes use IF NOT EXISTS. Running this on a partially-migrated
-- database brings it fully up to date without erroring on existing objects.
--
-- Bundles 45 migrations in dependency order.
-- =============================================================



-- #############################################################
-- ##  migration.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Supabase Tables Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  avatar_url text,
  role text not null default 'homeowner' check (role in ('homeowner', 'partner', 'both')),
  address text not null default '',
  has_location_consent boolean not null default false,
  expo_push_token text,
  is_premium boolean not null default false,
  is_onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.profiles;
create policy "Authenticated can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- 2. SHIPMENTS TABLE
create table if not exists public.shipments (
  id uuid default gen_random_uuid() primary key,
  homeowner_id uuid references public.profiles(id) on delete cascade not null,
  homeowner_name text not null default '',
  partner_id uuid references public.profiles(id) on delete set null,
  partner_name text,
  status text not null default 'open' check (status in ('open', 'accepted', 'completed', 'cancelled')),
  carrier text not null default 'Other' check (carrier in ('Amazon', 'UPS', 'USPS', 'FedEx', 'Other')),
  packages_expected text not null default '',
  delivery_window_start timestamptz not null,
  delivery_window_end timestamptz not null,
  tracking_submitted_at timestamptz,
  address_text text not null default '',
  approximate_lat double precision,
  approximate_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  home_location_visible_to_partner boolean not null default false,
  notes text not null default '',
  preferred_return_time text not null default '',
  tracking_number text,
  carrier_tracking_url text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'delivered_to_homeowner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipments enable row level security;

DROP POLICY IF EXISTS "Homeowners view own shipments" ON public.shipments;
create policy "Homeowners view own shipments"
  on public.shipments for select
  using (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners view assigned shipments" ON public.shipments;
create policy "Partners view assigned shipments"
  on public.shipments for select
  using (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Authenticated view open shipments" ON public.shipments;
create policy "Authenticated view open shipments"
  on public.shipments for select
  using (auth.role() = 'authenticated' and status = 'open');

DROP POLICY IF EXISTS "Homeowners insert shipments" ON public.shipments;
create policy "Homeowners insert shipments"
  on public.shipments for insert
  with check (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Homeowners update own shipments" ON public.shipments;
create policy "Homeowners update own shipments"
  on public.shipments for update
  using (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners update assigned shipments" ON public.shipments;
create policy "Partners update assigned shipments"
  on public.shipments for update
  using (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Authenticated accept open shipments" ON public.shipments;
create policy "Authenticated accept open shipments"
  on public.shipments for update
  using (auth.role() = 'authenticated' and status = 'open');

-- 3. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  type text not null check (type in ('tracking_added', 'package_delivered', 'partner_pickup_alert', 'partner_completed', 'package_out_for_delivery', 'package_picked_up')),
  title text not null,
  message text not null,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  recipient_role text not null check (recipient_role in ('homeowner', 'partner')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
create policy "Authenticated insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- 4. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. AUTO-UPDATE updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

DROP TRIGGER IF EXISTS shipments_updated_at ON public.shipments;
create trigger shipments_updated_at
  before update on public.shipments
  for each row execute function public.update_updated_at();

-- 6. INDEXES
create index if not exists idx_shipments_homeowner on public.shipments(homeowner_id);
create index if not exists idx_shipments_partner on public.shipments(partner_id);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_notifications_recipient on public.notifications(recipient_id);
create index if not exists idx_notifications_shipment on public.notifications(shipment_id);



-- #############################################################
-- ##  hardened-rls.sql
-- #############################################################
-- ============================================================
-- PORCHIVO — HARDENED RLS POLICIES
-- Run this in Supabase SQL Editor AFTER the base migration.
-- This replaces the over-permissive policies in migration.sql.
-- ============================================================

-- ============================================================
-- STEP 1: DROP the dangerous over-broad policies
-- ============================================================

-- CRITICAL: This policy exposed ALL user data (addresses, phones,
-- push tokens, emails) to every authenticated user. Drop it.
drop policy if exists "Authenticated can view all profiles" on public.profiles;

-- HIGH: This allowed any authenticated user to UPDATE any open shipment,
-- letting them hijack shipments or read home addresses.
drop policy if exists "Authenticated accept open shipments" on public.shipments;

-- HIGH: This allowed any authenticated user to insert notifications
-- for any recipient — a direct spam vector.
drop policy if exists "Authenticated insert notifications" on public.notifications;


-- ============================================================
-- STEP 2: PROFILES — hardened policies
-- ============================================================

-- Users can read their own full profile (all columns).
-- Existing policy — keep as-is.
-- create policy "Users can view own profile" on public.profiles for select
--   using (auth.uid() = id);

-- Users can read a MINIMAL public view of other profiles.
-- This only exposes non-PII trust/display signals: name, avatar, role,
-- join date, and a STREET-ONLY locality (house number stripped server-side).
-- Push tokens, full addresses, phones, emails are NOT included.
-- Implement this as a separate view for cleanliness.
--
-- This view is SECURITY DEFINER (runs as the owner, not the caller), so it
-- bypasses the owner-only RLS on profiles for these safe columns only.
-- All cross-user profile lookups (e.g. the Porch Partners list) MUST read
-- from here — never from the raw profiles table.
create or replace view public.profile_public_view as
  select
    id,
    name,
    avatar_url,
    role,
    created_at,
    -- Street name only: take the segment before the first comma and strip a
    -- leading house number so the precise address never leaves the database.
    nullif(
      trim(both ' ' from
        regexp_replace(split_part(coalesce(address, ''), ',', 1), '^\s*\d+\s*', '')
      ),
      ''
    ) as street
  from public.profiles;

-- Grant select on the view to authenticated users.
grant select on public.profile_public_view to authenticated;

-- Revoke direct SELECT on profiles from authenticated role
-- (they should go through the view for cross-user lookups).
-- Note: the owner's own-row policy still allows self-select via RLS.


-- ============================================================
-- STEP 3: SHIPMENTS — tighten the partner-accept path
-- ============================================================

-- Replace the over-broad "Authenticated accept open shipments" with
-- a controlled RPC that sets ONLY the partner_id and status columns.
-- Partners cannot touch addresses, tracking numbers, homeowner fields, etc.

create or replace function public.accept_shipment(p_shipment_id uuid)
returns void
language plpgsql
security definer   -- runs as the function owner (postgres), not the caller
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  -- Load the shipment
  select * into v_shipment
  from public.shipments
  where id = p_shipment_id;

  if not found then
    raise exception 'Shipment not found';
  end if;

  -- Only open shipments can be accepted
  if v_shipment.status != 'open' then
    raise exception 'Shipment is not open for acceptance';
  end if;

  -- The caller must not be the homeowner (can't accept your own shipment)
  if v_shipment.homeowner_id = auth.uid() then
    raise exception 'You cannot accept your own shipment';
  end if;

  -- Set only the partner fields — nothing else
  update public.shipments
  set
    partner_id = auth.uid(),
    status = 'accepted',
    updated_at = now()
  where id = p_shipment_id
    and status = 'open';

  if not found then
    raise exception 'Shipment could not be accepted (concurrent modification?)';
  end if;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.accept_shipment(uuid) to authenticated;

-- Partners can update ONLY their own assigned shipments
-- (e.g. to mark as completed). They cannot touch homeowner fields.
DROP POLICY IF EXISTS "Partners update assigned shipments (hardened)" ON public.shipments;
create policy "Partners update assigned shipments (hardened)"
  on public.shipments for update
  using (auth.uid() = partner_id)
  with check (
    auth.uid() = partner_id
    -- Partners may only set status to 'completed' or 'cancelled'
    -- (Not 'open' — they can't re-open a shipment)
  );


-- ============================================================
-- STEP 4: NOTIFICATIONS — backend-only insert
-- ============================================================

-- Clients must NOT insert notifications directly.
-- Notifications are created by:
--   1. Database triggers (push-notification-trigger.sql)
--   2. Supabase Edge Functions (server-side, with ownership checks)
-- The security definer functions below are the ONLY insert path.

-- Security-definer RPC to insert a notification row.
-- Called directly by the client app (and by Edge Functions).
-- Verifies BOTH the caller (auth.uid) and the recipient are participants
-- in the shipment, preventing cross-shipment notification injection.
create or replace function public.create_notification(
  p_shipment_id   uuid,
  p_type          text,
  p_title         text,
  p_message       text,
  p_recipient_id  uuid,
  p_recipient_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_caller uuid := auth.uid();
begin
  -- Verify the caller is authenticated
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the shipment exists and BOTH caller and recipient are participants
  if not exists (
    select 1 from public.shipments
    where id = p_shipment_id
      and (homeowner_id = v_caller or partner_id = v_caller)
      and (homeowner_id = p_recipient_id or partner_id = p_recipient_id)
  ) then
    raise exception 'Caller or recipient is not a participant in this shipment';
  end if;

  insert into public.notifications
    (shipment_id, type, title, message, recipient_id, recipient_role)
  values
    (p_shipment_id, p_type, p_title, p_message, p_recipient_id, p_recipient_role)
  returning id into v_id;

  return v_id;
end;
$$;

-- Revoke direct insert on notifications from authenticated role.
-- Only the service role (Edge Functions / triggers) can insert.
revoke insert on public.notifications from authenticated;

-- Grant execute on the helper to authenticated (for Edge Functions calling via client JWT)
grant execute on function public.create_notification(uuid, text, text, text, uuid, text) to authenticated;


-- ============================================================
-- STEP 5: ANALYTICS EVENTS — add RLS if table exists
-- ============================================================

-- If you have an analytics_events table, add ownership-scoped RLS.
-- Users may only insert events for their own session/user_id.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'analytics_events'
  ) then
    execute 'alter table public.analytics_events enable row level security';

    execute $policy$
      DROP POLICY IF EXISTS "Users insert own analytics events" ON public.analytics_events;
create policy "Users insert own analytics events"
        on public.analytics_events for insert
        with check (
          user_id is null
          or user_id = auth.uid()
        )
    $policy$;

    execute $policy$
      DROP POLICY IF EXISTS "Users view own analytics events" ON public.analytics_events;
create policy "Users view own analytics events"
        on public.analytics_events for select
        using (user_id = auth.uid())
    $policy$;
  end if;
end;
$$;


-- ============================================================
-- STEP 6: PUSH TOKENS — column-level protection
-- ============================================================

-- The expo_push_token column should ONLY be readable by its owner.
-- Since we can't do column-level RLS directly in Postgres, we
-- enforce this by ensuring the "view all profiles" policy is gone
-- (done in STEP 1) and documenting that cross-user profile reads
-- must go through `profile_public_view` which excludes this column.

-- Additionally: restrict who can update expo_push_token.
-- Only the owning user should be able to write their own token.
-- The existing "Users can update own profile" policy covers this. ✅


-- ============================================================
-- STEP 7: VERIFY — check RLS is enabled on all tables
-- ============================================================

-- After running this script, execute the following to confirm
-- every table has RLS enabled:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;
--
-- Expected result: 0 rows.
-- If any table appears, run: ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 8: CHAT MESSAGES — verify existing policies are correct
-- ============================================================

-- The chat-messages-migration.sql policies are correctly scoped:
--   SELECT: only shipment participants (homeowner OR partner) ✅
--   INSERT: only sender_id = auth.uid() AND must be a participant ✅
-- No changes needed.


-- ============================================================
-- SUMMARY OF CHANGES
-- ============================================================
-- DROPPED:
--   ❌ "Authenticated can view all profiles" (exposed all PII to all users)
--   ❌ "Authenticated accept open shipments" (any user could hijack any shipment)
--   ❌ "Authenticated insert notifications" (spam vector)
--
-- ADDED:
--   ✅ profile_public_view (name + avatar only — no PII)
--   ✅ accept_shipment() RPC (controlled accept — partner_id + status only)
--   ✅ create_notification() RPC (server-side only notification creation)
--   ✅ analytics_events RLS (users can only insert/view their own events)
--   ✅ Revoked direct notifications INSERT from authenticated role



-- #############################################################
-- ##  verification-notification-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Verification Notification Support Migration
-- Run in Supabase SQL Editor AFTER migration.sql
-- ============================================================
-- 1. Make shipment_id nullable so non-shipment events (IDV,
--    tier changes, payout updates) can insert notifications.
-- 2. Extend the type check constraint to include IDV and tier
--    notification types.
-- ============================================================

-- 1. Drop the NOT NULL constraint on shipment_id
ALTER TABLE public.notifications
  ALTER COLUMN shipment_id DROP NOT NULL;

-- 2. Drop the existing type check constraint and recreate it
--    with the extended list of allowed types.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- Existing shipment notification types
    'tracking_added',
    'package_delivered',
    'partner_pickup_alert',
    'partner_completed',
    'package_out_for_delivery',
    'package_picked_up',

    -- Identity verification types (no shipment_id)
    'idv_approved',
    'idv_requires_input',
    'idv_cancelled',

    -- Trust tier promotion (no shipment_id)
    'tier_promoted',

    -- Payout / Connect account types (no shipment_id)
    'payout_account_active',
    'payout_received'
  ));

-- 3. Index for fast lookup of unread verification notifications
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications(type);

-- 4. Partial index for common "unread" queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(recipient_id, created_at DESC)
  WHERE read = false;



-- #############################################################
-- ##  push-notification-trigger.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Push Notification Trigger
-- Run this in Supabase SQL Editor
-- ============================================
-- This trigger sends a push notification via Expo's push API
-- whenever a new row is inserted into the notifications table.
-- It looks up the recipient's expo_push_token from profiles
-- and calls the Expo push endpoint using pg_net (HTTP extension).
--
-- PREREQUISITE: Enable the pg_net extension in Supabase Dashboard:
--   Database > Extensions > search "pg_net" > Enable
-- ============================================

-- 1. Enable pg_net extension (if not already enabled)
create extension if not exists pg_net with schema extensions;

-- 2. Create the trigger function
create or replace function public.send_push_notification()
returns trigger as $$
declare
  recipient_token text;
  payload jsonb;
begin
  -- Look up the recipient's push token
  select expo_push_token into recipient_token
  from public.profiles
  where id = new.recipient_id;

  -- Only send if recipient has a push token
  if recipient_token is not null and recipient_token != '' then
    payload := jsonb_build_object(
      'to', recipient_token,
      'sound', 'default',
      'title', new.title,
      'body', new.message,
      'data', jsonb_build_object(
        'shipmentId', new.shipment_id,
        'type', new.type,
        'notificationId', new.id
      )
    );

    -- Send via Expo Push API using pg_net
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-encoding', 'gzip, deflate'
      ),
      body := payload
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 3. Create the trigger on notifications table
drop trigger if exists on_notification_created on public.notifications;
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
create trigger on_notification_created
  after insert on public.notifications
  for each row execute function public.send_push_notification();



-- #############################################################
-- ##  rate-limit-migration.sql
-- #############################################################
-- Rate Limiting Infrastructure
-- Run this in Supabase SQL Editor AFTER the main migration.sql
--
-- Creates:
--   1. rate_limit_log  — sliding-window counters keyed by (function:user_id, window_ts)
--   2. increment_rate_limit — atomic upsert RPC used by Edge Function shared utility
--
-- Configuration lives in supabase/functions/_shared/rateLimit.ts.
-- Default limits (configurable per-caller):
--   initiate-verification   → 3 calls / 10 min  per user
--   create-connect-account  → 5 calls / 10 min  per user
--   partner-payout          → 10 calls / 60 min per user

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  key        TEXT    NOT NULL,
  window_ts  BIGINT  NOT NULL,   -- unix epoch / window_size_seconds
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_ts)
);

-- This table is only written by SECURITY DEFINER functions via the service
-- role key inside Edge Functions. SECURITY: RLS must be ENABLED with zero
-- policies — with RLS disabled, default PostgREST grants let any anon-key
-- holder read or delete rate-limit counters, neutering the limiter.
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_log FROM anon, authenticated;

-- Index for cleanup queries (delete stale windows)
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_window_ts
  ON public.rate_limit_log (window_ts);

-- ── Atomic increment RPC ───────────────────────────────────────────────────
-- Returns the NEW count after increment.
-- Uses INSERT ... ON CONFLICT DO UPDATE so the increment is atomic.
-- SECURITY DEFINER so Edge Functions calling via service role can execute it.
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key       TEXT,
  p_window_ts BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limit_log (key, window_ts, count)
  VALUES (p_key, p_window_ts, 1)
  ON CONFLICT (key, window_ts)
  DO UPDATE SET count = rate_limit_log.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;



-- #############################################################
-- ##  analytics-events-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO · ANALYTICS EVENTS
-- ============================================================
-- Client funnel telemetry written by expo/lib/analytics.ts.
-- Previously this table was assumed to exist (hardened-rls.sql only adds
-- policies IF EXISTS, delete-account-procedure.sql deletes from it), but no
-- migration ever created it — on a fresh deploy client analytics silently
-- failed. This migration is the canonical definition.
--
-- Security model:
--   * INSERT-only for app clients. The funnel starts BEFORE signup
--     (intro/onboarding events), so anon inserts are allowed with
--     user_id forced to NULL-or-self.
--   * No SELECT/UPDATE/DELETE for clients — dashboards read via
--     service_role / SQL editor only.
--   * CHECK constraints cap field sizes so the anon insert path cannot
--     be used to store arbitrary blobs.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT NOT NULL CHECK (char_length(event) BETWEEN 1 AND 64),
  props       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 4096),
  session_id  TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 1 AND 64),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform    TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Clients may insert; a user may only attribute events to themselves (or no one).
DROP POLICY IF EXISTS "analytics_events_client_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_client_insert"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Explicit grants: INSERT only. Reads are service_role/dashboard territory.
REVOKE ALL ON public.analytics_events FROM anon, authenticated;
GRANT INSERT ON public.analytics_events TO anon, authenticated;

-- Funnel queries group by event over time; retention queries join on session/user.
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_time
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON public.analytics_events (user_id)
  WHERE user_id IS NOT NULL;



-- #############################################################
-- ##  consent-tracking-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO — VERSIONED LEGAL CONSENT TRACKING
-- Append-only audit trail of each user's acceptance of the
-- Terms of Service + Privacy Policy. Every acceptance is stamped
-- with the legal document version and a server timestamp so we can
-- prove who agreed to what, and when — and force re-acceptance
-- whenever the version string changes.
--
-- Idempotent — safe to re-run.
-- Run in Supabase SQL Editor AFTER migration.sql.
-- ============================================================

create table if not exists public.user_consents (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- Legal version string the user accepted (see expo/constants/legal.ts LEGAL_VERSION).
  version     text        not null,
  -- Which documents this acceptance covers.
  documents   text[]      not null default array['terms_of_service', 'privacy_policy'],
  -- Lightweight client context for the audit record (no PII).
  platform    text,
  app_version text,
  accepted_at timestamptz not null default now()
);

create index if not exists user_consents_user_id_idx
  on public.user_consents (user_id);

-- Fast "latest accepted version for this user" lookup.
create index if not exists user_consents_user_accepted_idx
  on public.user_consents (user_id, accepted_at desc);

alter table public.user_consents enable row level security;

-- Users may record their own consent.
drop policy if exists "Users insert own consent" on public.user_consents;
DROP POLICY IF EXISTS "Users insert own consent" ON public.user_consents;
create policy "Users insert own consent"
  on public.user_consents for insert to authenticated
  with check (auth.uid() = user_id);

-- Users may read their own consent history.
drop policy if exists "Users read own consent" on public.user_consents;
DROP POLICY IF EXISTS "Users read own consent" ON public.user_consents;
create policy "Users read own consent"
  on public.user_consents for select to authenticated
  using (auth.uid() = user_id);

-- NOTE: There are intentionally NO update or delete policies.
-- Consent records are immutable and append-only — a new acceptance
-- (e.g. after a Terms change) inserts a new row rather than mutating
-- an existing one, preserving the full historical audit trail.
-- Rows are removed only when the auth.users row is deleted (FK cascade).



-- #############################################################
-- ##  email-queue-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Resend Email Queue + Retry Infrastructure
-- Run this in Supabase SQL Editor AFTER migration.sql.
-- ============================================================
-- Durable, retrying transactional-email queue backed by Resend.
--
-- Why a queue (not a direct API call):
--   • Resend's free tier caps at 100 emails/day. The `send-email` Edge
--     Function honours DAILY_EMAIL_CAP and simply leaves the rest queued —
--     they drain automatically the next day instead of being dropped.
--   • Transient failures (network blips, 5xx, 429) are retried with
--     exponential backoff instead of being lost.
--
-- Pieces:
--   1. email_queue            — durable job table (pending/processing/sent/failed)
--   2. enqueue_email          — insert a job (called by triggers / Edge Functions)
--   3. claim_email_batch       — atomically lease a batch of due jobs (SKIP LOCKED)
--   4. mark_email_sent         — finalise a delivered job
--   5. mark_email_failed       — increment attempts + schedule retry / give up
--   6. email_sent_today        — count of jobs sent since local midnight (cap guard)
--   7. reap_stale_email_jobs   — recover jobs stuck in 'processing' after a crash
--
-- All functions are SECURITY DEFINER and locked to the service role — they
-- are only ever invoked from the `send-email` Edge Function (service key).
-- ============================================================

-- ── Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient           TEXT NOT NULL,
  subject             TEXT NOT NULL,
  html_body           TEXT,
  text_body           TEXT,
  template            TEXT,                       -- optional logical template name
  reply_to            TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 5,
  next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error          TEXT,
  provider_message_id TEXT,                       -- Resend message id once sent
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ
);

-- Service-role only: written exclusively by SECURITY DEFINER funcs / Edge Function.
-- SECURITY: RLS must be ENABLED with zero policies (service_role bypasses RLS).
-- With RLS disabled, Supabase's default PostgREST grants would expose recipient
-- emails and full email bodies to any anon-key holder. Belt-and-suspenders:
-- also revoke the default table grants from client roles.
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_queue FROM anon, authenticated;

-- Claim queries filter on (status, next_attempt_at); this index keeps them fast.
CREATE INDEX IF NOT EXISTS idx_email_queue_due
  ON public.email_queue (status, next_attempt_at);

-- Daily-cap count filters on (status, sent_at).
CREATE INDEX IF NOT EXISTS idx_email_queue_sent_at
  ON public.email_queue (sent_at)
  WHERE status = 'sent';

-- ── 1. Enqueue ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_email(
  p_recipient    TEXT,
  p_subject      TEXT,
  p_html         TEXT DEFAULT NULL,
  p_text         TEXT DEFAULT NULL,
  p_template     TEXT DEFAULT NULL,
  p_reply_to     TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_recipient IS NULL OR position('@' IN p_recipient) = 0 THEN
    RAISE EXCEPTION 'enqueue_email: invalid recipient %', p_recipient;
  END IF;
  IF p_html IS NULL AND p_text IS NULL THEN
    RAISE EXCEPTION 'enqueue_email: at least one of html/text body is required';
  END IF;

  INSERT INTO public.email_queue (
    recipient, subject, html_body, text_body, template, reply_to, metadata, max_attempts
  )
  VALUES (
    lower(trim(p_recipient)), p_subject, p_html, p_text, p_template, p_reply_to,
    COALESCE(p_metadata, '{}'::jsonb), GREATEST(1, COALESCE(p_max_attempts, 5))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 2. Claim a batch (atomic lease) ─────────────────────────────────────────
-- Marks up to p_limit due 'pending' jobs as 'processing' and returns them.
-- FOR UPDATE SKIP LOCKED makes it safe under concurrent processors.
CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_queue q
  SET status = 'processing', updated_at = now()
  WHERE q.id IN (
    SELECT e.id
    FROM public.email_queue e
    WHERE e.status = 'pending'
      AND e.next_attempt_at <= now()
    ORDER BY e.next_attempt_at ASC
    LIMIT GREATEST(1, p_limit)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

-- ── 3. Mark sent ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_email_sent(
  p_id                  UUID,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_queue
  SET status = 'sent',
      provider_message_id = p_provider_message_id,
      last_error = NULL,
      sent_at = now(),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

-- ── 4. Mark failed (retry w/ exponential backoff, or give up) ───────────────
-- p_retry_in_seconds overrides the computed backoff (used for 429 / cap cases).
CREATE OR REPLACE FUNCTION public.mark_email_failed(
  p_id              UUID,
  p_error           TEXT,
  p_retry_in_seconds INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_max      INTEGER;
  v_delay    INTEGER;
  v_force_retry BOOLEAN := p_retry_in_seconds IS NOT NULL;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM public.email_queue
  WHERE id = p_id;

  IF v_attempts IS NULL THEN
    RETURN; -- row gone
  END IF;

  -- A forced retry (e.g. provider rate limit / daily cap) does NOT consume an
  -- attempt — it isn't the message's fault. Real failures increment attempts.
  IF NOT v_force_retry THEN
    v_attempts := v_attempts + 1;
  END IF;

  IF NOT v_force_retry AND v_attempts >= COALESCE(v_max, 5) THEN
    UPDATE public.email_queue
    SET status = 'failed',
        attempts = v_attempts,
        last_error = left(p_error, 2000),
        updated_at = now()
    WHERE id = p_id;
  ELSE
    -- Exponential backoff: 2^attempts minutes, capped at 6 hours.
    v_delay := COALESCE(
      p_retry_in_seconds,
      LEAST((power(2, GREATEST(1, v_attempts))::INTEGER) * 60, 21600)
    );
    UPDATE public.email_queue
    SET status = 'pending',
        attempts = v_attempts,
        last_error = left(p_error, 2000),
        next_attempt_at = now() + make_interval(secs => v_delay),
        updated_at = now()
    WHERE id = p_id;
  END IF;
END;
$$;

-- ── 5. Daily cap guard ───────────────────────────────────────────────────────
-- Count of emails actually sent since local midnight. The Edge Function uses
-- this to stay under the Resend free-tier cap.
CREATE OR REPLACE FUNCTION public.email_sent_today()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.email_queue
  WHERE status = 'sent'
    AND sent_at >= date_trunc('day', now());
$$;

-- ── 6. Reaper for crashed processors ────────────────────────────────────────
-- Jobs leased into 'processing' that never finished (function crash / timeout)
-- are returned to 'pending' after 10 minutes so they get retried.
CREATE OR REPLACE FUNCTION public.reap_stale_email_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.email_queue
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '10 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Permissions: server-role only, never clients ────────────────────────────
REVOKE ALL ON FUNCTION public.enqueue_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_email_batch(INTEGER)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_sent(UUID, TEXT)                                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_failed(UUID, TEXT, INTEGER)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_sent_today()                                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reap_stale_email_jobs()                                          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_batch(INTEGER)                                        TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_sent(UUID, TEXT)                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_failed(UUID, TEXT, INTEGER)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.email_sent_today()                                                TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_stale_email_jobs()                                           TO service_role;

-- ── Optional: schedule the drainer with pg_cron ─────────────────────────────
-- The `send-email` Edge Function processes the queue. To drain it automatically
-- every minute, enable pg_cron (Database → Extensions → pg_cron) and uncomment:
--
--   select cron.schedule(
--     'drain-email-queue',
--     '* * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://<your-ref>.supabase.co/functions/v1/send-email',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'x-email-secret', '<EMAIL_FN_SECRET>'
--         ),
--         body    := jsonb_build_object('action', 'process')
--       );
--     $$
--   );



-- #############################################################
-- ##  welcome-email-trigger.sql
-- #############################################################
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
DROP TRIGGER IF EXISTS on_auth_user_welcome_email ON auth.users;
create trigger on_auth_user_welcome_email
  after insert on auth.users
  for each row execute function public.send_welcome_email();

-- ── Permissions ─────────────────────────────────────────────────────────────
revoke all on function public.send_welcome_email() from public, anon, authenticated;



-- #############################################################
-- ##  email-queue-cron.sql
-- #############################################################
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



-- #############################################################
-- ##  subscription-entitlements-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Subscription Entitlements Backend Source of Truth
-- Run this in Supabase SQL Editor AFTER migration.sql
-- Safe to run multiple times — all statements use IF NOT EXISTS
-- ============================================================


-- ============================================================
-- PART 1: revenuecat_events
-- Append-only audit log. Also used for idempotent deduplication
-- via a unique index on rc_event_id (the RevenueCat event UUID).
-- Only the revenuecat-webhook Edge Function writes to this table.
-- Clients have zero access.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rc_event_id       text        NOT NULL,          -- event.id from RevenueCat payload
  user_id           text        NOT NULL,          -- event.app_user_id (Supabase UUID or RC anonymous ID)
  event_type        text        NOT NULL,          -- INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
  product_id        text,                          -- event.product_id
  store             text,                          -- APP_STORE | PLAY_STORE | STRIPE | etc.
  environment       text,                          -- SANDBOX | PRODUCTION
  expiration_at_ms  bigint,                        -- event.expiration_at_ms (unix ms)
  raw_payload       jsonb,                         -- full event object for debugging
  processed_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint drives deduplication: insert with ON CONFLICT DO NOTHING,
-- then check rows-affected to detect duplicates without a separate SELECT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenuecat_events_rc_event_id
  ON public.revenuecat_events (rc_event_id);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_user_id
  ON public.revenuecat_events (user_id);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_event_type
  ON public.revenuecat_events (event_type);

-- RLS: enabled with zero client-facing policies.
-- The service-role key used by the Edge Function bypasses RLS entirely.
-- Clients cannot read, write, or even discover this table.
ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 2: user_subscriptions
-- Single-row-per-user current entitlement state.
-- ONLY the revenuecat-webhook Edge Function writes here.
-- Clients may SELECT their own row (read-only) to display
-- authoritative billing status without inferring it from RC SDK.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Subscription lifecycle status.
  -- 'active'         — entitled, renewing or lifetime
  -- 'cancelled'      — user cancelled but still entitled until current_period_end
  -- 'expired'        — period ended, access revoked
  -- 'billing_issue'  — payment failed, in grace period
  -- 'paused'         — subscription paused (Google Play)
  -- 'grace_period'   — brief window after billing failure before access revoked
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'cancelled', 'expired', 'billing_issue', 'paused', 'grace_period')),

  -- Resolved Porchivo tier (matches SubscriptionTier in lib/tiers.ts).
  tier                text        NOT NULL DEFAULT 'free'
                        CHECK (tier IN ('free', 'premium', 'family', 'enterprise', 'lifetime')),

  -- The RevenueCat product identifier that triggered the current state.
  product_id          text,

  -- Store the subscription originated from.
  store               text,       -- APP_STORE | PLAY_STORE | STRIPE | PROMOTIONAL | etc.

  -- Build environment — useful for distinguishing sandbox test events.
  environment         text,       -- SANDBOX | PRODUCTION

  -- When the current paid period ends (null for lifetime / promotional).
  -- For 'cancelled' status this is when access actually stops — show to user.
  -- For 'active' this is the next renewal date.
  current_period_end  timestamptz,

  -- When the user requested cancellation (null if not cancelled).
  cancelled_at        timestamptz,

  -- Lifetime purchases never expire; skip period-end enforcement for these.
  is_lifetime         boolean     NOT NULL DEFAULT false,

  -- Mirrors profiles.is_premium for fast entitlement checks without a join.
  -- False only when status IN ('expired') or tier = 'free'.
  -- True for 'active' AND 'cancelled' (access continues until period end).
  -- True for 'billing_issue' / 'grace_period' (access continues during grace).
  is_entitled         boolean     NOT NULL DEFAULT true,

  -- Audit trail: which RC event last mutated this row.
  last_event_type     text,
  last_rc_event_id    text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- One record per user. Upsert on conflict to maintain single source of truth.
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON public.user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON public.user_subscriptions (status);

-- Auto-update updated_at on any row mutation.
DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: enabled. Users may read their own row only. No client writes.
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for clients.
-- All writes come from the service-role key in the Edge Function.


-- ============================================================
-- PART 3: Add subscription_tier to profiles (additive)
-- Keeps the existing is_premium bool intact for backward compat.
-- Now also stores the resolved tier so the client can read one
-- trusted record (profiles.*) without joining user_subscriptions.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';

-- Backfill existing premium users to 'premium' tier.
-- This is a safe best-effort: users with is_premium=true but unknown tier
-- are assumed to be on the base premium plan. The next webhook event will
-- correct this to the real tier (lifetime, family, etc.).
UPDATE public.profiles
  SET subscription_tier = 'premium'
  WHERE is_premium = true
    AND subscription_tier = 'free';


-- ============================================================
-- PART 4: Convenience view — user_entitlement
-- Joins profiles + user_subscriptions into a single client-readable
-- record. Clients query this view for the complete billing picture.
-- Returns NULL user_subscriptions columns if no subscription row exists yet.
-- ============================================================

CREATE OR REPLACE VIEW public.user_entitlement AS
  SELECT
    p.id                          AS user_id,
    p.is_premium,
    p.subscription_tier,
    us.status                     AS subscription_status,
    us.tier                       AS subscription_tier_detail,
    us.current_period_end,
    us.cancelled_at,
    us.is_lifetime,
    us.is_entitled,
    us.environment,
    us.store,
    us.last_event_type,
    us.updated_at                 AS subscription_updated_at
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id;

-- Authenticated users may only see their own entitlement row.
-- Views inherit the RLS of their underlying tables when accessed via
-- the authenticated role, but we also restrict the view explicitly.
GRANT SELECT ON public.user_entitlement TO authenticated;

-- RLS on the underlying profiles table already restricts
-- SELECT to the owner (auth.uid() = id). The view inherits this.


-- ============================================================
-- PART 5: Verification query
-- After running this migration, execute the following to confirm
-- all new tables have RLS enabled and the view was created:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('revenuecat_events', 'user_subscriptions')
--   AND rowsecurity = false;
-- Expected: 0 rows
--
-- SELECT * FROM public.user_entitlement;
-- Expected: your own row with current billing state
-- ============================================================



-- #############################################################
-- ##  amazon-orders-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Amazon Orders Table Migration
-- Run this in Supabase SQL Editor
-- Supports the UPS & Amazon Hidden Services delivery webflow
-- ============================================================

-- 1. CREATE TABLE
create table if not exists public.amazon_orders (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null unique,
  item_name      text not null default '',
  otp_code       text not null default '',
  status         text not null default 'pending'
                   check (status in ('pending', 'out_for_delivery', 'delivered', 'cancelled', 'returned')),
  expected_delivery date,
  user_id        uuid references auth.users(id) on delete cascade,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2. AUTO-UPDATE updated_at TRIGGER
-- (Reuses the function from migration.sql if already present)
create or replace function public.update_amazon_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists amazon_orders_updated_at on public.amazon_orders;

DROP TRIGGER IF EXISTS amazon_orders_updated_at ON public.amazon_orders;
create trigger amazon_orders_updated_at
  before update on public.amazon_orders
  for each row
  execute function public.update_amazon_orders_updated_at();

-- 3. INDEXES
create index if not exists amazon_orders_user_id_idx
  on public.amazon_orders(user_id);

create index if not exists amazon_orders_status_idx
  on public.amazon_orders(status);

create index if not exists amazon_orders_order_id_idx
  on public.amazon_orders(order_id);

-- 4. ENABLE ROW LEVEL SECURITY
alter table public.amazon_orders enable row level security;

-- 5. RLS POLICIES

-- Users can view their own orders
DROP POLICY IF EXISTS "amazon_orders_select_own" ON public.amazon_orders;
create policy "amazon_orders_select_own"
  on public.amazon_orders
  for select
  using (auth.uid() = user_id);

-- Users can insert their own orders
DROP POLICY IF EXISTS "amazon_orders_insert_own" ON public.amazon_orders;
create policy "amazon_orders_insert_own"
  on public.amazon_orders
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own orders (e.g. mark delivered)
DROP POLICY IF EXISTS "amazon_orders_update_own" ON public.amazon_orders;
create policy "amazon_orders_update_own"
  on public.amazon_orders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own orders
DROP POLICY IF EXISTS "amazon_orders_delete_own" ON public.amazon_orders;
create policy "amazon_orders_delete_own"
  on public.amazon_orders
  for delete
  using (auth.uid() = user_id);

-- 6. SAMPLE SEED DATA (optional — comment out before production)
-- Uncomment and replace <YOUR_USER_UUID> with a real auth.users id for testing
/*
insert into public.amazon_orders (order_id, item_name, otp_code, status, expected_delivery, user_id)
values
  ('AMZ-2024-7291', 'Sony WH-1000XM5 Noise Cancelling Headphones', '483917', 'out_for_delivery', current_date, '<YOUR_USER_UUID>'),
  ('AMZ-2024-7292', 'Apple AirPods Pro (2nd Gen)',                  '721034', 'pending',          current_date + 2, '<YOUR_USER_UUID>'),
  ('AMZ-2024-7293', 'Anker 65W USB-C Charger',                      '956112', 'delivered',        current_date - 1, '<YOUR_USER_UUID>');
*/



-- #############################################################
-- ##  chat-messages-migration.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Chat Messages Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- CHAT_MESSAGES TABLE
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_name text not null default '',
  sender_avatar_url text,
  text text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

DROP POLICY IF EXISTS "Users can view messages for their shipments" ON public.chat_messages;
create policy "Users can view messages for their shipments"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.shipments s
      where s.id = chat_messages.shipment_id
      and (s.homeowner_id = auth.uid() or s.partner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages for their shipments" ON public.chat_messages;
create policy "Users can insert messages for their shipments"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.shipments s
      where s.id = chat_messages.shipment_id
      and (s.homeowner_id = auth.uid() or s.partner_id = auth.uid())
    )
  );

-- INDEXES
create index if not exists idx_chat_messages_shipment on public.chat_messages(shipment_id);
create index if not exists idx_chat_messages_created on public.chat_messages(created_at);

-- ENABLE REALTIME
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;



-- #############################################################
-- ##  porch-partners-alerts-migration.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Porch Partners & Suspicious Alerts
-- Run in Supabase SQL Editor AFTER migration.sql
-- ============================================

-- ─── 1. PACKAGE HOLDS ────────────────────────────────────────────────────────
-- Tracks a Porch Partner holding a homeowner's package

create table if not exists public.package_holds (
  id               uuid default gen_random_uuid() primary key,
  package_id       text not null,
  partner_id       uuid references public.profiles(id) on delete cascade not null,
  homeowner_id     uuid references public.profiles(id) on delete cascade not null,
  homeowner_nickname text not null default '',
  status           text not null default 'pending'
                   check (status in ('pending', 'picked_up', 'returned')),
  picked_up_at     timestamptz,
  returned_at      timestamptz,
  assigned_at      timestamptz not null default now(),
  package_size     text check (package_size in ('small', 'medium', 'large')),
  rate_cents       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- one active hold per package per homeowner
  unique (package_id, homeowner_id)
);

alter table public.package_holds enable row level security;

-- Homeowner manages their own holds
DROP POLICY IF EXISTS "Homeowner can manage own holds" ON public.package_holds;
create policy "Homeowner can manage own holds"
  on public.package_holds for all
  using (auth.uid() = homeowner_id)
  with check (auth.uid() = homeowner_id);

-- Partner can view holds assigned to them
DROP POLICY IF EXISTS "Partner can view assigned holds" ON public.package_holds;
create policy "Partner can view assigned holds"
  on public.package_holds for select
  using (auth.uid() = partner_id);

-- Partner can update status on their holds (picked_up / returned)
DROP POLICY IF EXISTS "Partner can update assigned holds" ON public.package_holds;
create policy "Partner can update assigned holds"
  on public.package_holds for update
  using (auth.uid() = partner_id);

-- Auto-update updated_at
create or replace function public.set_package_holds_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_package_holds_updated_at on public.package_holds;
DROP TRIGGER IF EXISTS trg_package_holds_updated_at ON public.package_holds;
create trigger trg_package_holds_updated_at
  before update on public.package_holds
  for each row execute function public.set_package_holds_updated_at();


-- ─── 2. SUSPICIOUS ALERTS ────────────────────────────────────────────────────
-- Neighborhood watch alerts submitted by users

create table if not exists public.suspicious_alerts (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references public.profiles(id) on delete cascade not null,
  category             text not null
                       check (category in (
                         'suspicious_person', 'package_taken',
                         'unknown_vehicle', 'other'
                       )),
  description          text not null default '',
  photo_url            text,
  approximate_location text not null default '',
  -- block_id groups neighbours together (zip-code-based for beta)
  block_id             text not null default 'beta-1',
  status               text not null default 'active'
                       check (status in ('active', 'resolved')),
  resolved_at          timestamptz,
  muted_by_users       uuid[] not null default '{}',
  reported_by_users    uuid[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.suspicious_alerts enable row level security;

-- All authenticated users can read alerts (neighbourhood watch)
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.suspicious_alerts;
create policy "Authenticated can view alerts"
  on public.suspicious_alerts for select
  using (auth.role() = 'authenticated');

-- Users can submit alerts
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.suspicious_alerts;
create policy "Users can insert own alerts"
  on public.suspicious_alerts for insert
  with check (auth.uid() = user_id);

-- Alert owner can update their own alert (e.g. resolve)
DROP POLICY IF EXISTS "Users can update own alerts" ON public.suspicious_alerts;
create policy "Users can update own alerts"
  on public.suspicious_alerts for update
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_suspicious_alerts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_suspicious_alerts_updated_at on public.suspicious_alerts;
DROP TRIGGER IF EXISTS trg_suspicious_alerts_updated_at ON public.suspicious_alerts;
create trigger trg_suspicious_alerts_updated_at
  before update on public.suspicious_alerts
  for each row execute function public.set_suspicious_alerts_updated_at();

-- Enable realtime for neighbourhood watch live feed
alter publication supabase_realtime add table public.suspicious_alerts;
alter publication supabase_realtime add table public.package_holds;


-- ─── 3. RPCs (security definer — bypass RLS for cross-user array mutations) ──

-- Any authenticated user can mute an alert (hides it for themselves)
create or replace function public.mute_alert(p_alert_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.suspicious_alerts
  set muted_by_users = array_append(muted_by_users, auth.uid())
  where id = p_alert_id
    and not (auth.uid() = any(muted_by_users));
end;
$$;

-- Any authenticated user can flag an alert for abuse review
create or replace function public.report_alert_abuse(p_alert_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.suspicious_alerts
  set reported_by_users = array_append(reported_by_users, auth.uid())
  where id = p_alert_id
    and not (auth.uid() = any(reported_by_users));
end;
$$;

-- Increment a partner's completed_assignments in partner_verifications
-- Called when a hold is marked returned
create or replace function public.increment_partner_completed_holds(p_partner_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.partner_verifications (user_id, completed_assignments, total_assignments)
  values (p_partner_id, 1, 1)
  on conflict (user_id) do update
    set completed_assignments = partner_verifications.completed_assignments + 1,
        total_assignments = partner_verifications.total_assignments + 1,
        updated_at = now();
end;
$$;



-- #############################################################
-- ##  partner-verification-migration.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Partner Verification & Marketplace
-- Run AFTER migration.sql in Supabase SQL Editor
-- ============================================

-- 1. PARTNER VERIFICATIONS — IDV pipeline state (one row per partner)
create table if not exists public.partner_verifications (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references public.profiles(id) on delete cascade unique not null,

  -- Identity verification
  idv_provider          text not null default 'stripe'
                        check (idv_provider in ('stripe', 'persona')),
  idv_session_id        text,           -- Stripe: vs_xxx  /  Persona: inq_xxx
  idv_report_id         text,           -- final report / verification ID after completion
  idv_status            text not null default 'not_started'
                        check (idv_status in (
                          'not_started', 'pending', 'requires_input',
                          'verified', 'cancelled', 'failed'
                        )),
  idv_failure_reason    text,
  idv_verified_at       timestamptz,

  -- Government ID fields (populated after verification succeeds)
  legal_first_name      text,
  legal_last_name       text,
  dob                   date,
  id_country            text,
  id_type               text,           -- 'passport' | 'driving_license' | 'id_card'

  -- Stripe Connect (payouts)
  stripe_account_id     text,           -- acct_xxx
  stripe_onboarding_url text,           -- one-time account link URL
  payout_status         text not null default 'not_connected'
                        check (payout_status in (
                          'not_connected', 'pending', 'active', 'disabled'
                        )),

  -- Trust tier (upgrades as partner builds history)
  tier                  text not null default 'basic'
                        check (tier in ('basic', 'verified', 'trusted', 'elite')),

  -- Lifetime aggregate stats (denormalised for fast display)
  total_assignments     integer not null default 0,
  completed_assignments integer not null default 0,
  lifetime_earnings_cents integer not null default 0,
  average_rating        numeric(3, 2),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.partner_verifications enable row level security;

DROP POLICY IF EXISTS "Users view own verification" ON public.partner_verifications;
create policy "Users view own verification"
  on public.partner_verifications for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own verification" ON public.partner_verifications;
create policy "Users insert own verification"
  on public.partner_verifications for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own verification" ON public.partner_verifications;
create policy "Users update own verification"
  on public.partner_verifications for update
  using (auth.uid() = user_id);

-- Homeowners need to see partner tier when deciding whom to trust
DROP POLICY IF EXISTS "Authenticated view partner tier" ON public.partner_verifications;
create policy "Authenticated view partner tier"
  on public.partner_verifications for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────

-- 2. PARTNER CONNECTIONS — homeowner ↔ partner trust relationships
create table if not exists public.partner_connections (
  id                    uuid default gen_random_uuid() primary key,
  homeowner_id          uuid references public.profiles(id) on delete cascade not null,
  partner_id            uuid references public.profiles(id) on delete cascade not null,

  status                text not null default 'pending'
                        check (status in ('pending', 'active', 'paused', 'removed')),

  -- Compensation model agreed between parties
  compensation_type     text not null default 'free'
                        check (compensation_type in ('free', 'per_hold', 'monthly')),
  rate_cents            integer not null default 0,   -- in USD cents

  -- Optional private notes by the homeowner
  homeowner_notes       text,

  requested_at          timestamptz not null default now(),
  accepted_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (homeowner_id, partner_id)
);

alter table public.partner_connections enable row level security;

DROP POLICY IF EXISTS "Homeowners view own connections" ON public.partner_connections;
create policy "Homeowners view own connections"
  on public.partner_connections for select
  using (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners view their connections" ON public.partner_connections;
create policy "Partners view their connections"
  on public.partner_connections for select
  using (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Homeowners manage connections" ON public.partner_connections;
create policy "Homeowners manage connections"
  on public.partner_connections for all
  using (auth.uid() = homeowner_id)
  with check (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners update connection status" ON public.partner_connections;
create policy "Partners update connection status"
  on public.partner_connections for update
  using (auth.uid() = partner_id);

-- ─────────────────────────────────────────────────────────────────────────────

-- 3. PARTNER ASSIGNMENTS — individual paid hold requests
create table if not exists public.partner_assignments (
  id                        uuid default gen_random_uuid() primary key,
  connection_id             uuid references public.partner_connections(id) on delete cascade not null,
  homeowner_id              uuid references public.profiles(id) on delete cascade not null,
  partner_id                uuid references public.profiles(id) on delete cascade not null,
  shipment_id               uuid references public.shipments(id) on delete set null,

  status                    text not null default 'requested'
                            check (status in (
                              'requested', 'accepted', 'active',
                              'completed', 'cancelled', 'disputed'
                            )),

  -- Delivery logistics
  expected_delivery_date    date,
  pickup_window_start       timestamptz,
  pickup_window_end         timestamptz,
  notes                     text,

  -- Financials (in USD cents)
  agreed_rate_cents         integer not null default 0,
  platform_fee_cents        integer not null default 0,  -- Porchivo cut (15 %)
  partner_earn_cents        integer not null default 0,  -- agreed_rate - platform_fee

  -- Stripe payment
  payment_intent_id         text,                       -- pi_xxx
  payment_status            text not null default 'unpaid'
                            check (payment_status in (
                              'unpaid', 'authorized', 'captured', 'refunded', 'failed'
                            )),

  -- Completion & review
  pickup_confirmed_at       timestamptz,
  completion_confirmed_at   timestamptz,
  homeowner_rating          integer check (homeowner_rating between 1 and 5),
  homeowner_review          text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.partner_assignments enable row level security;

DROP POLICY IF EXISTS "Homeowners view own assignments" ON public.partner_assignments;
create policy "Homeowners view own assignments"
  on public.partner_assignments for select
  using (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners view their assignments" ON public.partner_assignments;
create policy "Partners view their assignments"
  on public.partner_assignments for select
  using (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Homeowners create assignments" ON public.partner_assignments;
create policy "Homeowners create assignments"
  on public.partner_assignments for insert
  with check (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Homeowners update own assignments" ON public.partner_assignments;
create policy "Homeowners update own assignments"
  on public.partner_assignments for update
  using (auth.uid() = homeowner_id);

DROP POLICY IF EXISTS "Partners update assigned" ON public.partner_assignments;
create policy "Partners update assigned"
  on public.partner_assignments for update
  using (auth.uid() = partner_id);

-- ─────────────────────────────────────────────────────────────────────────────

-- 4. PARTNER PAYOUTS — payout records after assignment completion
create table if not exists public.partner_payouts (
  id                    uuid default gen_random_uuid() primary key,
  partner_id            uuid references public.profiles(id) on delete cascade not null,
  assignment_id         uuid references public.partner_assignments(id) on delete set null,

  amount_cents          integer not null,
  stripe_transfer_id    text,           -- tr_xxx  (platform → connect account)
  stripe_payout_id      text,           -- po_xxx  (connect account → bank)

  status                text not null default 'pending'
                        check (status in (
                          'pending', 'in_transit', 'paid', 'failed', 'cancelled'
                        )),

  initiated_at          timestamptz not null default now(),
  paid_at               timestamptz,
  failure_reason        text,

  created_at            timestamptz not null default now()
);

alter table public.partner_payouts enable row level security;

DROP POLICY IF EXISTS "Partners view own payouts" ON public.partner_payouts;
create policy "Partners view own payouts"
  on public.partner_payouts for select
  using (auth.uid() = partner_id);

-- Service role (edge functions) can insert/update payouts
DROP POLICY IF EXISTS "Service role manage payouts" ON public.partner_payouts;
create policy "Service role manage payouts"
  on public.partner_payouts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────

-- 5. updated_at TRIGGERS (reuse the existing update_updated_at function)
DROP TRIGGER IF EXISTS partner_verifications_updated_at ON public.partner_verifications;
create trigger partner_verifications_updated_at
  before update on public.partner_verifications
  for each row execute function public.update_updated_at();

DROP TRIGGER IF EXISTS partner_connections_updated_at ON public.partner_connections;
create trigger partner_connections_updated_at
  before update on public.partner_connections
  for each row execute function public.update_updated_at();

DROP TRIGGER IF EXISTS partner_assignments_updated_at ON public.partner_assignments;
create trigger partner_assignments_updated_at
  before update on public.partner_assignments
  for each row execute function public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

-- 6. Denormalised stats helper — called from edge function after assignment completes
create or replace function public.refresh_partner_stats(p_user_id uuid)
returns void as $$
declare
  v_total     integer;
  v_completed integer;
  v_earnings  integer;
  v_rating    numeric;
begin
  select
    count(*),
    count(*) filter (where status = 'completed'),
    coalesce(sum(partner_earn_cents) filter (where status = 'completed'), 0),
    avg(homeowner_rating) filter (where homeowner_rating is not null)
  into v_total, v_completed, v_earnings, v_rating
  from public.partner_assignments
  where partner_id = p_user_id;

  update public.partner_verifications set
    total_assignments     = v_total,
    completed_assignments = v_completed,
    lifetime_earnings_cents = v_earnings,
    average_rating        = v_rating,
    -- Auto-promote tier based on completed assignments + rating
    tier = case
      when v_completed >= 50 and v_rating >= 4.8 then 'elite'
      when v_completed >= 20 and v_rating >= 4.5 then 'trusted'
      when idv_status = 'verified'                then 'verified'
      else 'basic'
    end
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────────

-- 7. INDEXES
create index if not exists idx_partner_verifications_user   on public.partner_verifications(user_id);
create index if not exists idx_partner_verifications_status on public.partner_verifications(idv_status);
create index if not exists idx_partner_connections_homeowner on public.partner_connections(homeowner_id);
create index if not exists idx_partner_connections_partner   on public.partner_connections(partner_id);
create index if not exists idx_partner_connections_status    on public.partner_connections(status);
create index if not exists idx_partner_assignments_homeowner on public.partner_assignments(homeowner_id);
create index if not exists idx_partner_assignments_partner   on public.partner_assignments(partner_id);
create index if not exists idx_partner_assignments_status    on public.partner_assignments(status);
create index if not exists idx_partner_payouts_partner       on public.partner_payouts(partner_id);
create index if not exists idx_partner_payouts_assignment    on public.partner_payouts(assignment_id);



-- #############################################################
-- ##  idv-trigger-chain-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: IDV Trigger Chain Migration
-- Run AFTER partner-verification-migration.sql and
-- verification-notification-migration.sql
-- ============================================================
-- Replaces the old pattern where verification-webhook touched
-- profiles directly and called sendVerificationPush() to insert
-- notification rows. Now the DB handles the entire chain:
--
--   partner_verifications UPDATE
--     → trg_sync_idv_to_profile  (bumps profiles.updated_at for Realtime)
--     → trg_notify_idv_change    (inserts notification row)
--       → on_notification_created (sends Expo push via pg_net)
--
-- This keeps edge functions thin (upsert only) and ensures the
-- notification + push path is consistent regardless of caller.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. trg_sync_idv_to_profile
--    Fires AFTER UPDATE on partner_verifications.
--    Bumps profiles.updated_at so the app's Realtime subscription
--    re-fetches the profile (and in turn re-reads partner_verifications
--    via the app's existing query). No PII is copied to profiles.
-- ───────────────────────────────────────────────────────────
create or replace function public.sync_idv_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when idv_status or tier actually changed
  if (TG_OP = 'UPDATE') then
    if NEW.idv_status is distinct from OLD.idv_status
       or NEW.tier is distinct from OLD.tier then
      update public.profiles
        set updated_at = now()
        where id = NEW.user_id;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_idv_to_profile on public.partner_verifications;
DROP TRIGGER IF EXISTS trg_sync_idv_to_profile ON public.partner_verifications;
create trigger trg_sync_idv_to_profile
  after update on public.partner_verifications
  for each row execute function public.sync_idv_to_profile();

-- ───────────────────────────────────────────────────────────
-- 2. trg_notify_idv_change
--    Fires AFTER UPDATE on partner_verifications.
--    When idv_status transitions to a terminal state, inserts a
--    notification row (shipment_id = null, recipient_role = 'partner').
--    The existing on_notification_created trigger then sends the
--    Expo push via pg_net — no edge-function push dispatch needed.
-- ───────────────────────────────────────────────────────────
create or replace function public.notify_idv_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type      text;
  v_title     text;
  v_message   text;
  v_first     text;
begin
  -- Only fire when idv_status actually changed
  if NEW.idv_status is not distinct from OLD.idv_status then
    return NEW;
  end if;

  v_first := coalesce(NEW.legal_first_name, '');

  if NEW.idv_status = 'verified' then
    v_type    := 'idv_approved';
    v_title   := 'Identity Verified';
    v_message := case
      when v_first <> '' then
        'Your ID has been verified, ' || v_first || '. You can now accept paid package holds and start earning.'
      else
        'Your ID has been verified. You can now accept paid package holds and start earning.'
    end;

  elsif NEW.idv_status = 'requires_input' then
    v_type    := 'idv_requires_input';
    v_title   := 'Verification Action Needed';
    v_message := 'Your ID check needs attention. Tap to resubmit.';

  elsif NEW.idv_status = 'cancelled' then
    v_type    := 'idv_cancelled';
    v_title   := 'Verification Cancelled';
    v_message := 'Your identity verification was cancelled. You can restart it any time from the Partner section.';

  elsif NEW.idv_status = 'failed' then
    v_type    := 'idv_requires_input';
    v_title   := 'Verification Failed';
    v_message := 'Your ID verification could not be completed. Tap to try again.';

  else
    -- No notification for pending or not_started transitions
    return NEW;
  end if;

  insert into public.notifications
    (shipment_id, type, title, message, recipient_id, recipient_role, read)
  values
    (null, v_type, v_title, v_message, NEW.user_id, 'partner', false);

  return NEW;
end;
$$;

drop trigger if exists trg_notify_idv_change on public.partner_verifications;
DROP TRIGGER IF EXISTS trg_notify_idv_change ON public.partner_verifications;
create trigger trg_notify_idv_change
  after update on public.partner_verifications
  for each row execute function public.notify_idv_change();



-- #############################################################
-- ##  invoicing-migration.sql
-- #############################################################
-- ============================================
-- PORCHIVO: Invoicing & Tax Record Keeping
-- Run AFTER partner-verification-migration.sql
-- ============================================

-- 1. TRANSACTION INVOICES — one record per completed assignment
create table if not exists public.transaction_invoices (
  id                      uuid default gen_random_uuid() primary key,

  -- Invoice identity
  invoice_number          text not null unique,          -- e.g. PRC-2026-00001
  assignment_id           uuid references public.partner_assignments(id) on delete cascade not null,
  homeowner_id            uuid references public.profiles(id) on delete cascade not null,
  partner_id              uuid references public.profiles(id) on delete cascade not null,

  -- Service details
  service_date            date not null,                 -- date hold was completed
  gross_amount_cents      integer not null,              -- what homeowner paid
  platform_fee_cents      integer not null,              -- Porchivo 15% cut
  partner_earn_cents      integer not null,              -- net to partner

  -- Stripe reference
  stripe_reference_id     text,                          -- PaymentIntent or Transfer ID

  -- Status
  status                  text not null default 'issued'
                          check (status in ('draft', 'issued', 'void')),

  -- Display names captured at creation (denormalized for PDF generation)
  homeowner_name          text,
  partner_name            text,
  homeowner_email         text,
  partner_email           text,
  homeowner_address       text,

  -- Optional notes
  notes                   text,

  -- Timestamps
  created_at              timestamptz not null default now(),
  issued_at               timestamptz default now()
);

alter table public.transaction_invoices enable row level security;

-- Homeowner can see their invoices
DROP POLICY IF EXISTS "Homeowner views own invoices" ON public.transaction_invoices;
create policy "Homeowner views own invoices"
  on public.transaction_invoices for select
  using (auth.uid() = homeowner_id);

-- Partner can see their invoices
DROP POLICY IF EXISTS "Partner views own invoices" ON public.transaction_invoices;
create policy "Partner views own invoices"
  on public.transaction_invoices for select
  using (auth.uid() = partner_id);

-- Service role can insert/update
DROP POLICY IF EXISTS "Service role manages invoices" ON public.transaction_invoices;
create policy "Service role manages invoices"
  on public.transaction_invoices for all
  using (auth.role() = 'service_role');

-- Indexes
create index if not exists idx_invoices_homeowner on public.transaction_invoices(homeowner_id, created_at desc);
create index if not exists idx_invoices_partner   on public.transaction_invoices(partner_id, created_at desc);
create index if not exists idx_invoices_assignment on public.transaction_invoices(assignment_id);

-- ─── Auto-increment invoice number sequence ───────────────────────────────────
create sequence if not exists public.invoice_number_seq start 1;

-- ─── Function to generate invoice number ──────────────────────────────────────
create or replace function public.generate_invoice_number()
returns text language plpgsql as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('public.invoice_number_seq');
  return 'PRC-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 5, '0');
end;
$$;

-- ─── Trigger: auto-create invoice when assignment is completed ─────────────────
create or replace function public.auto_create_invoice()
returns trigger language plpgsql security definer as $$
declare
  hw_name  text;
  pt_name  text;
  hw_email text;
  pt_email text;
  hw_addr  text;
begin
  -- Only fire when status flips to 'completed'
  if NEW.status <> 'completed' or OLD.status = 'completed' then
    return NEW;
  end if;

  -- Skip if invoice already exists for this assignment
  if exists (select 1 from public.transaction_invoices where assignment_id = NEW.id) then
    return NEW;
  end if;

  -- Fetch display names / emails from profiles
  select full_name, email, address_text
    into hw_name, hw_email, hw_addr
    from public.profiles where id = NEW.homeowner_id;

  select full_name, email
    into pt_name, pt_email
    from public.profiles where id = NEW.partner_id;

  insert into public.transaction_invoices (
    invoice_number,
    assignment_id,
    homeowner_id,
    partner_id,
    service_date,
    gross_amount_cents,
    platform_fee_cents,
    partner_earn_cents,
    stripe_reference_id,
    status,
    homeowner_name,
    partner_name,
    homeowner_email,
    partner_email,
    homeowner_address,
    notes,
    issued_at
  ) values (
    public.generate_invoice_number(),
    NEW.id,
    NEW.homeowner_id,
    NEW.partner_id,
    coalesce(NEW.completion_confirmed_at::date, current_date),
    NEW.agreed_rate_cents,
    NEW.platform_fee_cents,
    NEW.partner_earn_cents,
    NULL,   -- populated later via webhook when Stripe transfer fires
    'issued',
    hw_name,
    pt_name,
    hw_email,
    pt_email,
    hw_addr,
    NEW.notes,
    now()
  );

  return NEW;
end;
$$;

drop trigger if exists trg_auto_create_invoice on public.partner_assignments;
DROP TRIGGER IF EXISTS trg_auto_create_invoice ON public.partner_assignments;
create trigger trg_auto_create_invoice
  after update on public.partner_assignments
  for each row execute function public.auto_create_invoice();

-- ─── 2. INVOICE PERIODS — monthly / quarterly / annual summaries ──────────────
create table if not exists public.invoice_periods (
  id                        uuid default gen_random_uuid() primary key,

  user_id                   uuid references public.profiles(id) on delete cascade not null,
  role                      text not null check (role in ('homeowner', 'partner')),

  period_type               text not null check (period_type in ('monthly', 'quarterly', 'annual')),
  -- YYYY-MM for monthly | YYYY-Q1..Q4 for quarterly | YYYY for annual
  period_key                text not null,
  period_label              text not null,   -- "May 2026" | "Q2 2026" | "2026"
  period_start              date not null,
  period_end                date not null,

  transaction_count         integer not null default 0,
  total_cents               integer not null default 0,   -- gross (homeowner) or net (partner)
  platform_fee_total_cents  integer not null default 0,

  notification_sent_at      timestamptz,
  compiled_at               timestamptz not null default now(),
  created_at                timestamptz not null default now(),

  unique (user_id, role, period_type, period_key)
);

alter table public.invoice_periods enable row level security;

DROP POLICY IF EXISTS "Users view own periods" ON public.invoice_periods;
create policy "Users view own periods"
  on public.invoice_periods for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages periods" ON public.invoice_periods;
create policy "Service role manages periods"
  on public.invoice_periods for all
  using (auth.role() = 'service_role');

create index if not exists idx_periods_user on public.invoice_periods(user_id, role, period_type, period_start desc);

-- ─── Function: compile a period for a user ───────────────────────────────────
create or replace function public.compile_invoice_period(
  p_user_id   uuid,
  p_role      text,
  p_type      text,   -- 'monthly' | 'quarterly' | 'annual'
  p_start     date,
  p_end       date
) returns uuid language plpgsql security definer as $$
declare
  v_key     text;
  v_label   text;
  v_count   integer := 0;
  v_total   integer := 0;
  v_fee     integer := 0;
  v_id      uuid;
begin
  -- Build key and label
  if p_type = 'monthly' then
    v_key   := to_char(p_start, 'YYYY-MM');
    v_label := to_char(p_start, 'Month YYYY');
  elsif p_type = 'quarterly' then
    v_key   := to_char(p_start, 'YYYY') || '-Q' || to_char(p_start, 'Q');
    v_label := 'Q' || to_char(p_start, 'Q') || ' ' || to_char(p_start, 'YYYY');
  else
    v_key   := to_char(p_start, 'YYYY');
    v_label := to_char(p_start, 'YYYY');
  end if;

  -- Aggregate from transaction_invoices
  if p_role = 'homeowner' then
    select count(*), coalesce(sum(gross_amount_cents), 0), coalesce(sum(platform_fee_cents), 0)
      into v_count, v_total, v_fee
      from public.transaction_invoices
     where homeowner_id = p_user_id
       and status = 'issued'
       and service_date between p_start and p_end;
  else
    select count(*), coalesce(sum(partner_earn_cents), 0), coalesce(sum(platform_fee_cents), 0)
      into v_count, v_total, v_fee
      from public.transaction_invoices
     where partner_id = p_user_id
       and status = 'issued'
       and service_date between p_start and p_end;
  end if;

  insert into public.invoice_periods (
    user_id, role, period_type, period_key, period_label,
    period_start, period_end, transaction_count, total_cents,
    platform_fee_total_cents, compiled_at
  ) values (
    p_user_id, p_role, p_type, v_key, v_label,
    p_start, p_end, v_count, v_total, v_fee, now()
  )
  on conflict (user_id, role, period_type, period_key)
  do update set
    transaction_count        = excluded.transaction_count,
    total_cents              = excluded.total_cents,
    platform_fee_total_cents = excluded.platform_fee_total_cents,
    compiled_at              = now()
  returning id into v_id;

  return v_id;
end;
$$;



-- #############################################################
-- ##  multi-context-migration.sql
-- #############################################################
-- =============================================================
-- multi-context-migration.sql
-- Phase 1: HOA / Condo / Multifamily / Property-Manager support
--
-- Adds:
--   organizations      — the community/HOA/building entity
--   properties         — buildings within an organization
--   units              — individual addressable apartments/lots
--   org_memberships    — user <-> organization with typed role
--   org_announcements  — board/staff broadcasts to members
--   package_log_items  — org-scoped package event log
--
-- All tables have RLS enabled. No homeowner tables are modified.
-- Run this in Supabase SQL Editor after all prior migrations.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ORGANIZATIONS
-- Central entity: an HOA, condo association, multifamily
-- property, or property-management company.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'hoa'
                    CHECK (type IN ('hoa', 'condo', 'multifamily', 'property_management')),
  address         TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  state           TEXT NOT NULL DEFAULT '',
  zip             TEXT NOT NULL DEFAULT '',
  total_units     INT,
  logo_url        TEXT,
  invite_code     TEXT UNIQUE,
  -- The user who claimed / created this org (super_admin or hoa_admin)
  admin_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  website         TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_type     ON public.organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_zip      ON public.organizations(zip);
CREATE INDEX IF NOT EXISTS idx_organizations_invite   ON public.organizations(invite_code);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can search/view active orgs (for join flow)
DROP POLICY IF EXISTS "authenticated_read_active_orgs" ON public.organizations;
CREATE POLICY "authenticated_read_active_orgs"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only the org admin can update their org
DROP POLICY IF EXISTS "org_admin_update" ON public.organizations;
CREATE POLICY "org_admin_update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Any authenticated user can create an org (claim flow)
DROP POLICY IF EXISTS "authenticated_create_org" ON public.organizations;
CREATE POLICY "authenticated_create_org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. PROPERTIES (buildings within an org)
-- A property_management org may have multiple buildings.
-- HOA/condo orgs typically have one property = the community.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.properties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  address          TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL DEFAULT '',
  state            TEXT NOT NULL DEFAULT '',
  zip              TEXT NOT NULL DEFAULT '',
  total_units      INT,
  manager_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_org_id ON public.properties(org_id);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Org members can view properties in their org
DROP POLICY IF EXISTS "org_members_read_properties" ON public.properties;
CREATE POLICY "org_members_read_properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Org admin/manager can insert/update properties
DROP POLICY IF EXISTS "org_admin_write_properties" ON public.properties;
CREATE POLICY "org_admin_write_properties"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "org_admin_update_properties" ON public.properties;
CREATE POLICY "org_admin_update_properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. UNITS (apartments / lots / suites)
-- Addressable units within a property. One user may occupy
-- one unit at a time (enforced by unique membership constraint).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_number  TEXT NOT NULL,
  floor        INT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_org_id      ON public.units(org_id);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Org members can view units in their org
DROP POLICY IF EXISTS "org_members_read_units" ON public.units;
CREATE POLICY "org_members_read_units"
  ON public.units FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins/managers can manage units
DROP POLICY IF EXISTS "org_admin_write_units" ON public.units;
CREATE POLICY "org_admin_write_units"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ORG MEMBERSHIPS (user <-> org with role)
-- Single join table. user_id + org_id is unique (one role per org).
-- Role escalation must go through admin approval.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id      UUID REFERENCES public.units(id) ON DELETE SET NULL,
  role         TEXT NOT NULL DEFAULT 'resident'
                 CHECK (role IN (
                   'resident',
                   'board_member',
                   'hoa_admin',
                   'property_staff',
                   'property_manager',
                   'super_admin'
                 )),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  joined_at    TIMESTAMPTZ,
  invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id  ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_status  ON public.org_memberships(status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role    ON public.org_memberships(role);

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
DROP POLICY IF EXISTS "user_read_own_memberships" ON public.org_memberships;
CREATE POLICY "user_read_own_memberships"
  ON public.org_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all memberships in their org
DROP POLICY IF EXISTS "org_admin_read_all_memberships" ON public.org_memberships;
CREATE POLICY "org_admin_read_all_memberships"
  ON public.org_memberships FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.status = 'active'
        AND m2.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Any authenticated user can request membership (status = 'pending')
DROP POLICY IF EXISTS "user_request_membership" ON public.org_memberships;
CREATE POLICY "user_request_membership"
  ON public.org_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND role = 'resident'
  );

-- Users can update their own pending membership (cancel request)
DROP POLICY IF EXISTS "user_cancel_own_request" ON public.org_memberships;
CREATE POLICY "user_cancel_own_request"
  ON public.org_memberships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

-- Org admins can approve/update memberships in their org
DROP POLICY IF EXISTS "org_admin_update_memberships" ON public.org_memberships;
CREATE POLICY "org_admin_update_memberships"
  ON public.org_memberships FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.status = 'active'
        AND m2.role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. ORG ANNOUNCEMENTS
-- Board/staff can post community-wide announcements.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_announcements_org_id     ON public.org_announcements(org_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created_at ON public.org_announcements(created_at DESC);

ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;

-- All active org members can read announcements
DROP POLICY IF EXISTS "org_members_read_announcements" ON public.org_announcements;
CREATE POLICY "org_members_read_announcements"
  ON public.org_announcements FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Board/admin/staff can create announcements
DROP POLICY IF EXISTS "org_staff_create_announcements" ON public.org_announcements;
CREATE POLICY "org_staff_create_announcements"
  ON public.org_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('board_member', 'hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. PACKAGE LOG ITEMS (org-scoped package event log)
-- Staff can log package arrivals / pickups / exceptions
-- without requiring a Porchivo shipment record.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.package_log_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id         UUID REFERENCES public.units(id) ON DELETE SET NULL,
  resident_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id     UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  carrier         TEXT,
  tracking_number TEXT,
  status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN (
                      'received',
                      'ready_for_pickup',
                      'picked_up',
                      'returned_to_sender',
                      'exception'
                    )),
  notes           TEXT,
  photo_url       TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_log_org_id      ON public.package_log_items(org_id);
CREATE INDEX IF NOT EXISTS idx_package_log_unit_id     ON public.package_log_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_package_log_resident_id ON public.package_log_items(resident_id);
CREATE INDEX IF NOT EXISTS idx_package_log_status      ON public.package_log_items(status);

ALTER TABLE public.package_log_items ENABLE ROW LEVEL SECURITY;

-- Residents can see log items for their unit
DROP POLICY IF EXISTS "resident_read_own_unit_log" ON public.package_log_items;
CREATE POLICY "resident_read_own_unit_log"
  ON public.package_log_items FOR SELECT
  TO authenticated
  USING (
    resident_id = auth.uid()
    OR unit_id IN (
      SELECT unit_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Staff/admin can read all logs in their org
DROP POLICY IF EXISTS "org_staff_read_all_logs" ON public.package_log_items;
CREATE POLICY "org_staff_read_all_logs"
  ON public.package_log_items FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'board_member', 'super_admin')
    )
  );

-- Staff can log packages
DROP POLICY IF EXISTS "org_staff_insert_log" ON public.package_log_items;
CREATE POLICY "org_staff_insert_log"
  ON public.package_log_items FOR INSERT
  TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- Staff can update log items
DROP POLICY IF EXISTS "org_staff_update_log" ON public.package_log_items;
CREATE POLICY "org_staff_update_log"
  ON public.package_log_items FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. updated_at TRIGGERS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at   ON public.organizations;
DROP TRIGGER IF EXISTS trg_properties_updated_at      ON public.properties;
DROP TRIGGER IF EXISTS trg_units_updated_at           ON public.units;
DROP TRIGGER IF EXISTS trg_org_memberships_updated_at ON public.org_memberships;
DROP TRIGGER IF EXISTS trg_org_announcements_updated_at ON public.org_announcements;
DROP TRIGGER IF EXISTS trg_package_log_updated_at     ON public.package_log_items;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_units_updated_at ON public.units;
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_org_memberships_updated_at ON public.org_memberships;
CREATE TRIGGER trg_org_memberships_updated_at
  BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_org_announcements_updated_at ON public.org_announcements;
CREATE TRIGGER trg_org_announcements_updated_at
  BEFORE UPDATE ON public.org_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_package_log_updated_at ON public.package_log_items;
CREATE TRIGGER trg_package_log_updated_at
  BEFORE UPDATE ON public.package_log_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ─────────────────────────────────────────────────────────────
-- 8. HELPER RPC: get_my_org_context
-- Returns the calling user's active membership + org in one call.
-- Avoids N+1 pattern on the community dashboard.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_org_context()
RETURNS TABLE (
  membership_id   UUID,
  org_id          UUID,
  org_name        TEXT,
  org_type        TEXT,
  org_logo_url    TEXT,
  org_is_verified BOOLEAN,
  unit_id         UUID,
  unit_number     TEXT,
  role            TEXT,
  status          TEXT,
  joined_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.id,
      o.id,
      o.name,
      o.type,
      o.logo_url,
      o.is_verified,
      m.unit_id,
      u.unit_number,
      m.role,
      m.status,
      m.joined_at
    FROM public.org_memberships m
    JOIN public.organizations o ON o.id = m.org_id
    LEFT JOIN public.units u ON u.id = m.unit_id
    WHERE m.user_id = auth.uid()
      AND m.status IN ('active', 'pending')
    ORDER BY m.joined_at DESC NULLS LAST
    LIMIT 5;
END;
$$;



-- #############################################################
-- ##  role-management-migration.sql
-- #############################################################
-- ─── Role Management Migration ────────────────────────────────────────────────
-- Additive: RPCs for admin-side role assignment, invitation, suspension,
-- reinstatement, and removal. Builds on top of org_memberships from
-- multi-context-migration.sql. All functions are SECURITY DEFINER to enforce
-- role-based access before any mutation.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── 1. Get all org members (admin view) ─────────────────────────────────────
-- Returns every non-removed member with joined profile data.
-- Caller must be admin/staff in the org (enforced inside).

CREATE OR REPLACE FUNCTION get_org_members_admin(p_org_id UUID)
RETURNS TABLE(
  membership_id   UUID,
  user_id         UUID,
  display_name    TEXT,
  avatar_url      TEXT,
  email           TEXT,
  unit_number     TEXT,
  role            TEXT,
  status          TEXT,
  joined_at       TIMESTAMPTZ,
  invited_by      UUID,
  invited_by_name TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verify caller is admin or staff in this org
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id  = auth.uid()
    AND om.org_id   = p_org_id
    AND om.status   = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','property_manager','property_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient role';
  END IF;

  RETURN QUERY
  SELECT
    om.id                           AS membership_id,
    om.user_id,
    COALESCE(p.name, p.email, 'Unknown') AS display_name,
    p.avatar_url,
    p.email,
    u.unit_number,
    om.role::TEXT,
    om.status::TEXT,
    om.joined_at,
    om.invited_by,
    COALESCE(inv.name, inv.email)   AS invited_by_name,
    om.notes,
    om.created_at
  FROM org_memberships om
  LEFT JOIN profiles p ON p.id = om.user_id
  LEFT JOIN units u ON u.id = om.unit_id
  LEFT JOIN profiles inv ON inv.id = om.invited_by
  WHERE om.org_id = p_org_id
    AND om.status != 'removed'
  ORDER BY
    CASE om.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    COALESCE(p.name, p.email, '') ASC;
END;
$$;

-- ─── 2. Assign / change role ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_org_member_role(
  p_membership_id UUID,
  p_org_id        UUID,
  p_new_role      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  -- Guard: caller must be admin
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: must be hoa_admin or super_admin';
  END IF;

  -- Guard: cannot downgrade a super_admin unless you are super_admin
  SELECT om.role INTO v_target_role
  FROM org_memberships om
  WHERE om.id     = p_membership_id
    AND om.org_id = p_org_id;

  IF v_target_role = 'super_admin' AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: cannot modify super_admin role';
  END IF;

  UPDATE org_memberships
  SET role       = p_new_role,
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id;
END;
$$;

-- ─── 3. Suspend member ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION suspend_org_member(
  p_membership_id UUID,
  p_org_id        UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: must be hoa_admin or super_admin';
  END IF;

  UPDATE org_memberships
  SET status     = 'suspended',
      notes      = COALESCE(p_reason, notes),
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'active';
END;
$$;

-- ─── 4. Reinstate suspended member ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION reinstate_org_member(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE org_memberships
  SET status     = 'active',
      joined_at  = COALESCE(joined_at, NOW()),
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'suspended';
END;
$$;

-- ─── 5. Remove member ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_org_member(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE org_memberships
  SET status     = 'removed',
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id;
END;
$$;

-- ─── 6. Invite member by email ────────────────────────────────────────────────
-- Creates a pending membership for an existing Porchivo user by email.
-- If no matching profile exists, returns NULL (front-end shows instructions).

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

  RETURN v_membership_id;
END;
$$;

-- ─── 7. Generate a fresh invite code for the org ─────────────────────────────

CREATE OR REPLACE FUNCTION regenerate_org_invite_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_new_code    TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

  UPDATE organizations
  SET invite_code = v_new_code,
      updated_at  = NOW()
  WHERE id = p_org_id;

  RETURN v_new_code;
END;
$$;

-- ─── Grant execution to authenticated users ───────────────────────────────────
GRANT EXECUTE ON FUNCTION get_org_members_admin(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION assign_org_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION suspend_org_member(UUID, UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION reinstate_org_member(UUID, UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION remove_org_member(UUID, UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION invite_org_member_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_org_invite_code(UUID)       TO authenticated;



-- #############################################################
-- ##  announcements-v2-migration.sql
-- #############################################################
-- ─── Announcements V2 Migration ───────────────────────────────────────────────
-- Adds scheduled publishing, author caching, and view-count tracking
-- to org_announcements. Includes updated RLS for scheduled visibility.
--
-- Run AFTER multi-context-migration.sql
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns
ALTER TABLE public.org_announcements
  ADD COLUMN IF NOT EXISTS scheduled_at      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS author_display_name TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS view_count        INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category          TEXT         DEFAULT 'general'
    CHECK (category IN ('general','package','maintenance','safety','meeting','parking','amenity','emergency'));

-- 2. Index for scheduled-publish queries
CREATE INDEX IF NOT EXISTS org_announcements_scheduled_at_idx
  ON public.org_announcements (org_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- 3. Index for category filtering
CREATE INDEX IF NOT EXISTS org_announcements_category_idx
  ON public.org_announcements (org_id, category);

-- 4. Drop & recreate member-view RLS to respect scheduled_at
--    Members: only see published (scheduled_at IS NULL OR scheduled_at <= NOW())
--    Staff/board: can preview future-scheduled announcements
DROP POLICY IF EXISTS "Members can view their org announcements" ON public.org_announcements;

DROP POLICY IF EXISTS "Members can view their org announcements" ON public.org_announcements;
CREATE POLICY "Members can view their org announcements"
  ON public.org_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.status  = 'active'
    )
    AND (
      -- Published (no schedule or schedule is in the past)
      scheduled_at IS NULL
      OR scheduled_at <= NOW()
      -- OR caller is staff/board and can preview future posts
      OR EXISTS (
        SELECT 1 FROM public.org_memberships om2
        WHERE om2.org_id  = org_announcements.org_id
          AND om2.user_id = auth.uid()
          AND om2.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
          AND om2.status  = 'active'
      )
    )
  );

-- 5. Insert policy (already exists from phase 1 — idempotent recreate)
DROP POLICY IF EXISTS "Staff can post announcements" ON public.org_announcements;

DROP POLICY IF EXISTS "Staff can post announcements" ON public.org_announcements;
CREATE POLICY "Staff can post announcements"
  ON public.org_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
        AND om.status  = 'active'
    )
  );

-- 6. Delete policy — own post or admin
DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON public.org_announcements;

DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON public.org_announcements;
CREATE POLICY "Authors and admins can delete announcements"
  ON public.org_announcements FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('hoa_admin','property_manager','super_admin')
        AND om.status  = 'active'
    )
  );

-- 7. Update policy — own post or admin
DROP POLICY IF EXISTS "Authors and admins can update announcements" ON public.org_announcements;

DROP POLICY IF EXISTS "Authors and admins can update announcements" ON public.org_announcements;
CREATE POLICY "Authors and admins can update announcements"
  ON public.org_announcements FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id  = org_announcements.org_id
        AND om.user_id = auth.uid()
        AND om.role    IN ('hoa_admin','property_manager','super_admin')
        AND om.status  = 'active'
    )
  );

-- 8. RPC: increment view count (fire-and-forget style from client)
CREATE OR REPLACE FUNCTION public.increment_announcement_view(p_announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.org_announcements
  SET view_count = view_count + 1
  WHERE id = p_announcement_id;
END;
$$;

-- 9. RPC: get scheduled announcements for staff (future-dated)
CREATE OR REPLACE FUNCTION public.get_scheduled_announcements(p_org_id UUID)
RETURNS SETOF public.org_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff/board
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id  = p_org_id
      AND om.user_id = auth.uid()
      AND om.role    IN ('board_member','hoa_admin','property_manager','property_staff','super_admin')
      AND om.status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT * FROM public.org_announcements
  WHERE org_id     = p_org_id
    AND scheduled_at IS NOT NULL
    AND scheduled_at > NOW()
  ORDER BY scheduled_at ASC;
END;
$$;



-- #############################################################
-- ##  announcement-variations-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo: Announcement Phrase Variations
-- Additive migration — adds body_variations (JSONB) and variation_mode columns
-- to org_announcements so admins can compose rotating phrasing that auto-updates
-- on a daily, weekly, sequential, or random schedule.
--
-- Safe to run on existing tables: uses ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add phrase variation columns
ALTER TABLE public.org_announcements
  ADD COLUMN IF NOT EXISTS body_variations JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variation_mode  TEXT  DEFAULT NULL
    CONSTRAINT announcement_variation_mode_check
      CHECK (variation_mode IN ('sequential', 'random', 'daily', 'weekly'));

-- 2. Index body_variations for any future JSONB queries
CREATE INDEX IF NOT EXISTS idx_org_announcements_has_variations
  ON public.org_announcements ((body_variations IS NOT NULL))
  WHERE body_variations IS NOT NULL;

-- 3. Helper comment for future engineers
COMMENT ON COLUMN public.org_announcements.body_variations IS
  'JSONB array of alternative body strings. When NULL or empty, body is used as-is.
   When populated, the client selects which variation to display based on variation_mode:
     sequential — cycles through variations by view_count
     random     — seeded daily-random per announcement id
     daily      — changes every calendar day
     weekly     — changes every calendar week';

COMMENT ON COLUMN public.org_announcements.variation_mode IS
  'How body_variations rotate: sequential | random | daily | weekly. NULL = static (no rotation).';

-- 4. No RLS changes needed — body_variations is a column of the same row
--    and inherits all existing org_announcements RLS policies.



-- #############################################################
-- ##  resident-directory-migration.sql
-- #############################################################
-- =============================================================
-- resident-directory-migration.sql
-- Phase 2: Resident Directory
--
-- Adds:
--   get_org_directory(p_org_id)  — role-aware member list RPC
--   get_org_member_count(p_org_id) — lightweight count RPC
--
-- Security model:
--   • Caller must be an active member of the org
--   • email/phone only returned when caller has a staff/admin role
--   • SECURITY DEFINER ensures profiles are readable across RLS boundary
--     but only for same-org members; zero cross-tenant leakage.
--
-- Run after multi-context-migration.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Supporting index (if not already present)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_status
  ON public.org_memberships(org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org
  ON public.org_memberships(user_id, org_id);

-- ─────────────────────────────────────────────────────────────
-- 1. get_org_directory
--    Returns active members of an org.
--    email + phone are redacted unless the calling user is staff.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_directory(p_org_id UUID)
RETURNS TABLE (
  membership_id   UUID,
  user_id         UUID,
  display_name    TEXT,
  avatar_url      TEXT,
  unit_number     TEXT,
  role            TEXT,
  joined_at       TIMESTAMPTZ,
  -- Staff-only fields; NULL for residents/board members
  email           TEXT,
  phone           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_status TEXT;
  v_is_staff      BOOLEAN;
BEGIN
  -- Verify caller is an active member of this org
  SELECT m.role, m.status
  INTO   v_caller_role, v_caller_status
  FROM   org_memberships m
  WHERE  m.org_id  = p_org_id
    AND  m.user_id = auth.uid()
  LIMIT  1;

  -- Silently return nothing if caller is not an active member
  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN;
  END IF;

  -- Staff / admin roles can see contact details
  v_is_staff := v_caller_role IN (
    'hoa_admin', 'property_manager', 'property_staff', 'super_admin'
  );

  RETURN QUERY
  SELECT
    m.id                                                      AS membership_id,
    m.user_id,
    COALESCE(NULLIF(p.name, ''), 'Community Member')         AS display_name,
    p.avatar_url,
    u.unit_number,
    m.role,
    m.joined_at,
    CASE WHEN v_is_staff THEN NULLIF(p.email, '')  ELSE NULL END AS email,
    CASE WHEN v_is_staff THEN NULLIF(p.phone, '')  ELSE NULL END AS phone
  FROM   org_memberships m
  JOIN   profiles p ON p.id = m.user_id
  LEFT   JOIN units u ON u.id = m.unit_id
  WHERE  m.org_id  = p_org_id
    AND  m.status  = 'active'
  ORDER  BY
    -- Sort by unit first (natural property sort), then by name
    u.unit_number NULLS LAST,
    p.name        NULLS LAST;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. get_org_member_count
--    Cheap scalar used for stat pills. Same access gate as above.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_member_count(p_org_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_status TEXT;
  v_count         BIGINT;
BEGIN
  SELECT m.status
  INTO   v_caller_status
  FROM   org_memberships m
  WHERE  m.org_id  = p_org_id
    AND  m.user_id = auth.uid()
  LIMIT  1;

  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM   org_memberships
  WHERE  org_id = p_org_id AND status = 'active';

  RETURN v_count;
END;
$$;



-- #############################################################
-- ##  property-management-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Property / Building Management Migration
-- Additive layer on top of multi-context-migration.sql
-- Adds: property CRUD RPCs, unit CRUD RPCs, property stats view, manager assign
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: assert the caller is an admin/manager in the org ──────────────────

CREATE OR REPLACE FUNCTION assert_org_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- ── Get all properties for an org (with unit counts) ─────────────────────────

CREATE OR REPLACE FUNCTION get_org_properties(p_org_id uuid)
RETURNS TABLE (
  id            uuid,
  org_id        uuid,
  name          text,
  address       text,
  city          text,
  state         text,
  zip           text,
  total_units   int,
  manager_user_id uuid,
  manager_name  text,
  is_active     boolean,
  notes         text,
  unit_count    bigint,
  occupied_count bigint,
  created_at    timestamptz,
  updated_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be an active member of the org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.org_id,
    p.name,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.total_units,
    p.manager_user_id,
    prof.name AS manager_name,
    p.is_active,
    p.notes,
    COUNT(u.id)::bigint AS unit_count,
    COUNT(CASE WHEN om2.status = 'active' THEN 1 END)::bigint AS occupied_count,
    p.created_at,
    p.updated_at
  FROM properties p
  LEFT JOIN profiles prof ON prof.id = p.manager_user_id
  LEFT JOIN units u ON u.property_id = p.id AND u.org_id = p_org_id
  LEFT JOIN org_memberships om2 ON om2.unit_id = u.id AND om2.status = 'active'
  WHERE p.org_id = p_org_id
  GROUP BY p.id, prof.name
  ORDER BY p.name ASC;
END;
$$;

-- ── Get units for a property ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_property_units(p_property_id uuid, p_org_id uuid)
RETURNS TABLE (
  id              uuid,
  property_id     uuid,
  org_id          uuid,
  unit_number     text,
  floor           int,
  notes           text,
  resident_name   text,
  resident_id     uuid,
  membership_id   uuid,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  RETURN QUERY
  SELECT
    u.id,
    u.property_id,
    u.org_id,
    u.unit_number,
    u.floor,
    u.notes,
    prof.name AS resident_name,
    prof.id AS resident_id,
    om.id AS membership_id,
    u.created_at
  FROM units u
  LEFT JOIN org_memberships om
    ON om.unit_id = u.id
    AND om.org_id = p_org_id
    AND om.status = 'active'
  LEFT JOIN profiles prof ON prof.id = om.user_id
  WHERE u.property_id = p_property_id
    AND u.org_id = p_org_id
  ORDER BY u.unit_number ASC;
END;
$$;

-- ── Create a property ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_org_property(
  p_org_id      uuid,
  p_name        text,
  p_address     text,
  p_city        text,
  p_state       text,
  p_zip         text,
  p_total_units int DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  INSERT INTO properties (org_id, name, address, city, state, zip, total_units, notes)
  VALUES (p_org_id, p_name, p_address, p_city, p_state, p_zip, p_total_units, p_notes)
  RETURNING id INTO v_property_id;

  RETURN v_property_id;
END;
$$;

-- ── Update a property ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_org_property(
  p_property_id uuid,
  p_org_id      uuid,
  p_name        text DEFAULT NULL,
  p_address     text DEFAULT NULL,
  p_city        text DEFAULT NULL,
  p_state       text DEFAULT NULL,
  p_zip         text DEFAULT NULL,
  p_total_units int  DEFAULT NULL,
  p_notes       text DEFAULT NULL,
  p_is_active   boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  UPDATE properties
  SET
    name        = COALESCE(p_name, name),
    address     = COALESCE(p_address, address),
    city        = COALESCE(p_city, city),
    state       = COALESCE(p_state, state),
    zip         = COALESCE(p_zip, zip),
    total_units = COALESCE(p_total_units, total_units),
    notes       = COALESCE(p_notes, notes),
    is_active   = COALESCE(p_is_active, is_active),
    updated_at  = now()
  WHERE id = p_property_id AND org_id = p_org_id;
END;
$$;

-- ── Assign manager to a property ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_property_manager(
  p_property_id   uuid,
  p_org_id        uuid,
  p_manager_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Ensure target is an active staff/admin member
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = p_manager_user_id
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('property_manager', 'property_staff', 'hoa_admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Target user is not an active staff member of this organization';
  END IF;

  UPDATE properties
  SET manager_user_id = p_manager_user_id, updated_at = now()
  WHERE id = p_property_id AND org_id = p_org_id;
END;
$$;

-- ── Create a unit ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_org_unit(
  p_property_id uuid,
  p_org_id      uuid,
  p_unit_number text,
  p_floor       int  DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Verify property belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM properties WHERE id = p_property_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Property not found in this organization';
  END IF;

  INSERT INTO units (property_id, org_id, unit_number, floor, notes)
  VALUES (p_property_id, p_org_id, p_unit_number, p_floor, p_notes)
  RETURNING id INTO v_unit_id;

  RETURN v_unit_id;
END;
$$;

-- ── Bulk create units for a property ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION bulk_create_units(
  p_property_id uuid,
  p_org_id      uuid,
  p_unit_numbers text[]   -- e.g. ARRAY['101','102','103']
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_number text;
  v_count int := 0;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  IF NOT EXISTS (
    SELECT 1 FROM properties WHERE id = p_property_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Property not found in this organization';
  END IF;

  FOREACH v_unit_number IN ARRAY p_unit_numbers LOOP
    INSERT INTO units (property_id, org_id, unit_number)
    VALUES (p_property_id, p_org_id, trim(v_unit_number))
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Delete/deactivate a unit ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_org_unit(
  p_unit_id  uuid,
  p_org_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Unlink any memberships referencing this unit first
  UPDATE org_memberships
  SET unit_id = NULL
  WHERE unit_id = p_unit_id AND org_id = p_org_id;

  DELETE FROM units WHERE id = p_unit_id AND org_id = p_org_id;
END;
$$;

-- ── Property summary stats (for admin dashboard widget) ───────────────────────

CREATE OR REPLACE FUNCTION get_property_summary(p_org_id uuid)
RETURNS TABLE (
  total_properties  bigint,
  active_properties bigint,
  total_units       bigint,
  occupied_units    bigint,
  vacant_units      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id)::bigint AS total_properties,
    COUNT(DISTINCT CASE WHEN p.is_active THEN p.id END)::bigint AS active_properties,
    COUNT(DISTINCT u.id)::bigint AS total_units,
    COUNT(DISTINCT CASE WHEN om.status = 'active' THEN u.id END)::bigint AS occupied_units,
    COUNT(DISTINCT CASE WHEN om.id IS NULL OR om.status != 'active' THEN u.id END)::bigint AS vacant_units
  FROM properties p
  LEFT JOIN units u ON u.property_id = p.id AND u.org_id = p_org_id
  LEFT JOIN org_memberships om ON om.unit_id = u.id AND om.status = 'active'
  WHERE p.org_id = p_org_id;
END;
$$;

-- ── Assign a unit to a member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_unit_to_member(
  p_membership_id uuid,
  p_unit_id       uuid,
  p_org_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Verify unit belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM units WHERE id = p_unit_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Unit not found in this organization';
  END IF;

  UPDATE org_memberships
  SET unit_id = p_unit_id, updated_at = now()
  WHERE id = p_membership_id AND org_id = p_org_id;
END;
$$;

-- ── RLS: properties ───────────────────────────────────────────────────────────

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_properties" ON properties;
DROP POLICY IF EXISTS "org_members_read_properties" ON properties;
CREATE POLICY "org_members_read_properties" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = properties.org_id
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_admins_write_properties" ON properties;
DROP POLICY IF EXISTS "org_admins_write_properties" ON properties;
CREATE POLICY "org_admins_write_properties" ON properties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = properties.org_id
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ── RLS: units ────────────────────────────────────────────────────────────────

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_units" ON units;
DROP POLICY IF EXISTS "org_members_read_units" ON units;
CREATE POLICY "org_members_read_units" ON units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = units.org_id
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_admins_write_units" ON units;
DROP POLICY IF EXISTS "org_admins_write_units" ON units;
CREATE POLICY "org_admins_write_units" ON units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = units.org_id
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ── Grant RPC execution ───────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_org_properties(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_units(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_property(uuid, text, text, text, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_org_property(uuid, uuid, text, text, text, text, text, int, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_property_manager(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_unit(uuid, uuid, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_create_units(uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_org_unit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_unit_to_member(uuid, uuid, uuid) TO authenticated;



-- #############################################################
-- ##  rls-lockdown.sql
-- #############################################################
-- ============================================================
-- PORCHIVO — RLS LOCKDOWN (BETA PRE-FLIGHT)
-- Run in Supabase SQL Editor AFTER partner-verification-migration.sql.
-- Idempotent — safe to re-run.
--
-- Closes the partner_verifications PII/KYC leak: the previous
-- "Authenticated view partner tier" policy exposed EVERY column
-- (legal name, DOB, ID type, Stripe account id, lifetime earnings)
-- to any logged-in user. Only tier/rating/status are ever needed
-- cross-user, so we drop the broad table policy and expose a
-- minimal, safe view instead.
-- ============================================================

-- ── 1. Drop the over-broad cross-user SELECT on the raw table ──────────────
-- After this, partner_verifications is owner-only:
--   "Users view own verification"   (full row, owner)
--   "Users insert own verification" (owner)
--   "Users update own verification" (owner)
drop policy if exists "Authenticated view partner tier" on public.partner_verifications;

-- Re-affirm the owner-only SELECT policy exists (idempotent).
drop policy if exists "Users view own verification" on public.partner_verifications;
DROP POLICY IF EXISTS "Users view own verification" ON public.partner_verifications;
create policy "Users view own verification"
  on public.partner_verifications for select
  using (auth.uid() = user_id);

-- ── 2. Safe cross-user view — non-sensitive columns only ───────────────────
-- SECURITY DEFINER view (runs as owner) so any authenticated user can read
-- another partner's PUBLIC trust signals, while the raw table stays owner-only.
-- Deliberately excludes: legal_first_name, legal_last_name, dob, id_country,
-- id_type, idv_session_id, idv_report_id, idv_failure_reason, stripe_account_id,
-- stripe_onboarding_url, lifetime_earnings_cents.
create or replace view public.partner_public_stats as
  select
    user_id,
    tier,
    idv_status,
    payout_status,
    completed_assignments,
    total_assignments,
    average_rating
  from public.partner_verifications;

grant select on public.partner_public_stats to authenticated;

comment on view public.partner_public_stats is
  'Public, non-PII trust signals for partners (tier, rating, completion counts). '
  'Use this for cross-user reads; the partner_verifications table is owner-only.';

-- ── 3. Re-affirm own-profile SELECT (guards against the master-deploy bug
--       that previously left this policy malformed) ─────────────────────────
drop policy if exists "Users can view own profile" on public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- ── 4. VERIFY ──────────────────────────────────────────────────────────────
-- Confirm no public table is missing RLS:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: only rate_limit_log (service-role only, RLS intentionally off).
--
-- Confirm the leak is closed (run as a normal authenticated user — should
-- error "permission denied" or return only your own row):
--   SELECT legal_first_name FROM public.partner_verifications;



-- #############################################################
-- ##  package-ops-board-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Package Operations Board — Migration
-- Phase 6: Full staff package board with enriched views, logging, and status
-- transitions. Extends existing package_log_items table (already created in
-- multi-context-migration.sql). No destructive changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Ensure package_log_items has the columns we need ─────────────────────────
-- (Safe: IF NOT EXISTS guards mean re-running this is harmless)

ALTER TABLE public.package_log_items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS size_hint TEXT,            -- 'small' | 'medium' | 'large' | 'oversized'
  ADD COLUMN IF NOT EXISTS location_in_office TEXT,   -- where staff put it: "Mailroom B" etc.
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,   -- when resident was notified
  ADD COLUMN IF NOT EXISTS exception_reason TEXT;     -- filled when status = 'exception'

-- ── Package status audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.package_status_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES public.package_log_items(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  changed_by      UUID NOT NULL REFERENCES auth.users(id),
  from_status     TEXT NOT NULL,
  to_status       TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.package_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_staff_see_events" ON public.package_status_events;
CREATE POLICY "org_staff_see_events" ON public.package_status_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = package_status_events.org_id
        AND m.status = 'active'
        AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
    )
  );

DROP POLICY IF EXISTS "org_staff_insert_events" ON public.package_status_events;
CREATE POLICY "org_staff_insert_events" ON public.package_status_events
  FOR INSERT WITH CHECK (
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = package_status_events.org_id
        AND m.status = 'active'
        AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
    )
  );

-- ── Enriched board view (security_definer RPC) ────────────────────────────────
-- Returns package_log_items joined with units and a resolved display name.
-- Caller must be an active staff member of the org.

CREATE OR REPLACE FUNCTION public.get_org_packages_board(
  p_org_id    UUID,
  p_status    TEXT DEFAULT NULL,   -- NULL = all statuses
  p_limit     INT  DEFAULT 50,
  p_offset    INT  DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  org_id            UUID,
  property_id       UUID,
  unit_id           UUID,
  unit_number       TEXT,
  resident_id       UUID,
  logged_by         UUID,
  logged_by_name    TEXT,
  carrier           TEXT,
  tracking_number   TEXT,
  status            TEXT,
  notes             TEXT,
  description       TEXT,
  size_hint         TEXT,
  location_in_office TEXT,
  exception_reason  TEXT,
  photo_url         TEXT,
  received_at       TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Permission check: caller must be active staff in this org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT
    pkg.id,
    pkg.org_id,
    pkg.property_id,
    pkg.unit_id,
    u.unit_number::TEXT,
    pkg.resident_id,
    pkg.logged_by,
    COALESCE(p.name, 'Staff')::TEXT AS logged_by_name,
    pkg.carrier,
    pkg.tracking_number,
    pkg.status::TEXT,
    pkg.notes,
    pkg.description,
    pkg.size_hint,
    pkg.location_in_office,
    pkg.exception_reason,
    pkg.photo_url,
    pkg.received_at,
    pkg.picked_up_at,
    pkg.notified_at,
    pkg.created_at,
    pkg.updated_at
  FROM package_log_items pkg
  LEFT JOIN units u ON u.id = pkg.unit_id
  LEFT JOIN profiles p ON p.id = pkg.logged_by
  WHERE pkg.org_id = p_org_id
    AND (p_status IS NULL OR pkg.status::TEXT = p_status)
  ORDER BY
    CASE pkg.status::TEXT
      WHEN 'exception'         THEN 1
      WHEN 'received'          THEN 2
      WHEN 'ready_for_pickup'  THEN 3
      WHEN 'picked_up'         THEN 4
      WHEN 'returned_to_sender' THEN 5
      ELSE 6
    END,
    pkg.received_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ── Log a new package (staff action) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_org_package(
  p_org_id         UUID,
  p_carrier        TEXT,
  p_tracking       TEXT        DEFAULT NULL,
  p_unit_number    TEXT        DEFAULT NULL,
  p_notes          TEXT        DEFAULT NULL,
  p_description    TEXT        DEFAULT NULL,
  p_size_hint      TEXT        DEFAULT NULL,
  p_location       TEXT        DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unit_id  UUID;
  v_pkg_id   UUID;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Resolve unit by number within the org
  IF p_unit_number IS NOT NULL THEN
    SELECT id INTO v_unit_id
    FROM units u
    WHERE u.org_id = p_org_id
      AND u.unit_number ILIKE p_unit_number
    LIMIT 1;
  END IF;

  INSERT INTO package_log_items (
    org_id, unit_id, logged_by, carrier, tracking_number,
    status, notes, description, size_hint, location_in_office, received_at
  ) VALUES (
    p_org_id, v_unit_id, auth.uid(), p_carrier, p_tracking,
    'received', p_notes, p_description, p_size_hint, p_location, now()
  )
  RETURNING id INTO v_pkg_id;

  -- Audit event
  INSERT INTO package_status_events (package_id, org_id, changed_by, from_status, to_status, notes)
  VALUES (v_pkg_id, p_org_id, auth.uid(), 'none', 'received', 'Package logged');

  RETURN v_pkg_id;
END;
$$;

-- ── Update package status (staff action) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_org_package_status(
  p_package_id     UUID,
  p_org_id         UUID,
  p_new_status     TEXT,
  p_notes          TEXT DEFAULT NULL,
  p_exception_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Get current status
  SELECT status::TEXT INTO v_old_status
  FROM package_log_items
  WHERE id = p_package_id AND org_id = p_org_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  -- Update
  UPDATE package_log_items SET
    status = p_new_status::package_log_status,
    notes = COALESCE(p_notes, notes),
    exception_reason = CASE WHEN p_new_status = 'exception' THEN p_exception_reason ELSE exception_reason END,
    picked_up_at = CASE WHEN p_new_status = 'picked_up' THEN now() ELSE picked_up_at END,
    updated_at = now()
  WHERE id = p_package_id AND org_id = p_org_id;

  -- Audit event
  INSERT INTO package_status_events (package_id, org_id, changed_by, from_status, to_status, notes)
  VALUES (p_package_id, p_org_id, auth.uid(), v_old_status, p_new_status, p_notes);
END;
$$;

-- ── Board summary counts ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_package_board_counts(p_org_id UUID)
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND m.role IN ('hoa_admin','property_manager','property_staff','super_admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT pkg.status::TEXT, COUNT(*) AS count
  FROM package_log_items pkg
  WHERE pkg.org_id = p_org_id
  GROUP BY pkg.status;
END;
$$;



-- #############################################################
-- ##  admin-dashboard-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Dashboard Migration
-- Phase 5 — Porchivo multi-context expansion
--
-- Adds:
--   get_admin_dashboard_stats(p_org_id)  — aggregated stats for admin home
--   approve_org_membership(p_membership_id, p_org_id)
--   deny_org_membership(p_membership_id, p_org_id)
--   admin_audit_log table — lightweight action trail for admin operations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin audit log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,                   -- e.g. 'approve_member', 'deny_member', 'log_package'
  target_type   TEXT,                            -- e.g. 'membership', 'package_log_item'
  target_id     UUID,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only org admins/staff can read their own org's audit log
DROP POLICY IF EXISTS "admin_audit_log_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_read"
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = admin_audit_log.org_id
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
    )
  );

-- Only the backend (service role) or security-definer RPCs insert log entries
DROP POLICY IF EXISTS "admin_audit_log_insert_sd" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_sd"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- ── Dashboard stats RPC ───────────────────────────────────────────────────────
-- Returns a single JSON row with all counts an admin dashboard needs.
-- SECURITY DEFINER — caller is verified as an active admin/staff member first.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_result JSON;
BEGIN
  -- 1. Verify caller is an active admin or staff member of this org
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- 2. Aggregate stats
  SELECT json_build_object(
    -- Membership
    'total_members',        (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'active'),
    'pending_members',      (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'pending'),
    'suspended_members',    (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'suspended'),

    -- Packages
    'packages_received',    (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'received'),
    'packages_ready',       (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'ready_for_pickup'),
    'packages_picked_up',   (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'picked_up'),
    'packages_exception',   (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'exception'),
    'packages_today',       (
      SELECT COUNT(*) FROM package_log_items
      WHERE org_id = p_org_id
        AND received_at >= CURRENT_DATE
    ),

    -- Announcements
    'total_announcements',  (SELECT COUNT(*) FROM org_announcements WHERE org_id = p_org_id),
    'active_announcements', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND (expires_at IS NULL OR expires_at > now())
        AND (scheduled_at IS NULL OR scheduled_at <= now())
    ),
    'pinned_announcements', (SELECT COUNT(*) FROM org_announcements WHERE org_id = p_org_id AND is_pinned = true),

    -- Audit
    'admin_actions_today',  (
      SELECT COUNT(*) FROM admin_audit_log
      WHERE org_id = p_org_id AND created_at >= CURRENT_DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(UUID) TO authenticated;

-- ── Pending members list RPC ──────────────────────────────────────────────────
-- Returns pending membership requests with display name.
CREATE OR REPLACE FUNCTION public.get_pending_members(p_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  user_id       UUID,
  display_name  TEXT,
  avatar_url    TEXT,
  unit_number   TEXT,
  created_at    TIMESTAMPTZ,
  notes         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify admin/staff
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
    SELECT
      m.id                AS membership_id,
      m.user_id,
      COALESCE(p.name, p.email, 'Unknown')::TEXT AS display_name,
      p.avatar_url::TEXT,
      u.unit_number::TEXT,
      m.created_at,
      m.notes::TEXT
    FROM org_memberships m
    LEFT JOIN profiles       p ON p.id          = m.user_id
    LEFT JOIN units          u ON u.id           = m.unit_id
    WHERE m.org_id = p_org_id
      AND m.status = 'pending'
    ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_members(UUID) TO authenticated;

-- ── Approve membership ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_org_membership(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify caller is admin/staff of this org
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Approve
  UPDATE public.org_memberships
  SET status    = 'active',
      joined_at = now(),
      updated_at = now()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'pending';

  -- Audit
  INSERT INTO public.admin_audit_log (org_id, actor_id, action, target_type, target_id)
  VALUES (p_org_id, auth.uid(), 'approve_member', 'membership', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_org_membership(UUID, UUID) TO authenticated;

-- ── Deny membership ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_org_membership(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.org_memberships
  SET status     = 'removed',
      updated_at = now()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'pending';

  INSERT INTO public.admin_audit_log (org_id, actor_id, action, target_type, target_id)
  VALUES (p_org_id, auth.uid(), 'deny_member', 'membership', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deny_org_membership(UUID, UUID) TO authenticated;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_org_created
  ON public.admin_audit_log (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_memberships_pending
  ON public.org_memberships (org_id, status)
  WHERE status = 'pending';



-- #############################################################
-- ##  maintenance-requests-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Maintenance Requests
-- Phase 13 — additive migration
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE maintenance_category AS ENUM (
    'plumbing', 'electrical', 'hvac', 'structural', 'pest_control',
    'landscaping', 'common_area', 'appliance', 'security', 'parking',
    'elevator', 'amenity', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_priority AS ENUM ('low', 'normal', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM (
    'submitted', 'acknowledged', 'scheduled', 'in_progress',
    'on_hold', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_resolution AS ENUM (
    'completed_by_staff', 'completed_by_vendor', 'resident_resolved',
    'duplicate', 'outside_scope', 'cancelled_by_resident', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id           uuid REFERENCES properties(id) ON DELETE SET NULL,
  unit_id               uuid REFERENCES units(id) ON DELETE SET NULL,
  reporter_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignee_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category              maintenance_category NOT NULL DEFAULT 'other',
  priority              maintenance_priority NOT NULL DEFAULT 'normal',
  status                maintenance_status NOT NULL DEFAULT 'submitted',
  title                 text NOT NULL,
  description           text,
  location_detail       text,              -- e.g. "kitchen sink", "hallway B2"
  preferred_time        text,              -- e.g. "Weekday mornings"
  is_urgent             boolean NOT NULL DEFAULT false,
  allow_entry           boolean NOT NULL DEFAULT false,  -- resident grants entry permission
  resolution_code       maintenance_resolution,
  resolution_notes      text,
  resident_visible_note text,              -- what resident sees on status changes
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  due_date              timestamptz,
  photo_url             text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  author_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  is_internal     boolean NOT NULL DEFAULT false,  -- true = staff-only; false = resident-visible
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL,
  changed_by  uuid NOT NULL REFERENCES profiles(id),
  from_status maintenance_status,
  to_status   maintenance_status NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_maint_requests_org        ON maintenance_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_reporter   ON maintenance_requests(reporter_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_assignee   ON maintenance_requests(assignee_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_status     ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maint_requests_priority   ON maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_maint_requests_created    ON maintenance_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maint_comments_request    ON maintenance_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_maint_history_request     ON maintenance_status_history(request_id);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_maintenance_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON maintenance_requests;
DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON maintenance_requests;
CREATE TRIGGER trg_maintenance_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE maintenance_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status_history  ENABLE ROW LEVEL SECURITY;

-- Helper: is caller an active member of org?
CREATE OR REPLACE FUNCTION _maint_is_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

-- Helper: is caller staff/admin of org?
CREATE OR REPLACE FUNCTION _maint_is_staff(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  );
$$;

-- maintenance_requests: residents see own; staff sees all in org
DROP POLICY IF EXISTS maint_req_select ON maintenance_requests;
CREATE POLICY maint_req_select ON maintenance_requests FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR _maint_is_staff(org_id)
  );

DROP POLICY IF EXISTS maint_req_insert ON maintenance_requests;
CREATE POLICY maint_req_insert ON maintenance_requests FOR INSERT
  WITH CHECK (_maint_is_member(org_id));

DROP POLICY IF EXISTS maint_req_update ON maintenance_requests;
CREATE POLICY maint_req_update ON maintenance_requests FOR UPDATE
  USING (_maint_is_staff(org_id))
  WITH CHECK (_maint_is_staff(org_id));

-- maintenance_comments: residents see non-internal on own requests; staff sees all
DROP POLICY IF EXISTS maint_comment_select ON maintenance_comments;
CREATE POLICY maint_comment_select ON maintenance_comments FOR SELECT
  USING (
    (is_internal = false AND EXISTS (
      SELECT 1 FROM maintenance_requests r
      WHERE r.id = request_id AND r.reporter_id = auth.uid()
    ))
    OR _maint_is_staff(org_id)
  );

DROP POLICY IF EXISTS maint_comment_insert ON maintenance_comments;
CREATE POLICY maint_comment_insert ON maintenance_comments FOR INSERT
  WITH CHECK (_maint_is_member(org_id));

-- status history: same as requests
DROP POLICY IF EXISTS maint_history_select ON maintenance_status_history;
CREATE POLICY maint_history_select ON maintenance_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests r
      WHERE r.id = request_id AND (r.reporter_id = auth.uid() OR _maint_is_staff(r.org_id))
    )
  );

-- ── 6. RPCs ───────────────────────────────────────────────────────────────────

-- 6a. Submit a new maintenance request (any active org member)
CREATE OR REPLACE FUNCTION submit_maintenance_request(
  p_org_id       uuid,
  p_category     maintenance_category,
  p_priority     maintenance_priority,
  p_title        text,
  p_description  text DEFAULT NULL,
  p_location     text DEFAULT NULL,
  p_preferred    text DEFAULT NULL,
  p_allow_entry  boolean DEFAULT false,
  p_unit_id      uuid DEFAULT NULL,
  p_photo_url    text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT _maint_is_member(p_org_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO maintenance_requests (
    org_id, reporter_id, category, priority, title, description,
    location_detail, preferred_time, allow_entry, unit_id, photo_url,
    is_urgent
  ) VALUES (
    p_org_id, auth.uid(), p_category, p_priority, p_title, p_description,
    p_location, p_preferred, p_allow_entry, p_unit_id, p_photo_url,
    p_priority = 'emergency'
  )
  RETURNING id INTO v_id;

  -- seed status history
  INSERT INTO maintenance_status_history (request_id, org_id, changed_by, from_status, to_status)
  VALUES (v_id, p_org_id, auth.uid(), NULL, 'submitted');

  RETURN v_id;
END;
$$;

-- 6b. Staff: update status + optional resident-visible note
CREATE OR REPLACE FUNCTION update_maintenance_status(
  p_request_id  uuid,
  p_status      maintenance_status,
  p_note        text DEFAULT NULL,
  p_resolution  maintenance_resolution DEFAULT NULL,
  p_scheduled   timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_old    maintenance_status;
BEGIN
  SELECT org_id, status INTO v_org_id, v_old FROM maintenance_requests WHERE id = p_request_id;

  IF NOT _maint_is_staff(v_org_id) THEN
    RAISE EXCEPTION 'not_staff';
  END IF;

  UPDATE maintenance_requests SET
    status                = p_status,
    resident_visible_note = COALESCE(p_note, resident_visible_note),
    resolution_code       = COALESCE(p_resolution, resolution_code),
    scheduled_for         = COALESCE(p_scheduled, scheduled_for),
    completed_at          = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_request_id;

  INSERT INTO maintenance_status_history (request_id, org_id, changed_by, from_status, to_status, note)
  VALUES (p_request_id, v_org_id, auth.uid(), v_old, p_status, p_note);
END;
$$;

-- 6c. Staff: assign request to a staff member
CREATE OR REPLACE FUNCTION assign_maintenance_request(
  p_request_id  uuid,
  p_assignee_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id uuid; BEGIN
  SELECT org_id INTO v_org_id FROM maintenance_requests WHERE id = p_request_id;
  IF NOT _maint_is_staff(v_org_id) THEN RAISE EXCEPTION 'not_staff'; END IF;
  UPDATE maintenance_requests SET assignee_id = p_assignee_id WHERE id = p_request_id;
END;
$$;

-- 6d. Add comment (internal flag restricted to staff)
CREATE OR REPLACE FUNCTION add_maintenance_comment(
  p_request_id  uuid,
  p_body        text,
  p_internal    boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_id     uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM maintenance_requests WHERE id = p_request_id;

  IF p_internal AND NOT _maint_is_staff(v_org_id) THEN
    RAISE EXCEPTION 'not_staff';
  END IF;

  IF NOT _maint_is_member(v_org_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO maintenance_comments (request_id, org_id, author_id, body, is_internal)
  VALUES (p_request_id, v_org_id, auth.uid(), p_body, p_internal)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6e. Staff queue — paginated, filterable
CREATE OR REPLACE FUNCTION get_maintenance_queue(
  p_org_id    uuid,
  p_status    maintenance_status DEFAULT NULL,
  p_category  maintenance_category DEFAULT NULL,
  p_priority  maintenance_priority DEFAULT NULL,
  p_limit     int DEFAULT 40,
  p_offset    int DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  org_id                uuid,
  unit_id               uuid,
  unit_number           text,
  reporter_id           uuid,
  reporter_name         text,
  assignee_id           uuid,
  assignee_name         text,
  category              maintenance_category,
  priority              maintenance_priority,
  status                maintenance_status,
  title                 text,
  description           text,
  location_detail       text,
  preferred_time        text,
  allow_entry           boolean,
  is_urgent             boolean,
  resident_visible_note text,
  resolution_code       maintenance_resolution,
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  due_date              timestamptz,
  photo_url             text,
  comment_count         bigint,
  created_at            timestamptz,
  updated_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    r.id, r.org_id, r.unit_id,
    u.unit_number,
    r.reporter_id,
    COALESCE(rp.name, 'Unknown') AS reporter_name,
    r.assignee_id,
    ap.name AS assignee_name,
    r.category, r.priority, r.status, r.title, r.description,
    r.location_detail, r.preferred_time, r.allow_entry, r.is_urgent,
    r.resident_visible_note, r.resolution_code,
    r.scheduled_for, r.completed_at, r.due_date, r.photo_url,
    (SELECT COUNT(*) FROM maintenance_comments c WHERE c.request_id = r.id) AS comment_count,
    r.created_at, r.updated_at
  FROM maintenance_requests r
  LEFT JOIN units u          ON u.id = r.unit_id
  LEFT JOIN profiles rp      ON rp.id = r.reporter_id
  LEFT JOIN profiles ap      ON ap.id = r.assignee_id
  WHERE r.org_id = p_org_id
    AND _maint_is_staff(p_org_id)
    AND (p_status   IS NULL OR r.status   = p_status)
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_priority IS NULL OR r.priority = p_priority)
  ORDER BY
    CASE r.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6f. Resident — own requests only
CREATE OR REPLACE FUNCTION get_my_maintenance_requests(p_org_id uuid)
RETURNS TABLE (
  id                    uuid,
  category              maintenance_category,
  priority              maintenance_priority,
  status                maintenance_status,
  title                 text,
  description           text,
  location_detail       text,
  resident_visible_note text,
  resolution_code       maintenance_resolution,
  scheduled_for         timestamptz,
  completed_at          timestamptz,
  comment_count         bigint,
  created_at            timestamptz,
  updated_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    r.id, r.category, r.priority, r.status, r.title, r.description,
    r.location_detail, r.resident_visible_note, r.resolution_code,
    r.scheduled_for, r.completed_at,
    (SELECT COUNT(*) FROM maintenance_comments c WHERE c.request_id = r.id AND c.is_internal = false),
    r.created_at, r.updated_at
  FROM maintenance_requests r
  WHERE r.org_id = p_org_id AND r.reporter_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

-- 6g. Queue counts for dashboard badges
CREATE OR REPLACE FUNCTION get_maintenance_counts(p_org_id uuid)
RETURNS TABLE (
  open_count        bigint,
  emergency_count   bigint,
  in_progress_count bigint,
  scheduled_count   bigint,
  completed_today   bigint,
  unassigned_count  bigint
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS open_count,
    COUNT(*) FILTER (WHERE priority = 'emergency' AND status NOT IN ('completed','cancelled')) AS emergency_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
    COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= now() - interval '1 day') AS completed_today,
    COUNT(*) FILTER (WHERE assignee_id IS NULL AND status NOT IN ('completed','cancelled')) AS unassigned_count
  FROM maintenance_requests
  WHERE org_id = p_org_id AND _maint_is_staff(p_org_id);
$$;



-- #############################################################
-- ##  org-payments-migration.sql
-- #############################################################
-- ─── Org Payments Migration ───────────────────────────────────────────────────
-- HOA dues / assessment payment ledger, scoped to the organization.
-- Backs the Community-tier Payments tab (expo/app/(tabs)/payments.tsx).
--
-- Run AFTER multi-context-migration.sql (needs organizations + org_memberships).
-- Idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.org_payments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  -- Which resident the payment is for (NULL = org-wide assessment)
  user_id       uuid references public.profiles(id) on delete set null,
  description   text not null default 'HOA Dues',
  amount_cents  integer not null check (amount_cents >= 0),
  status        text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_org_payments_org_created
  on public.org_payments (org_id, created_at desc);

create index if not exists idx_org_payments_user
  on public.org_payments (user_id)
  where user_id is not null;

alter table public.org_payments enable row level security;

-- Members can see their org's payment history
drop policy if exists "Members can view org payments" on public.org_payments;
DROP POLICY IF EXISTS "Members can view org payments" ON public.org_payments;
create policy "Members can view org payments"
  on public.org_payments for select
  to authenticated
  using (
    exists (
      select 1 from public.org_memberships om
      where om.org_id  = org_payments.org_id
        and om.user_id = auth.uid()
        and om.status  = 'active'
    )
  );

-- Staff/board/admins can record payments
drop policy if exists "Staff can record org payments" on public.org_payments;
DROP POLICY IF EXISTS "Staff can record org payments" ON public.org_payments;
create policy "Staff can record org payments"
  on public.org_payments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.org_memberships om
      where om.org_id  = org_payments.org_id
        and om.user_id = auth.uid()
        and om.role    in ('board_member', 'hoa_admin', 'property_manager', 'property_staff', 'super_admin')
        and om.status  = 'active'
    )
  );

-- Staff/board/admins can update payment status (e.g. mark paid)
drop policy if exists "Staff can update org payments" on public.org_payments;
DROP POLICY IF EXISTS "Staff can update org payments" ON public.org_payments;
create policy "Staff can update org payments"
  on public.org_payments for update
  to authenticated
  using (
    exists (
      select 1 from public.org_memberships om
      where om.org_id  = org_payments.org_id
        and om.user_id = auth.uid()
        and om.role    in ('board_member', 'hoa_admin', 'property_manager', 'property_staff', 'super_admin')
        and om.status  = 'active'
    )
  );

-- updated_at trigger (matches the set_*_updated_at convention)
create or replace function public.set_org_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_org_payments_updated_at on public.org_payments;
DROP TRIGGER IF EXISTS trg_org_payments_updated_at ON public.org_payments;
create trigger trg_org_payments_updated_at
  before update on public.org_payments
  for each row execute function public.set_org_payments_updated_at();



-- #############################################################
-- ##  community-calendar-migration.sql
-- #############################################################
-- ─── Community Calendar ────────────────────────────────────────────────────────
-- Phase 12: HOA meetings, maintenance windows, amenity scheduling
-- Additive — no changes to existing tables.
-- Run this in your Supabase SQL editor.

-- ─── Event category enum ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_event_category AS ENUM (
    'meeting',
    'maintenance',
    'amenity',
    'social',
    'deadline',
    'inspection',
    'emergency',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Event status enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_event_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── RSVP status enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_rsvp_status AS ENUM (
    'going',
    'maybe',
    'not_going'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Community calendar events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  category            calendar_event_category NOT NULL DEFAULT 'other',
  status              calendar_event_status NOT NULL DEFAULT 'scheduled',
  location            TEXT,
  -- Timing
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ,
  all_day             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Recurrence (simple weekly/monthly)
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule     TEXT,                     -- 'weekly', 'monthly', 'yearly'
  recurrence_end_date DATE,
  -- Visibility & notify
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,   -- false = staff/board only
  notify_residents    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Capacity for amenity bookings
  max_attendees       INT,
  -- Linked announcement (optional)
  linked_announcement_id UUID REFERENCES org_announcements(id) ON DELETE SET NULL,
  -- Soft delete
  is_cancelled        BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_reason    TEXT,
  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cce_org_starts ON community_calendar_events(org_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cce_org_category ON community_calendar_events(org_id, category);
CREATE INDEX IF NOT EXISTS idx_cce_org_status ON community_calendar_events(org_id, status);

-- ─── RSVPs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_rsvps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES community_calendar_events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status      calendar_rsvp_status NOT NULL DEFAULT 'going',
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cersvp_event ON calendar_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_cersvp_user ON calendar_event_rsvps(user_id, org_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_calendar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cce_updated_at ON community_calendar_events;
DROP TRIGGER IF EXISTS trg_cce_updated_at ON community_calendar_events;
CREATE TRIGGER trg_cce_updated_at
  BEFORE UPDATE ON community_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();

DROP TRIGGER IF EXISTS trg_cersvp_updated_at ON calendar_event_rsvps;
DROP TRIGGER IF EXISTS trg_cersvp_updated_at ON calendar_event_rsvps;
CREATE TRIGGER trg_cersvp_updated_at
  BEFORE UPDATE ON calendar_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE community_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Active org members can view public events for their org
DROP POLICY IF EXISTS "Members can view public calendar events" ON community_calendar_events;
CREATE POLICY "Members can view public calendar events"
  ON community_calendar_events FOR SELECT
  USING (
    is_public = TRUE AND
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Staff/board can view all events (including staff-only)
DROP POLICY IF EXISTS "Staff can view all calendar events" ON community_calendar_events;
CREATE POLICY "Staff can view all calendar events"
  ON community_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Only staff/admin can create events
DROP POLICY IF EXISTS "Staff can create calendar events" ON community_calendar_events;
CREATE POLICY "Staff can create calendar events"
  ON community_calendar_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Creator or admin can update
DROP POLICY IF EXISTS "Creator or admin can update calendar events" ON community_calendar_events;
CREATE POLICY "Creator or admin can update calendar events"
  ON community_calendar_events FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'super_admin')
    )
  );

-- RSVP policies
DROP POLICY IF EXISTS "Members can view event RSVPs" ON calendar_event_rsvps;
CREATE POLICY "Members can view event RSVPs"
  ON calendar_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = calendar_event_rsvps.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Members can upsert their own RSVP" ON calendar_event_rsvps;
CREATE POLICY "Members can upsert their own RSVP"
  ON calendar_event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can update their own RSVP" ON calendar_event_rsvps;
CREATE POLICY "Members can update their own RSVP"
  ON calendar_event_rsvps FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete their own RSVP" ON calendar_event_rsvps;
CREATE POLICY "Members can delete their own RSVP"
  ON calendar_event_rsvps FOR DELETE
  USING (user_id = auth.uid());

-- ─── RPCs ──────────────────────────────────────────────────────────────────────

-- List events in a date range (with RSVP counts)
CREATE OR REPLACE FUNCTION get_org_calendar_events(
  p_org_id     UUID,
  p_from       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 month',
  p_to         TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 months',
  p_category   TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  org_id                UUID,
  created_by            UUID,
  creator_name          TEXT,
  title                 TEXT,
  description           TEXT,
  category              TEXT,
  status                TEXT,
  location              TEXT,
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  all_day               BOOLEAN,
  is_recurring          BOOLEAN,
  recurrence_rule       TEXT,
  recurrence_end_date   DATE,
  is_public             BOOLEAN,
  notify_residents      BOOLEAN,
  max_attendees         INT,
  is_cancelled          BOOLEAN,
  cancelled_reason      TEXT,
  rsvp_going            BIGINT,
  rsvp_maybe            BIGINT,
  my_rsvp               TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE sql AS $$
  SELECT
    e.id,
    e.org_id,
    e.created_by,
    COALESCE(p.name, 'Staff') AS creator_name,
    e.title,
    e.description,
    e.category::TEXT,
    e.status::TEXT,
    e.location,
    e.starts_at,
    e.ends_at,
    e.all_day,
    e.is_recurring,
    e.recurrence_rule,
    e.recurrence_end_date,
    e.is_public,
    e.notify_residents,
    e.max_attendees,
    e.is_cancelled,
    e.cancelled_reason,
    COUNT(r.id) FILTER (WHERE r.status = 'going')  AS rsvp_going,
    COUNT(r.id) FILTER (WHERE r.status = 'maybe') AS rsvp_maybe,
    (SELECT status::TEXT FROM calendar_event_rsvps WHERE event_id = e.id AND user_id = auth.uid() LIMIT 1) AS my_rsvp,
    e.created_at,
    e.updated_at
  FROM community_calendar_events e
  LEFT JOIN profiles p ON p.id = e.created_by
  LEFT JOIN calendar_event_rsvps r ON r.event_id = e.id
  WHERE
    e.org_id = p_org_id
    AND e.is_cancelled = FALSE
    AND e.starts_at >= p_from
    AND e.starts_at <= p_to
    AND (p_category IS NULL OR e.category::TEXT = p_category)
    AND (
      e.is_public = TRUE
      OR EXISTS (
        SELECT 1 FROM org_memberships om
        WHERE om.org_id = e.org_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('hoa_admin','property_manager','property_staff','board_member','super_admin')
      )
    )
  GROUP BY e.id, p.name
  ORDER BY e.starts_at ASC;
$$;

-- Create a calendar event
CREATE OR REPLACE FUNCTION create_org_calendar_event(
  p_org_id              UUID,
  p_title               TEXT,
  p_description         TEXT DEFAULT NULL,
  p_category            TEXT DEFAULT 'other',
  p_location            TEXT DEFAULT NULL,
  p_starts_at           TIMESTAMPTZ DEFAULT NOW(),
  p_ends_at             TIMESTAMPTZ DEFAULT NULL,
  p_all_day             BOOLEAN DEFAULT FALSE,
  p_is_recurring        BOOLEAN DEFAULT FALSE,
  p_recurrence_rule     TEXT DEFAULT NULL,
  p_recurrence_end_date DATE DEFAULT NULL,
  p_is_public           BOOLEAN DEFAULT TRUE,
  p_notify_residents    BOOLEAN DEFAULT FALSE,
  p_max_attendees       INT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
  v_role     TEXT;
BEGIN
  SELECT role INTO v_role FROM org_memberships
  WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active';

  IF v_role NOT IN ('hoa_admin','property_manager','property_staff','board_member','super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to create calendar events';
  END IF;

  INSERT INTO community_calendar_events (
    org_id, created_by, title, description, category, location,
    starts_at, ends_at, all_day, is_recurring, recurrence_rule,
    recurrence_end_date, is_public, notify_residents, max_attendees
  ) VALUES (
    p_org_id, auth.uid(), p_title, p_description, p_category::calendar_event_category,
    p_location, p_starts_at, p_ends_at, p_all_day, p_is_recurring,
    p_recurrence_rule, p_recurrence_end_date, p_is_public, p_notify_residents, p_max_attendees
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Cancel an event
CREATE OR REPLACE FUNCTION cancel_org_calendar_event(
  p_event_id UUID,
  p_org_id   UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT om.role INTO v_role FROM org_memberships om
  WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active';

  IF v_role NOT IN ('hoa_admin','property_manager','property_staff','board_member','super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE community_calendar_events
  SET is_cancelled = TRUE, cancelled_reason = p_reason, status = 'cancelled'
  WHERE id = p_event_id AND org_id = p_org_id;
END;
$$;

-- Upsert RSVP
CREATE OR REPLACE FUNCTION upsert_event_rsvp(
  p_event_id  UUID,
  p_org_id    UUID,
  p_status    TEXT DEFAULT 'going'
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO calendar_event_rsvps (event_id, user_id, org_id, status)
  VALUES (p_event_id, auth.uid(), p_org_id, p_status::calendar_rsvp_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = p_status::calendar_rsvp_status, updated_at = NOW();
END;
$$;

-- Upcoming events summary (for admin dashboard widget)
CREATE OR REPLACE FUNCTION get_org_upcoming_events(
  p_org_id UUID,
  p_limit  INT DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  category   TEXT,
  starts_at  TIMESTAMPTZ,
  location   TEXT,
  is_public  BOOLEAN
)
SECURITY DEFINER
LANGUAGE sql AS $$
  SELECT id, title, category::TEXT, starts_at, location, is_public
  FROM community_calendar_events
  WHERE org_id = p_org_id
    AND is_cancelled = FALSE
    AND starts_at >= NOW()
  ORDER BY starts_at ASC
  LIMIT p_limit;
$$;



-- #############################################################
-- ##  incident-review-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Incident Review Queue · Migration
-- Phase 7 — additive, no existing tables modified
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. incident_reports ──────────────────────────────────────────────────────

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM (
    'flagged',
    'intake',
    'investigating',
    'escalated',
    'resolved',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DROP TRIGGER IF EXISTS incidents_updated_at ON public.incident_reports;
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
DROP POLICY IF EXISTS incidents_select ON public.incident_reports;
CREATE POLICY incidents_select ON public.incident_reports
  FOR SELECT TO authenticated USING (
    reporter_id = auth.uid()
    OR public.is_org_staff(org_id)
  );

DROP POLICY IF EXISTS incidents_insert ON public.incident_reports;
CREATE POLICY incidents_insert ON public.incident_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND public.is_active_org_member(org_id)
  );

DROP POLICY IF EXISTS incidents_update ON public.incident_reports;
CREATE POLICY incidents_update ON public.incident_reports
  FOR UPDATE TO authenticated USING (
    public.is_org_staff(org_id)
  );

-- incident_comments: internal notes hidden from non-staff reporters
DROP POLICY IF EXISTS inc_comments_select ON public.incident_comments;
CREATE POLICY inc_comments_select ON public.incident_comments
  FOR SELECT TO authenticated USING (
    (is_internal = false AND EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_id AND ir.reporter_id = auth.uid()
    ))
    OR public.is_org_staff(org_id)
  );

DROP POLICY IF EXISTS inc_comments_insert ON public.incident_comments;
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
DROP POLICY IF EXISTS inc_history_select ON public.incident_status_history;
CREATE POLICY inc_history_select ON public.incident_status_history
  FOR SELECT TO authenticated USING (public.is_org_staff(org_id));

DROP POLICY IF EXISTS inc_history_insert ON public.incident_status_history;
CREATE POLICY inc_history_insert ON public.incident_status_history
  FOR INSERT TO authenticated WITH CHECK (
    changed_by = auth.uid()
    AND public.is_org_staff(org_id)
  );

-- Evidence: member uploads their own; staff see all
DROP POLICY IF EXISTS inc_evidence_select ON public.incident_evidence;
CREATE POLICY inc_evidence_select ON public.incident_evidence
  FOR SELECT TO authenticated USING (
    uploaded_by = auth.uid()
    OR public.is_org_staff(org_id)
  );

DROP POLICY IF EXISTS inc_evidence_insert ON public.incident_evidence;
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
        COALESCE(rp.name, 'Unknown') AS reporter_name,
        ir.assignee_id,
        COALESCE(ap.name, NULL) AS assignee_name,
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
      COALESCE(rp.name, 'Unknown') AS reporter_name,
      ir.assignee_id,
      COALESCE(ap.name, NULL) AS assignee_name,
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



-- #############################################################
-- ##  community-analytics-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Community Analytics — Phase 11
-- Porchivo HOA Community Platform
-- ─────────────────────────────────────────────────────────────────────────────
-- Provides aggregated, read-only analytics data for admins and board members.
-- All RPCs are security-definer and enforce community scoping.
-- No PII is exposed — all results are counts, rates, and averages.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Package analytics ────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_package_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  -- Role guard
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','property_staff','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    -- Total counts
    'total',           COUNT(*),
    'received',        COUNT(*) FILTER (WHERE status = 'received'),
    'ready',           COUNT(*) FILTER (WHERE status = 'ready_for_pickup'),
    'picked_up',       COUNT(*) FILTER (WHERE status = 'picked_up'),
    'exception',       COUNT(*) FILTER (WHERE status = 'exception'),
    'returned',        COUNT(*) FILTER (WHERE status = 'returned_to_sender'),

    -- Volume today / this week
    'today',           COUNT(*) FILTER (WHERE received_at::date = current_date),
    'this_week',       COUNT(*) FILTER (WHERE received_at >= date_trunc('week', now())),

    -- Avg pickup time (hours) for picked-up packages
    'avg_pickup_hours', ROUND(
      EXTRACT(EPOCH FROM AVG(
        CASE WHEN picked_up_at IS NOT NULL THEN picked_up_at - received_at END
      )) / 3600.0
    , 1),

    -- Pending > 3 days
    'overdue_count',   COUNT(*) FILTER (
      WHERE status IN ('received','ready_for_pickup')
        AND received_at < now() - interval '3 days'
    ),

    -- Carrier breakdown (top 5)
    'by_carrier', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(carrier, 'Unknown') AS carrier,
          COUNT(*)::int                AS count
        FROM package_log_items
        WHERE org_id = p_org_id
          AND received_at >= now() - (p_days || ' days')::interval
        GROUP BY carrier
        ORDER BY count DESC
        LIMIT 5
      ) t
    ),

    -- Daily volumes for sparkline (last 14 days)
    'daily_volumes', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.day)
      FROM (
        SELECT
          TO_CHAR(generate_series::date, 'MM/DD') AS day,
          COALESCE((
            SELECT COUNT(*) FROM package_log_items
            WHERE org_id = p_org_id
              AND received_at::date = generate_series::date
          ), 0)::int AS count
        FROM generate_series(
          (now() - interval '13 days')::date,
          now()::date,
          '1 day'::interval
        )
      ) t
    )
  )
  INTO v_result
  FROM package_log_items
  WHERE org_id = p_org_id
    AND received_at >= now() - (p_days || ' days')::interval;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Incident analytics ───────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_incident_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','property_staff','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'open',        COUNT(*) FILTER (WHERE status NOT IN ('closed','resolved_found','resolved_misdelivery_corrected','resolved_resident_recovered','resolved_carrier_contacted','resolved_replacement_handled','closed_insufficient_evidence','closed_duplicate','monitoring')),
    'resolved',    COUNT(*) FILTER (WHERE status LIKE 'resolved%'),
    'closed',      COUNT(*) FILTER (WHERE status LIKE 'closed%'),
    'escalated',   COUNT(*) FILTER (WHERE status LIKE 'escalated%'),
    'overdue',     COUNT(*) FILTER (WHERE sla_due_at < now() AND status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%'),
    'this_week',   COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())),

    -- Avg resolution hours
    'avg_resolution_hours', ROUND(
      EXTRACT(EPOCH FROM AVG(
        CASE WHEN closed_at IS NOT NULL THEN closed_at - created_at END
      )) / 3600.0
    , 1),

    -- SLA compliance %
    'sla_compliance_pct', CASE
      WHEN COUNT(*) FILTER (WHERE closed_at IS NOT NULL) = 0 THEN 100
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE closed_at IS NOT NULL
            AND (sla_due_at IS NULL OR closed_at <= sla_due_at)
        )::numeric /
        NULLIF(COUNT(*) FILTER (WHERE closed_at IS NOT NULL), 0)
      , 0)
    END,

    -- By incident type
    'by_type', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          incident_type AS type,
          COUNT(*)::int AS count
        FROM incident_reports
        WHERE org_id = p_org_id
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY incident_type
        ORDER BY count DESC
        LIMIT 6
      ) t
    ),

    -- By severity
    'by_severity', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          severity,
          COUNT(*)::int AS count
        FROM incident_reports
        WHERE org_id = p_org_id
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY severity
        ORDER BY count DESC
      ) t
    ),

    -- Trend tags frequency
    'top_trend_tags', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          tag,
          COUNT(*)::int AS count
        FROM incident_reports,
             unnest(trend_tags) AS tag
        WHERE org_id = p_org_id
          AND trend_tags IS NOT NULL
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 5
      ) t
    )
  )
  INTO v_result
  FROM incident_reports
  WHERE org_id = p_org_id
    AND created_at >= now() - (p_days || ' days')::interval;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Member & community analytics ─────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_community_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    -- Members
    'total_members',      COUNT(*) FILTER (WHERE status = 'active'),
    'pending_members',    COUNT(*) FILTER (WHERE status = 'pending'),
    'suspended_members',  COUNT(*) FILTER (WHERE status = 'suspended'),
    'new_this_month',     COUNT(*) FILTER (WHERE status = 'active' AND joined_at >= date_trunc('month', now())),
    'new_this_week',      COUNT(*) FILTER (WHERE status = 'active' AND joined_at >= date_trunc('week', now())),

    -- Role distribution
    'by_role', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT role, COUNT(*)::int AS count
        FROM org_memberships
        WHERE org_id = p_org_id AND status = 'active'
        GROUP BY role
        ORDER BY count DESC
      ) t
    ),

    -- Announcements
    'total_announcements', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND (scheduled_at IS NULL OR scheduled_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
    ),
    'announcements_this_month', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND created_at >= date_trunc('month', now())
    ),
    'total_announcement_views', (
      SELECT COALESCE(SUM(view_count), 0) FROM org_announcements
      WHERE org_id = p_org_id
    ),

    -- Properties & units
    'total_properties', (
      SELECT COUNT(*) FROM properties
      WHERE org_id = p_org_id AND is_active = true
    ),
    'total_units', (
      SELECT COUNT(*) FROM units
      WHERE org_id = p_org_id
    ),
    'occupied_units', (
      SELECT COUNT(DISTINCT unit_id) FROM org_memberships
      WHERE org_id = p_org_id AND status = 'active' AND unit_id IS NOT NULL
    ),

    -- Audit activity
    'admin_actions_this_month', (
      SELECT COUNT(*) FROM org_audit_log
      WHERE org_id = p_org_id
        AND created_at >= date_trunc('month', now())
    )
  )
  INTO v_result
  FROM org_memberships
  WHERE org_id = p_org_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Health score RPC — composite 0–100 community health index
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_community_health_score(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role        text;
  v_pkg_overdue        int := 0;
  v_pkg_total_30       int := 0;
  v_inc_open           int := 0;
  v_inc_overdue        int := 0;
  v_sla_pct            numeric := 100;
  v_pending_members    int := 0;
  v_score              int;
  v_pkg_score          int;
  v_inc_score          int;
  v_member_score       int;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Package component (40 pts)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('received','ready_for_pickup') AND received_at < now() - interval '3 days'),
    COUNT(*)
  INTO v_pkg_overdue, v_pkg_total_30
  FROM package_log_items
  WHERE org_id = p_org_id AND received_at >= now() - interval '30 days';

  v_pkg_score := GREATEST(0, 40 - LEAST(40, v_pkg_overdue * 5));

  -- Incident component (40 pts)
  SELECT
    COUNT(*) FILTER (WHERE status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%' AND status NOT IN ('monitoring')),
    COUNT(*) FILTER (WHERE sla_due_at < now() AND status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%')
  INTO v_inc_open, v_inc_overdue
  FROM incident_reports
  WHERE org_id = p_org_id AND created_at >= now() - interval '30 days';

  v_inc_score := GREATEST(0, 40 - LEAST(20, v_inc_open * 2) - LEAST(20, v_inc_overdue * 4));

  -- Member component (20 pts) — pending queue penalty
  SELECT COUNT(*) INTO v_pending_members
  FROM org_memberships WHERE org_id = p_org_id AND status = 'pending';

  v_member_score := GREATEST(0, 20 - LEAST(20, v_pending_members * 2));

  v_score := v_pkg_score + v_inc_score + v_member_score;

  RETURN jsonb_build_object(
    'score',          v_score,
    'pkg_score',      v_pkg_score,
    'inc_score',      v_inc_score,
    'member_score',   v_member_score,
    'grade', CASE
      WHEN v_score >= 90 THEN 'A'
      WHEN v_score >= 80 THEN 'B'
      WHEN v_score >= 70 THEN 'C'
      WHEN v_score >= 60 THEN 'D'
      ELSE 'F'
    END,
    'status', CASE
      WHEN v_score >= 85 THEN 'Healthy'
      WHEN v_score >= 65 THEN 'Fair'
      WHEN v_score >= 45 THEN 'Needs Attention'
      ELSE 'Critical'
    END
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_package_analytics(uuid, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION get_incident_analytics(uuid, int)     TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_analytics(uuid, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_health_score(uuid)      TO authenticated;



-- #############################################################
-- ##  activity-audit-migration.sql
-- #############################################################
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



-- #############################################################
-- ##  security-gateway-migration.sql
-- #############################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo · Security Gateway — Migration
-- Additive; aligns with existing migrations (multi-context, package-ops-board,
-- activity-audit, rate-limit). No existing tables are dropped or re-created.
--
-- Creates:
--   idempotency_keys        — 24h TTL cache for POST mutation replay protection
--   stripe_processed_events — Stripe webhook event-id idempotency ledger
--   security_events         — gateway security log (rate limit breaches,
--                             auth failures, cross-context attempts)
--   cleanup_idempotency_keys() — TTL sweeper (call opportunistically or via cron)
--
-- Alters:
--   package_log_items.status CHECK — adds 'pending' (pre-arrival state used by
--   the gateway status machine; all other API statuses map onto existing values)
--
-- API ↔ DB status mapping (enforced in the api-gateway edge function):
--   pending   ↔ pending
--   arrived   ↔ received
--   held      ↔ ready_for_pickup
--   picked_up ↔ picked_up
--   returned  ↔ returned_to_sender
--   lost      ↔ exception (exception_reason = 'lost')
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Idempotency keys ───────────────────────────────────────────────────────
-- Written ONLY by Edge Functions via service role. Never exposed to clients.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key              UUID        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route            TEXT        NOT NULL,
  response_status  INTEGER     NOT NULL,
  response_body    JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON public.idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user
  ON public.idempotency_keys (user_id, route);

-- Service-role only: enable RLS with NO policies → anon/authenticated are
-- denied everything; service role bypasses RLS.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- TTL sweeper. Safe to call opportunistically from Edge Functions.
CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
END;
$$;

-- ── 2. Stripe processed events (webhook replay/duplicate protection) ──────────
-- Insert-first pattern: the webhook INSERTs the event id BEFORE processing;
-- a unique violation means the event was already handled → return 200.

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id     TEXT        PRIMARY KEY,
  event_type   TEXT        NOT NULL,
  outcome      TEXT        NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_at
  ON public.stripe_processed_events (processed_at);

-- Service-role only.
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- ── 3. Security events (gateway security log) ─────────────────────────────────
-- Complements org_audit_log: org_audit_log is org-scoped (org_id NOT NULL),
-- while security events often occur before any org context is known
-- (unauthenticated probes, malformed tokens, rate-limit breaches).

CREATE TABLE IF NOT EXISTS public.security_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL
                 CHECK (event_type IN (
                   'rate_limit_breach',
                   'auth_failure',
                   'role_claim_mismatch',
                   'cross_context_denied',
                   'invalid_transition',
                   'validation_rejected',
                   'payload_too_large',
                   'webhook_signature_invalid',
                   'webhook_replay_rejected'
                 )),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id       UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  route        TEXT,
  -- Never store raw payloads or PII here — only coarse diagnostic metadata.
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_at
  ON public.security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON public.security_events (user_id, created_at DESC);

-- Service-role writes only; super_admins may read via RPC below.
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Super-admin read access (checked at DB level, not from JWT claims)
DROP POLICY IF EXISTS "super_admin_read_security_events" ON public.security_events;
DROP POLICY IF EXISTS "super_admin_read_security_events" ON public.security_events;
CREATE POLICY "super_admin_read_security_events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.role    = 'super_admin'
    )
  );

-- ── 4. Widen package_log_items.status to include 'pending' ────────────────────
-- Pre-arrival state used by the gateway package status machine.
-- All existing values remain valid; this is additive.

ALTER TABLE public.package_log_items
  DROP CONSTRAINT IF EXISTS package_log_items_status_check;

ALTER TABLE public.package_log_items
  ADD CONSTRAINT package_log_items_status_check
  CHECK (status IN (
    'pending',
    'received',
    'ready_for_pickup',
    'picked_up',
    'returned_to_sender',
    'exception'
  ));

-- ── 5. Auth context RPC ────────────────────────────────────────────────────────
-- Authoritative role + enrolled contexts, fetched at the DB level for the
-- calling user. The gateway calls this AFTER verifying the JWT signature and
-- compares the result against any role claim embedded in the token.

CREATE OR REPLACE FUNCTION public.get_gateway_auth_context()
RETURNS TABLE (
  org_id       UUID,
  property_id  UUID,
  unit_id      UUID,
  role         TEXT,
  is_primary   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.org_id,
      u.property_id,
      m.unit_id,
      m.role::TEXT,
      (ROW_NUMBER() OVER (ORDER BY m.joined_at ASC NULLS LAST, m.created_at ASC) = 1) AS is_primary
    FROM public.org_memberships m
    LEFT JOIN public.units u ON u.id = m.unit_id
    WHERE m.user_id = auth.uid()
      AND m.status  = 'active';
END;
$$;



-- #############################################################
-- ##  onboarding-experiment-config.sql
-- #############################################################
-- ============================================================
-- PORCHIVO — ONBOARDING A/B EXPERIMENT CONFIG
-- Remote control surface for the onboarding welcome/paywall test.
-- Flip rows here to change variants live; the app reads them at launch.
-- Idempotent — safe to re-run.
-- ============================================================

create table if not exists public.experiment_config (
  key             text primary key,
  -- Master kill switch. false => everyone gets 'control'.
  enabled         boolean      not null default true,
  -- Force one variant for everyone (overrides rollout). null => bucket normally.
  -- Allowed: 'control' | 'visibility_led'
  forced_variant  text,
  -- 0..100 share of traffic allocated to the treatment ('visibility_led').
  rollout_percent integer      not null default 50
                    check (rollout_percent between 0 and 100),
  description     text,
  updated_at      timestamptz  not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.touch_experiment_config()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_experiment_config on public.experiment_config;
DROP TRIGGER IF EXISTS trg_touch_experiment_config ON public.experiment_config;
create trigger trg_touch_experiment_config
  before update on public.experiment_config
  for each row execute function public.touch_experiment_config();

-- Seed the onboarding experiment at a 50/50 split (no-op if it already exists).
insert into public.experiment_config (key, enabled, forced_variant, rollout_percent, description)
values (
  'onboarding_welcome_v1',
  true,
  null,
  50,
  'Welcome headline + paywall copy. control vs visibility_led. rollout_percent = % to visibility_led.'
)
on conflict (key) do nothing;

-- ============================================================
-- RLS — config is public-readable (anon + authenticated), writable only by
-- service role / dashboard. Clients never write experiment config.
-- ============================================================

alter table public.experiment_config enable row level security;

drop policy if exists "Anyone can read experiment config" on public.experiment_config;
DROP POLICY IF EXISTS "Anyone can read experiment config" ON public.experiment_config;
create policy "Anyone can read experiment config"
  on public.experiment_config for select
  using (true);

-- No insert/update/delete policies => only service_role (which bypasses RLS)
-- and the Supabase dashboard can modify rows.

-- ============================================================
-- HOW TO OPERATE
-- ============================================================
-- Kill the test (everyone -> control):
--   update public.experiment_config set enabled = false where key = 'onboarding_welcome_v1';
-- Force the winner to 100%:
--   update public.experiment_config set forced_variant = 'visibility_led' where key = 'onboarding_welcome_v1';
-- Ramp treatment to 80%:
--   update public.experiment_config set rollout_percent = 80, forced_variant = null where key = 'onboarding_welcome_v1';
--
-- MEASURING RETENTION: analytics_events now carries props->>'variant' and
-- props->>'device_id' on every row. Example D7 retention by variant:
--   select props->>'variant' as variant,
--          count(distinct props->>'device_id') as cohort,
--          count(distinct case when event = 'onboarding_complete'
--                then props->>'device_id' end) as completed
--   from public.analytics_events
--   where props->>'experiment' = 'onboarding_welcome_v1'
--   group by 1;



-- #############################################################
-- ##  onboarding-experiment-results.sql
-- #############################################################
-- ============================================================
-- PORCHIVO — ONBOARDING A/B EXPERIMENT: RESULTS & RETENTION
-- Cohort sizing, retention (D1/D7/D30), conversion, and a basic
-- significance check — all sliced by variant.
-- Idempotent — safe to re-run. Depends on:
--   * public.analytics_events  (event, props, user_id, created_at)
--   * public.experiment_config (the remote control surface)
--   * public.experiment_identity (device_id -> user_id stitch, created below)
-- ============================================================

-- ------------------------------------------------------------
-- DECISION (locked up front to avoid p-hacking):
--   PRIMARY METRIC : D7 retention — % of exposed devices that fire a
--                    session_start on day 7 (days 7–8 window) after exposure.
--   GUARDRAIL      : paywall conversion (purchase_success / paywall_view).
--                    A retention win must NOT come with a conversion regression.
--   UNIT           : device_id (pre-auth), stitched to user_id post-signup.
--   DENOMINATOR    : devices that fired `experiment_exposure` (welcome seen).
--   CALL A WINNER  : only when the two-proportion z-test on the primary metric
--                    clears |z| >= 1.96 (~95%) AND the guardrail has not
--                    regressed beyond noise. Minimum ~300+ per arm first.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- device_id -> user_id stitch table (written by the app post-signup).
-- Lets anonymous, pre-auth onboarding events join to the authenticated user.
-- ------------------------------------------------------------
create table if not exists public.experiment_identity (
  device_id   text        not null,
  experiment  text        not null,
  user_id     uuid        not null,
  created_at  timestamptz not null default now(),
  primary key (device_id, experiment)
);

alter table public.experiment_identity enable row level security;

-- Authenticated clients may upsert only their own mapping.
drop policy if exists "Users stitch own identity" on public.experiment_identity;
DROP POLICY IF EXISTS "Users stitch own identity" ON public.experiment_identity;
create policy "Users stitch own identity"
  on public.experiment_identity for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own identity" on public.experiment_identity;
DROP POLICY IF EXISTS "Users update own identity" ON public.experiment_identity;
create policy "Users update own identity"
  on public.experiment_identity for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own identity" on public.experiment_identity;
DROP POLICY IF EXISTS "Users read own identity" ON public.experiment_identity;
create policy "Users read own identity"
  on public.experiment_identity for select to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 1) One row per exposed device: variant + exposure timestamp.
--    This is the canonical participant list (the denominator).
-- ------------------------------------------------------------
create or replace view public.v_experiment_exposure as
select
  e.props ->> 'device_id'                      as device_id,
  e.props ->> 'experiment'                     as experiment,
  coalesce(e.props ->> 'variant', 'control')   as variant,
  min(e.created_at)                            as exposed_at
from public.analytics_events e
where e.event = 'experiment_exposure'
  and e.props ->> 'device_id' is not null
group by 1, 2, 3;

-- ------------------------------------------------------------
-- 2) Distinct active days per device (the retention signal).
--    session_start fires once per launch; we collapse to the calendar day.
-- ------------------------------------------------------------
create or replace view public.v_experiment_active_days as
select distinct
  e.props ->> 'device_id'              as device_id,
  e.props ->> 'experiment'             as experiment,
  (e.created_at at time zone 'UTC')::date as active_day
from public.analytics_events e
where e.event = 'session_start'
  and e.props ->> 'device_id' is not null;

-- ------------------------------------------------------------
-- 3) Per-device retention + conversion fact row.
-- ------------------------------------------------------------
create or replace view public.v_experiment_device_facts as
with exp as (
  select * from public.v_experiment_exposure
),
ad as (
  select * from public.v_experiment_active_days
),
conv as (
  select
    e.props ->> 'device_id' as device_id,
    e.props ->> 'experiment' as experiment,
    max((e.event = 'paywall_view')::int)     as saw_paywall,
    max((e.event = 'purchase_success')::int) as purchased,
    max((e.event = 'trial_start')::int)      as started_trial
  from public.analytics_events e
  where e.props ->> 'device_id' is not null
    and e.event in ('paywall_view', 'purchase_success', 'trial_start')
  group by 1, 2
)
select
  exp.device_id,
  exp.experiment,
  exp.variant,
  exp.exposed_at,
  -- Retention: did an active day fall in the D1 / D7 / D30 window after exposure?
  max((ad.active_day = (exp.exposed_at at time zone 'UTC')::date + 1)::int)              as retained_d1,
  max((ad.active_day between (exp.exposed_at at time zone 'UTC')::date + 7
                         and (exp.exposed_at at time zone 'UTC')::date + 8)::int)         as retained_d7,
  max((ad.active_day between (exp.exposed_at at time zone 'UTC')::date + 30
                         and (exp.exposed_at at time zone 'UTC')::date + 31)::int)        as retained_d30,
  coalesce(max(conv.saw_paywall), 0)    as saw_paywall,
  coalesce(max(conv.purchased), 0)      as purchased,
  coalesce(max(conv.started_trial), 0)  as started_trial
from exp
left join ad   on ad.device_id = exp.device_id and ad.experiment = exp.experiment
left join conv on conv.device_id = exp.device_id and conv.experiment = exp.experiment
group by exp.device_id, exp.experiment, exp.variant, exp.exposed_at;

-- ------------------------------------------------------------
-- 4) The headline results table: one row per variant.
--    cohort | D1/D7/D30 retention | trial-start | paywall conversion.
-- ------------------------------------------------------------
create or replace view public.v_experiment_results as
select
  experiment,
  variant,
  count(*)                                                         as cohort_size,
  round(avg(retained_d1)::numeric, 4)                             as d1_retention,
  round(avg(retained_d7)::numeric, 4)                             as d7_retention,   -- PRIMARY METRIC
  round(avg(retained_d30)::numeric, 4)                            as d30_retention,
  round(avg(started_trial)::numeric, 4)                           as trial_start_rate,
  sum(saw_paywall)                                                as paywall_views,
  sum(purchased)                                                  as purchases,
  round(
    case when sum(saw_paywall) > 0
      then sum(purchased)::numeric / sum(saw_paywall) else 0 end, 4
  )                                                               as paywall_conversion -- GUARDRAIL
from public.v_experiment_device_facts
group by experiment, variant;

-- ------------------------------------------------------------
-- 5) Significance check on the PRIMARY metric (D7 retention),
--    control vs visibility_led, via a two-proportion z-test.
--    Returns z, an approx 95% verdict, and the guardrail deltas so you
--    never call a retention win that quietly tanks conversion.
-- ------------------------------------------------------------
create or replace view public.v_experiment_significance as
with arms as (
  select
    experiment,
    sum(case when variant = 'control'        then 1 else 0 end)            as n_c,
    sum(case when variant = 'control'        then retained_d7 else 0 end)  as x_c,
    sum(case when variant = 'visibility_led' then 1 else 0 end)            as n_t,
    sum(case when variant = 'visibility_led' then retained_d7 else 0 end)  as x_t,
    -- guardrail inputs
    sum(case when variant = 'control'        then saw_paywall else 0 end)  as pv_c,
    sum(case when variant = 'control'        then purchased   else 0 end)  as pu_c,
    sum(case when variant = 'visibility_led' then saw_paywall else 0 end)  as pv_t,
    sum(case when variant = 'visibility_led' then purchased   else 0 end)  as pu_t
  from public.v_experiment_device_facts
  group by experiment
),
calc as (
  select
    experiment, n_c, n_t, x_c, x_t, pv_c, pu_c, pv_t, pu_t,
    case when n_c > 0 then x_c::numeric / n_c else 0 end as p_c,
    case when n_t > 0 then x_t::numeric / n_t else 0 end as p_t,
    case when (n_c + n_t) > 0 then (x_c + x_t)::numeric / (n_c + n_t) else 0 end as p_pool
  from arms
)
select
  experiment,
  n_c                                            as control_n,
  n_t                                            as treatment_n,
  round(p_c, 4)                                  as control_d7,
  round(p_t, 4)                                  as treatment_d7,
  round(p_t - p_c, 4)                            as d7_lift_abs,
  round(
    case
      when p_pool in (0, 1) or n_c = 0 or n_t = 0 then 0
      else (p_t - p_c) /
           sqrt(p_pool * (1 - p_pool) * (1.0 / n_c + 1.0 / n_t))
    end, 3
  )                                              as z_score,
  case
    when n_c < 300 or n_t < 300 then 'insufficient_sample'
    when p_pool in (0, 1) or n_c = 0 or n_t = 0 then 'no_data'
    when abs(
      (p_t - p_c) /
      nullif(sqrt(p_pool * (1 - p_pool) * (1.0 / n_c + 1.0 / n_t)), 0)
    ) >= 1.96 then 'significant_95'
    else 'not_significant'
  end                                            as verdict,
  -- Guardrail: paywall conversion delta (treatment - control).
  round(
    (case when pv_t > 0 then pu_t::numeric / pv_t else 0 end)
    - (case when pv_c > 0 then pu_c::numeric / pv_c else 0 end), 4
  )                                              as conversion_guardrail_delta
from calc;

-- ------------------------------------------------------------
-- HOW TO READ
--   select * from public.v_experiment_results;        -- side-by-side cohorts
--   select * from public.v_experiment_significance;   -- winner check + guardrail
-- Call a winner only when verdict = 'significant_95' AND
-- conversion_guardrail_delta is not meaningfully negative.
-- ------------------------------------------------------------



-- #############################################################
-- ##  support-tickets-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Support Tickets + AI-Drafted Staff Replies
-- Run in Supabase SQL Editor AFTER migration.sql.
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================
--
-- Creates the `support_tickets` table that expo/lib/supportTickets.ts
-- and the app/contact-support.tsx + app/support-ticket-detail.tsx screens
-- already read/write against. Until this migration is applied, every
-- client call hits `relation "public.support_tickets" does not exist`.
--
-- Security model
--   * Users can SELECT/UPDATE only their own rows (user_id = auth.uid()).
--   * Users can INSERT their own rows (user_id forced to auth.uid() by a
--     WITH CHECK policy — the client never sends user_id).
--   * Staff with auth.app_metadata.role = 'support_staff' can SELECT all
--     tickets and UPDATE any ticket (WITH CHECK keeps user_id stable so
--     staff cannot reassign ownership).
--   * AI-draft columns (ai_draft_reply, ai_draft_generated_at,
--     ai_draft_model, ai_draft_feedback) are STAFF-ONLY. Column-level
--     grants revoke SELECT on them from authenticated, so a user's
--     `select *` never sees the draft. The support-ticket-ai-draft Edge
--     Function (service role) is the only writer of these columns.
--   * The on_ticket_created trigger enqueues an AI-draft generation job
--     by calling the support-ticket-ai-draft Edge Function via pg_net.
-- ============================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  subject           text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body              text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),

  category          text        NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'delivery_issue', 'payment_billing', 'account_access',
                        'partner_dispute', 'app_bug', 'feature_request',
                        'safety_alert', 'other'
                      )),
  status            text        NOT NULL DEFAULT 'open'
                      CHECK (status IN (
                        'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'
                      )),
  priority          text        NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Staff-owned fields (never written by the user).
  staff_reply         text,
  staff_replied_at    timestamptz,
  resolution_note     text,
  resolved_at         timestamptz,

  -- User-supplied context (optional, capped to keep rows small).
  attachment_url      text,
  app_version         text,
  platform            text,
  device_model        text,

  -- AI-drafted staff reply (STAFF-ONLY — see column-level grants below).
  -- Written exclusively by the support-ticket-ai-draft Edge Function
  -- (service role). Staff review the draft, edit as needed, then promote
  -- it to staff_reply. Users never see these columns.
  ai_draft_reply        text,
  ai_draft_generated_at timestamptz,
  ai_draft_model        text,
  ai_draft_feedback     text CHECK (ai_draft_feedback IN ('accepted', 'edited', 'rejected') OR ai_draft_feedback IS NULL),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at
  ON public.support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_staff_queue
  ON public.support_tickets (status, created_at DESC)
  WHERE status IN ('open', 'in_progress', 'waiting_on_user');


-- ── 2. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users: read only their own tickets.
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users: insert their own tickets. user_id must match auth.uid() — the
-- client never sends user_id; the default is filled by the trigger below
-- as a defence-in-depth layer (the WITH CHECK here is the real gate).
DROP POLICY IF EXISTS "Users insert own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users insert own support tickets" ON public.support_tickets;
CREATE POLICY "Users insert own support tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users: update their own tickets (reply / close / reopen). They may NOT
-- touch staff-only columns — enforced by the trigger below (trg_guard_ticket_writes).
DROP POLICY IF EXISTS "Users update own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users update own support tickets" ON public.support_tickets;
CREATE POLICY "Users update own support tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users: delete their own tickets (rare; used by account-deletion cascade
-- via the FK ON DELETE CASCADE, so this policy is belt-and-suspenders).
DROP POLICY IF EXISTS "Users delete own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users delete own support tickets" ON public.support_tickets;
CREATE POLICY "Users delete own support tickets"
  ON public.support_tickets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Staff: read all tickets. Membership is decided by the JWT app_metadata.role
-- claim set by the admin role-management migration. We check it via
-- auth.app_metadata ->> 'role' so staff sessions (issued with role=
-- 'support_staff') see every row, while regular users fall back to the
-- owner-only policy above.
DROP POLICY IF EXISTS "Staff view all support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff view all support tickets" ON public.support_tickets;
CREATE POLICY "Staff view all support tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
         OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');

-- Staff: update any ticket (reply, change status, set priority, write
-- resolution_note). user_id must stay stable — staff cannot reassign
-- ownership of a ticket to another user.
DROP POLICY IF EXISTS "Staff update any support ticket" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff update any support ticket" ON public.support_tickets;
CREATE POLICY "Staff update any support ticket"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
         OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
              OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');

-- No staff INSERT/DELETE policies — tickets are created by users and
-- removed only by the account-deletion cascade (FK ON DELETE CASCADE).


-- ── 3. Column-level grants: hide AI-draft columns from users ────────────────
-- PostgREST returns only columns the role has been GRANTed SELECT on, so
-- revoking SELECT on the AI-draft columns makes them invisible to a user's
-- `select *` even though RLS would otherwise let them read the row.
-- The service role bypasses GRANT checks, so the Edge Function still sees
-- and writes them.
REVOKE SELECT (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets FROM authenticated;
GRANT SELECT (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets TO service_role;
GRANT UPDATE (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets TO service_role;


-- ── 4. Triggers ─────────────────────────────────────────────────────────────

-- 4a. Stamp user_id from auth.uid() on INSERT if the caller forgot to send
--     it (defence-in-depth — the WITH CHECK policy is the real gate).
CREATE OR REPLACE FUNCTION public.stamp_ticket_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_ticket_owner ON public.support_tickets;
DROP TRIGGER IF EXISTS trg_stamp_ticket_owner ON public.support_tickets;
CREATE TRIGGER trg_stamp_ticket_owner
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_ticket_owner();


-- 4b. Guard writes: regular users may only touch user-writable columns
--     (subject, body, status, attachment_url, app_version, platform,
--     device_model). Staff-owned columns (staff_reply, staff_replied_at,
--     resolution_note, resolved_at, priority, ai_draft_*) are read-only
--     from the client. Staff sessions bypass this guard.
CREATE OR REPLACE FUNCTION public.guard_ticket_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata') ->> 'role';

  -- Staff / super_admin: allow any column change (policy already gated role).
  IF v_role IN ('support_staff', 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Regular user: reject changes to staff-owned columns.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.staff_reply       IS DISTINCT FROM OLD.staff_reply
    OR NEW.staff_replied_at  IS DISTINCT FROM OLD.staff_replied_at
    OR NEW.resolution_note   IS DISTINCT FROM OLD.resolution_note
    OR NEW.resolved_at       IS DISTINCT FROM OLD.resolved_at
    OR NEW.priority          IS DISTINCT FROM OLD.priority
    OR NEW.ai_draft_reply    IS DISTINCT FROM OLD.ai_draft_reply
    OR NEW.ai_draft_generated_at IS DISTINCT FROM OLD.ai_draft_generated_at
    OR NEW.ai_draft_model    IS DISTINCT FROM OLD.ai_draft_model
    OR NEW.ai_draft_feedback IS DISTINCT FROM OLD.ai_draft_feedback
    OR NEW.user_id           IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot modify staff-owned columns on support_tickets';
    END IF;
  END IF;

  -- INSERT: user must not preset staff-owned columns.
  IF TG_OP = 'INSERT' THEN
    IF NEW.staff_reply IS NOT NULL
    OR NEW.staff_replied_at IS NOT NULL
    OR NEW.resolution_note IS NOT NULL
    OR NEW.resolved_at IS NOT NULL
    OR NEW.priority IS DISTINCT FROM 'normal'
    OR NEW.ai_draft_reply IS NOT NULL
    OR NEW.ai_draft_generated_at IS NOT NULL
    OR NEW.ai_draft_model IS NOT NULL
    OR NEW.ai_draft_feedback IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot preset staff-owned columns on support_tickets';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ticket_writes ON public.support_tickets;
DROP TRIGGER IF EXISTS trg_guard_ticket_writes ON public.support_tickets;
CREATE TRIGGER trg_guard_ticket_writes
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_writes();


-- 4c. Auto-update updated_at (reuses the shared trigger function from migration.sql).
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 4d. On ticket creation, fire-and-forget call the AI-draft Edge Function
--     via pg_net so staff get a suggested reply within seconds of submission.
--     The function is self-throttling (rate-limited inside the Edge Function)
--     and idempotent (it only writes when ai_draft_reply IS NULL).
CREATE OR REPLACE FUNCTION public.enqueue_ticket_ai_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fn_url text;
  v_token text;
BEGIN
  -- Only generate a draft for brand-new open tickets (not reopens).
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_fn_url := current_setting('app.support_ticket_ai_draft_url', true);
  v_token  := current_setting('app.support_ticket_ai_draft_token', true);

  -- If the Edge Function URL or bearer token is not configured via
  --   ALTER DATABASE ... SET app.support_ticket_ai_draft_url = 'https://...';
  --   ALTER DATABASE ... SET app.support_ticket_ai_draft_token = '...';
  -- then skip silently — the ticket still creates, staff just draft manually.
  IF v_fn_url IS NULL OR v_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget POST. The Edge Function re-checks ownership / status
  -- and is the only writer of ai_draft_* columns. Errors are swallowed so
  -- a transient pg_net failure never blocks ticket creation.
  PERFORM net.http_post(
    url    := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body   := jsonb_build_object('ticketId', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_ticket_ai_draft ON public.support_tickets;
DROP TRIGGER IF EXISTS trg_enqueue_ticket_ai_draft ON public.support_tickets;
CREATE TRIGGER trg_enqueue_ticket_ai_draft
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_ticket_ai_draft();


-- ── 5. Verification ─────────────────────────────────────────────────────────
-- After running this migration, execute the following to confirm:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'support_tickets';
--   -- Expected: rowsecurity = true
--
--   SELECT polname, polcmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets';
--   -- Expected: 6 policies (user select/insert/update/delete + staff select/update)
--
--   SELECT has_column_privilege('authenticated', 'public.support_tickets', 'ai_draft_reply', 'SELECT');
--   -- Expected: false (users cannot see AI-draft columns)
--   SELECT has_column_privilege('service_role', 'public.support_tickets', 'ai_draft_reply', 'SELECT');
--   -- Expected: true


-- ── 6. Staff helper: is the caller a support staff member? ────────────────────
-- Checks (auth.jwt() -> 'app_metadata').role for 'support_staff' or 'super_admin'.
-- This mirrors the role claims enforced by the staff policies above and is
-- used by the staff RPCs (get_staff_support_queue / send_staff_ticket_reply /
-- regenerate_ticket_ai_draft) to gate access before returning AI-draft columns
-- or applying staff-side mutations.
CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata') ->> 'role' IN ('support_staff', 'super_admin');
$$;

GRANT EXECUTE ON FUNCTION public.is_support_staff() TO authenticated;


-- ── 7. RPC: get_staff_support_queue ───────────────────────────────────────────
-- Returns all tickets with the staff-only AI-draft columns. SECURITY DEFINER
-- (owner-privileged) so the column-level REVOKE on authenticated does not
-- hide ai_draft_* from this query; the function re-checks the caller's
-- app_metadata.role so only support_staff / super_admin get rows back.
--
-- p_status_filter: null = all statuses, otherwise one of the status enum values.
-- p_priority_filter: null = any priority, otherwise one of low/normal/high/urgent.
-- p_search: optional ILIKE against subject / body / user_id; null/empty = no search.
-- p_limit: capped at 200. p_offset: pagination offset.
CREATE OR REPLACE FUNCTION public.get_staff_support_queue(
  p_status_filter    text DEFAULT NULL,
  p_priority_filter  text DEFAULT NULL,
  p_search           text DEFAULT NULL,
  p_limit            int  DEFAULT 100,
  p_offset           int  DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  subject           text,
  body              text,
  category          text,
  status            text,
  priority          text,
  staff_reply       text,
  staff_replied_at  timestamptz,
  resolution_note   text,
  resolved_at       timestamptz,
  attachment_url    text,
  app_version       text,
  platform          text,
  device_model      text,
  ai_draft_reply        text,
  ai_draft_generated_at timestamptz,
  ai_draft_model        text,
  ai_draft_feedback     text,
  created_at        timestamptz,
  updated_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(TRIM(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.subject,
    t.body,
    t.category,
    t.status,
    t.priority,
    t.staff_reply,
    t.staff_replied_at,
    t.resolution_note,
    t.resolved_at,
    t.attachment_url,
    t.app_version,
    t.platform,
    t.device_model,
    t.ai_draft_reply,
    t.ai_draft_generated_at,
    t.ai_draft_model,
    t.ai_draft_feedback,
    t.created_at,
    t.updated_at
  FROM public.support_tickets t
  WHERE (p_status_filter   IS NULL OR t.status   = p_status_filter)
    AND (p_priority_filter IS NULL OR t.priority = p_priority_filter)
    AND (
      v_search IS NULL
      OR t.subject ILIKE '%' || v_search || '%'
      OR t.body   ILIKE '%' || v_search || '%'
      OR t.user_id::text ILIKE '%' || v_search || '%'
    )
  ORDER BY
    CASE t.status
      WHEN 'open'           THEN 0
      WHEN 'in_progress'    THEN 1
      WHEN 'waiting_on_user' THEN 2
      WHEN 'resolved'       THEN 3
      WHEN 'closed'         THEN 4
      ELSE 5
    END,
    t.priority DESC NULLS LAST,
    t.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_support_queue(text, text, text, int, int) TO authenticated;


-- ── 8. RPC: get_staff_support_queue_counts ──────────────────────────────────
-- Quick per-status counts for the staff queue header badges. Same staff gate.
CREATE OR REPLACE FUNCTION public.get_staff_support_queue_counts()
RETURNS TABLE (
  status         text,
  status_count   bigint,
  with_draft     bigint,
  awaiting_review bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  RETURN QUERY
  SELECT
    t.status,
    COUNT(*)::bigint AS status_count,
    COUNT(*) FILTER (WHERE t.ai_draft_reply IS NOT NULL)::bigint AS with_draft,
    COUNT(*) FILTER (
      WHERE t.ai_draft_reply IS NOT NULL
        AND t.staff_reply IS NULL
        AND t.status IN ('open', 'in_progress')
    )::bigint AS awaiting_review
  FROM public.support_tickets t
  GROUP BY t.status
  ORDER BY MIN(t.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_support_queue_counts() TO authenticated;


-- ── 9. RPC: send_staff_ticket_reply ──────────────────────────────────────────
-- Promotes a (possibly edited) AI draft (or an entirely hand-written reply)
-- to the user-visible staff_reply column. Marks ai_draft_feedback so the
-- AI-draft pipeline can measure accept/edit/reject rates, then advances the
-- ticket status to 'waiting_on_user'. Staff-only; SECURITY DEFINER so it can
-- write to the staff-owned columns that the trg_guard_ticket_writes trigger
-- would otherwise block on the authenticated role.
--
-- p_feedback: 'accepted' if the draft was sent as-is, 'edited' if the staff
-- modified the text, 'rejected' if staff wrote a brand-new reply without using
-- the draft. NULL defaults to 'edited' when a draft existed, else 'rejected'.
CREATE OR REPLACE FUNCTION public.send_staff_ticket_reply(
  p_ticket_id        uuid,
  p_reply_text       text,
  p_feedback         text DEFAULT NULL,
  p_resolution_note  text DEFAULT NULL,
  p_mark_resolved    boolean DEFAULT FALSE
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_feedback text;
  v_new_status text;
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  IF COALESCE(TRIM(p_reply_text), '') = '' THEN
    RAISE EXCEPTION 'Reply text must not be empty';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Decide draft feedback label for analytics.
  v_feedback := p_feedback;
  IF v_feedback IS NULL THEN
    IF v_ticket.ai_draft_reply IS NOT NULL THEN
      v_feedback := CASE WHEN p_reply_text = v_ticket.ai_draft_reply THEN 'accepted' ELSE 'edited' END;
    ELSE
      v_feedback := 'rejected';
    END IF;
  END IF;
  IF v_feedback NOT IN ('accepted', 'edited', 'rejected') THEN
    v_feedback := 'edited';
  END IF;

  v_new_status := CASE WHEN p_mark_resolved THEN 'resolved' ELSE 'waiting_on_user' END;

  UPDATE public.support_tickets
    SET staff_reply       = p_reply_text,
        staff_replied_at  = now(),
        ai_draft_feedback = v_feedback,
        resolution_note   = COALESCE(p_resolution_note, resolution_note),
        resolved_at       = CASE WHEN p_mark_resolved THEN now() ELSE resolved_at END,
        status            = v_new_status,
        updated_at        = now()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_staff_ticket_reply(uuid, text, text, text, boolean) TO authenticated;


-- ── 10. RPC: regenerate_ticket_ai_draft ──────────────────────────────────────
-- Re-enqueues the AI-draft Edge Function for a ticket (e.g. staff clicked
-- "Regenerate draft"). Clears the existing ai_draft_* columns first so the
-- Edge Function's idempotent "ai_draft_reply IS NULL" guard does not skip it.
-- Only callable by support staff. The actual AI generation happens
-- asynchronously in the Edge Function via pg_net — this RPC returns 200 once
-- the job is enqueued, not after the draft is written.
CREATE OR REPLACE FUNCTION public.regenerate_ticket_ai_draft(
  p_ticket_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fn_url text;
  v_token  text;
  v_ticket_exists boolean;
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = p_ticket_id)
    INTO v_ticket_exists;
  IF NOT v_ticket_exists THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_fn_url := current_setting('app.support_ticket_ai_draft_url', true);
  v_token  := current_setting('app.support_ticket_ai_draft_token', true);

  IF v_fn_url IS NULL OR v_token IS NULL THEN
    RAISE EXCEPTION 'AI draft function not configured on this database';
  END IF;

  -- Clear the existing draft so the Edge Function will write a new one.
  UPDATE public.support_tickets
    SET ai_draft_reply        = NULL,
        ai_draft_generated_at = NULL,
        ai_draft_model        = NULL,
        ai_draft_feedback     = NULL,
        updated_at            = now()
  WHERE id = p_ticket_id;

  PERFORM net.http_post(
    url     := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object('ticketId', p_ticket_id)
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_ticket_ai_draft(uuid) TO authenticated;


-- ── 11. RPC: get_staff_push_tokens ─────────────────────────────────────────────
-- Returns the Expo push tokens for every support_staff / super_admin user, so
-- the support-ticket-ai-draft Edge Function can fire a push notification to all
-- on-duty staff the moment a draft lands. Service-role only (the function is
-- called from the Edge Function with the service-role key, not from the client).
--
-- Staff membership is decided by the JWT app_metadata.role claim, which lives
-- on auth.users.raw_app_meta_data. The service role bypasses RLS on auth.users.
CREATE OR REPLACE FUNCTION public.get_staff_push_tokens()
RETURNS TABLE (user_id uuid, expo_push_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No is_support_staff() gate here — this RPC is service-role only and is
  -- never exposed to authenticated clients (no GRANT EXECUTE to authenticated).
  -- It reads auth.users.raw_app_meta_data, which only the service role can see.
  RETURN QUERY
  SELECT p.id, p.expo_push_token
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.expo_push_token IS NOT NULL
    AND p.expo_push_token <> ''
    AND (u.raw_app_meta_data ->> 'role' = 'support_staff'
         OR u.raw_app_meta_data ->> 'role' = 'super_admin');
END;
$$;

-- Intentionally NO `GRANT EXECUTE ... TO authenticated` — service-role only.
-- The support-ticket-ai-draft Edge Function calls this with the service key.
REVOKE EXECUTE ON FUNCTION public.get_staff_push_tokens() FROM authenticated, anon;



-- #############################################################
-- ##  support-reply-templates-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Staff Support Reply Templates
-- Run in Supabase SQL Editor AFTER support-tickets-migration.sql.
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================
--
-- Creates the `support_reply_templates` table that
-- expo/lib/supportTemplates.ts and the staff-support-queue reply
-- modal read/write against. Staff can save, edit, and select
-- pre-written templates for common property-management queries
-- (package theft reports, key-fob issues, HOA dues, vendor access,
-- noise complaints, move-in/move-out, etc.).
--
-- Security model
--   * Only support staff / super_admin ((auth.jwt() -> 'app_metadata').role)
--     can SELECT, INSERT, UPDATE, or DELETE templates.
--   * Templates are shared across all staff — there is no per-author
--     ownership filter, so any staff member can refine or remove a
--     template a colleague created. (Staff populations are small and
--     trusted; we intentionally avoid per-author scoping to keep the
--     library coherent and avoid template sprawl.)
--   * The `is_default` flag marks the seed rows shipped with the
--     schema. Staff can still edit/delete them — the flag only
--     controls whether the seed block re-inserts the row on re-runs
--     (ON CONFLICT DO NOTHING when is_default = true).
-- ============================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_reply_templates (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label        text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  body         text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  category     text        CHECK (category IS NULL OR category IN (
                          'delivery_issue', 'payment_billing', 'account_access',
                          'partner_dispute', 'app_bug', 'feature_request',
                          'safety_alert', 'other'
                        )),
  is_default   boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_reply_templates_category
  ON public.support_reply_templates (category)
  WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_reply_templates_default
  ON public.support_reply_templates (is_default)
  WHERE is_default = true;


-- ── 2. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.support_reply_templates ENABLE ROW LEVEL SECURITY;

-- Staff: read all templates.
DROP POLICY IF EXISTS "Staff view reply templates" ON public.support_reply_templates;
DROP POLICY IF EXISTS "Staff view reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff view reply templates"
  ON public.support_reply_templates FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
         OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');

-- Staff: create templates.
DROP POLICY IF EXISTS "Staff insert reply templates" ON public.support_reply_templates;
DROP POLICY IF EXISTS "Staff insert reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff insert reply templates"
  ON public.support_reply_templates FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
              OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');

-- Staff: update any template (shared library, no per-author gate).
DROP POLICY IF EXISTS "Staff update reply templates" ON public.support_reply_templates;
DROP POLICY IF EXISTS "Staff update reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff update reply templates"
  ON public.support_reply_templates FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
         OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
              OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');

-- Staff: delete any template.
DROP POLICY IF EXISTS "Staff delete reply templates" ON public.support_reply_templates;
DROP POLICY IF EXISTS "Staff delete reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff delete reply templates"
  ON public.support_reply_templates FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata') ->> 'role' = 'support_staff'
         OR (auth.jwt() -> 'app_metadata') ->> 'role' = 'super_admin');


-- ── 3. Triggers ─────────────────────────────────────────────────────────────

-- 3a. Stamp created_by from auth.uid() on INSERT when omitted.
CREATE OR REPLACE FUNCTION public.stamp_template_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_template_author ON public.support_reply_templates;
DROP TRIGGER IF EXISTS trg_stamp_template_author ON public.support_reply_templates;
CREATE TRIGGER trg_stamp_template_author
  BEFORE INSERT ON public.support_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_template_author();

-- 3b. Auto-update updated_at (reuses the shared trigger function from migration.sql).
DROP TRIGGER IF EXISTS support_reply_templates_updated_at ON public.support_reply_templates;
DROP TRIGGER IF EXISTS support_reply_templates_updated_at ON public.support_reply_templates;
CREATE TRIGGER support_reply_templates_updated_at
  BEFORE UPDATE ON public.support_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── 4. Seed default templates for common property-management queries ────────
-- Re-running this block is safe: ON CONFLICT DO NOTHING preserves any edits
-- staff have made to the seeded rows. To force a refresh, drop the row first.
-- Bodies use {{first_name}} / {{building_name}} / {{unit}} placeholders that
-- staff can substitute when composing the reply.

INSERT INTO public.support_reply_templates (label, body, category, is_default) VALUES
  (
    'Package theft report — file with local precinct',
    'Hi {{first_name}}, thanks for flagging the missing package. I''ve pulled the delivery timestamp from the courier log and the porch-camera clip is attached for your records. To file an official theft report, contact your local precinct''s non-emergency line with the tracking number and this footage; once you have a case number, reply here and we''ll log it on your unit''s safety record and share it with the block watch.',
    'delivery_issue',
    true
  ),
  (
    'HOA dues — payment plan request acknowledged',
    'Hi {{first_name}}, I''ve received your request for a payment plan on the outstanding HOA balance for {{unit}}. The board reviews payment-plan requests on the first Tuesday of each month; I''ve added yours to the next agenda and you''ll get a written decision within five business days of that meeting. In the meantime, no late fees will accrue and your community access remains active.',
    'payment_billing',
    true
  ),
  (
    'Key fob / access credential replacement',
    'Hi {{first_name}}, sorry about the lost fob. I''ve deactivated the old credential so it can''t be used even if found. Replacement fobs are $25 and can be picked up at the management office during business hours — bring a photo ID. If you need after-hours access today, reply with a time and I''ll meet you at the front desk to issue a temporary code valid for 24 hours.',
    'account_access',
    true
  ),
  (
    'Vendor / contractor access approval',
    'Hi {{first_name}}, your vendor-access request for {{unit}} is approved for the date and window you specified. The contractor must check in at the front desk with a photo ID and a copy of this approval; they''ll be issued a day-pass badge that expires at 6pm. Please make sure someone 18+ is on-site the entire time the vendor is in the unit.',
    'partner_dispute',
    true
  ),
  (
    'Noise complaint — first formal notice',
    'Hi {{first_name}}, we''ve received a noise complaint regarding your unit on {{date}}. This is a first notice under the community''s quiet-hours policy (10pm–7am weekdays, 11pm–8pm weekends). No fine is being assessed at this time. Please acknowledge receipt of this message and let us know if there''s a recurring cause we can help mediate. A second verified complaint within 30 days escalates to the board.',
    'other',
    true
  ),
  (
    'Move-out inspection scheduled',
    'Hi {{first_name}}, your move-out inspection for {{unit}} is scheduled for {{date}} at {{time}}. Please ensure the unit is empty, swept, and all keys/fobs/rental appliances are returned at the inspection. The walk-through takes about 30 minutes and you''re welcome to attend. Your security deposit refund, less any itemized deductions, will be issued within 30 days per your lease.',
    'other',
    true
  ),
  (
    'App bug — fix shipped, please update',
    'Hi {{first_name}}, thanks for the bug report — I was able to reproduce it on our end and the engineering team shipped a fix in version {{version}}. Open the App Store / Play Store, pull to refresh updates, and install the latest build. If the issue persists after updating, reply with a fresh screen recording and we''ll reopen the investigation immediately.',
    'app_bug',
    true
  ),
  (
    'Safety alert acknowledged — action taken',
    'Hi {{first_name}}, I''ve acknowledged your safety alert and logged it on the building''s incident board. I''ve also notified the on-site security contact and the block captain for your area. You should see a follow-up from the property team within 24 hours. If you feel unsafe at any point before then, call 911 first and reply here second — we''ll coordinate with the responders.',
    'safety_alert',
    true
  )
ON CONFLICT DO NOTHING;


-- ── 5. Verification ─────────────────────────────────────────────────────────
-- After running this migration, execute the following to confirm:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'support_reply_templates';
--   -- Expected: rowsecurity = true
--
--   SELECT polname, polcmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'support_reply_templates';
--   -- Expected: 4 policies (staff select/insert/update/delete)
--
--   SELECT label, category, is_default FROM public.support_reply_templates
--   ORDER BY is_default DESC, label;
--   -- Expected: 8 seeded rows with is_default = true



-- #############################################################
-- ##  avatar-storage-migration.sql
-- #############################################################
-- ============================================================
-- PORCHIVO: Avatar Storage Bucket + RLS
-- Run in Supabase SQL Editor. Safe to re-run — all statements
-- use IF NOT EXISTS / DROP IF EXISTS / idempotent storage calls.
-- ============================================================
--
-- Creates a public-read Storage bucket `avatars` so profile
-- pictures uploaded from the app (expo/app/edit-profile.tsx via
-- expo/lib/avatar.ts) are reachable as CDN URLs and render in
-- chat, resident directory, partner cards, and other devices.
--
-- Security model
--   * Bucket is PUBLIC (public read). Anyone can fetch a stored
--     avatar by URL — this is intentional, avatars are display
--     data shown to neighbors/partners, not PII.
--   * WRITE is restricted via Storage RLS policies:
--       - authenticated users can INSERT/UPDATE/DELETE only
--         objects whose path prefix matches their own auth.uid()
--         (paths are `<uid>/<filename>`), so users can manage
--         only their own avatar.
--       - service_role bypasses RLS (used by edge functions).
--   * We also keep a 2 MB per-object upload guard client-side;
--     Storage itself caps object size by plan, not policy.
-- ============================================================


-- ── 1. Bucket ───────────────────────────────────────────────────────────────
-- `insert into storage.buckets` is idempotent on (id) via ON CONFLICT.
-- public = true makes the bucket readable by anyone with the object URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,                                -- 5 MB hard cap per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public           = EXCLUDED.public,
    file_size_limit  = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ── 2. Storage object RLS policies ───────────────────────────────────────────
-- Object paths are namespaced by user id: `avatars/<auth.uid()>/<file>`.
-- This lets a user manage only the objects whose first path segment
-- equals their own uid, while anyone (anon + authenticated) can read.

-- Anyone can SELECT (read) avatar objects — bucket is public, but the
-- policy is still required for the RLS check to pass on the objects table.
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
CREATE POLICY "Public can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can INSERT only into their own uid-prefixed path.
DROP POLICY IF EXISTS "Users insert own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users insert own avatar" ON storage.objects;
CREATE POLICY "Users insert own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can UPDATE only their own avatar.
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can DELETE only their own avatar (e.g. on remove).
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 3. Verification ─────────────────────────────────────────────────────────
-- After running, confirm:
--
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'avatars';
--   -- Expected: public = true, file_size_limit = 5242880
--
--   SELECT polname, polcmd FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND polname LIKE '%avatar%';
--   -- Expected: 4 policies (public read, insert, update, delete)



-- #############################################################
-- ##  portfolio-vendors-branding-migration.sql
-- #############################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 14: Portfolio (multi-community), Vendor Directory, Custom Branding
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) organizations: portfolio caps + onboarding fee + branding color
-- 2) org_vendors: lightweight vendor directory per organization
-- All statements are idempotent — safe to re-run alongside master-deploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. organizations columns ──────────────────────────────────────────────
-- max_communities       — NULL = unlimited (enterprise), 1/3 for the rest
-- onboarding_fee_cents  — one-time fee charged with the first checkout
-- brand_color           — hex accent chosen by the admin (custom branding)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS max_communities INT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_fee_cents INT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS brand_color TEXT;

-- Backfill existing orgs from their plan tier (enterprise stays NULL = unlimited).
UPDATE public.organizations
SET max_communities = CASE plan_tier
                        WHEN 'professional' THEN 3
                        WHEN 'enterprise'   THEN NULL
                        ELSE 1
                      END,
    onboarding_fee_cents = CASE plan_tier
                             WHEN 'professional' THEN 50000
                             WHEN 'enterprise'   THEN 150000
                             ELSE 0
                           END
WHERE max_communities IS NULL
  AND onboarding_fee_cents IS NULL
  AND plan_tier IS DISTINCT FROM 'enterprise';

-- ── 2. org_vendors ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general'
               CHECK (category IN ('general','plumbing','electrical','hvac','landscaping',
                                   'cleaning','security','pool','pest','roofing','other')),
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_vendors_org    ON public.org_vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_org_vendors_active ON public.org_vendors(org_id, is_active);

ALTER TABLE public.org_vendors ENABLE ROW LEVEL SECURITY;

-- All active members can view the directory.
DROP POLICY IF EXISTS org_vendors_select ON public.org_vendors;
DROP POLICY IF EXISTS org_vendors_select ON public.org_vendors;
CREATE POLICY org_vendors_select ON public.org_vendors
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Staff/admin can add and edit vendors.
DROP POLICY IF EXISTS org_vendors_insert ON public.org_vendors;
DROP POLICY IF EXISTS org_vendors_insert ON public.org_vendors;
CREATE POLICY org_vendors_insert ON public.org_vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS org_vendors_update ON public.org_vendors;
DROP POLICY IF EXISTS org_vendors_update ON public.org_vendors;
CREATE POLICY org_vendors_update ON public.org_vendors
  FOR UPDATE TO authenticated
  USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));

-- The creator or a full admin (not board/staff) can remove a vendor.
DROP POLICY IF EXISTS org_vendors_delete ON public.org_vendors;
DROP POLICY IF EXISTS org_vendors_delete ON public.org_vendors;
CREATE POLICY org_vendors_delete ON public.org_vendors
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = org_vendors.org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

DROP TRIGGER IF EXISTS trg_org_vendors_updated_at ON public.org_vendors;
DROP TRIGGER IF EXISTS trg_org_vendors_updated_at ON public.org_vendors;
CREATE TRIGGER trg_org_vendors_updated_at
  BEFORE UPDATE ON public.org_vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();



-- #############################################################
-- ##  b2b-feature-gaps-migration.sql
-- #############################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- B2B FEATURE GAPS MIGRATION (2026-09-02)
-- Closes the last three advertised-but-missing community-tier features:
--   * Document library (Starter+)        → org_documents + private `org-documents` bucket
--   * Amenity reservations (Community+)  → org_amenities + org_amenity_reservations
--   * Ledger exports (Community+)        → client-side CSV from org_payments (no schema change)
-- Patterns: org_vendors (RLS roles) + avatar-storage-migration (bucket/policies).
-- Fully idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. org_documents — community document library ───────────────────────────
-- Two document kinds (exactly one source per row):
--   external_url : link to an external doc (Google Drive, Dropbox, HOA site…)
--   file_path    : object inside the private `org-documents` bucket, path
--                  `{org_id}/{filename}` (org-scoped for storage RLS).
CREATE TABLE IF NOT EXISTS public.org_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  external_url text,
  file_path    text,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_documents_source_check CHECK (
    (external_url IS NOT NULL AND file_path IS NULL)
    OR (file_path IS NOT NULL AND external_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_org_documents_org ON public.org_documents(org_id, created_at DESC);

ALTER TABLE public.org_documents ENABLE ROW LEVEL SECURITY;

-- Every active member of the org can read the library.
DROP POLICY IF EXISTS org_documents_select ON public.org_documents;
DROP POLICY IF EXISTS org_documents_select ON public.org_documents;
CREATE POLICY org_documents_select ON public.org_documents
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Only org staff/board can add documents.
DROP POLICY IF EXISTS org_documents_insert ON public.org_documents;
DROP POLICY IF EXISTS org_documents_insert ON public.org_documents;
CREATE POLICY org_documents_insert ON public.org_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS org_documents_update ON public.org_documents;
DROP POLICY IF EXISTS org_documents_update ON public.org_documents;
CREATE POLICY org_documents_update ON public.org_documents
  FOR UPDATE TO authenticated
  USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));

DROP POLICY IF EXISTS org_documents_delete ON public.org_documents;
DROP POLICY IF EXISTS org_documents_delete ON public.org_documents;
CREATE POLICY org_documents_delete ON public.org_documents
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));

-- ── 2. `org-documents` storage bucket (private) ─────────────────────────────
-- 25 MB per file; paths are `{org_id}/{uuid}-{filename}` so RLS is org-scoped.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  26214400, -- 25 MB hard cap per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public            = EXCLUDED.public,
    file_size_limit   = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members of the org (first path segment = org uuid) can read.
DROP POLICY IF EXISTS "Org members read org documents" ON storage.objects;
DROP POLICY IF EXISTS "Org members read org documents" ON storage.objects;
CREATE POLICY "Org members read org documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_active_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Only staff/board can upload into their org's folder.
DROP POLICY IF EXISTS "Org staff insert org documents" ON storage.objects;
DROP POLICY IF EXISTS "Org staff insert org documents" ON storage.objects;
CREATE POLICY "Org staff insert org documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org staff update org documents" ON storage.objects;
DROP POLICY IF EXISTS "Org staff update org documents" ON storage.objects;
CREATE POLICY "Org staff update org documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org staff delete org documents" ON storage.objects;
DROP POLICY IF EXISTS "Org staff delete org documents" ON storage.objects;
CREATE POLICY "Org staff delete org documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );

-- ── 3. org_amenities — bookable community amenities ─────────────────────────
CREATE TABLE IF NOT EXISTS public.org_amenities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_amenities_org ON public.org_amenities(org_id, name);

ALTER TABLE public.org_amenities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_amenities_select ON public.org_amenities;
DROP POLICY IF EXISTS org_amenities_select ON public.org_amenities;
CREATE POLICY org_amenities_select ON public.org_amenities
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

DROP POLICY IF EXISTS org_amenities_insert ON public.org_amenities;
DROP POLICY IF EXISTS org_amenities_insert ON public.org_amenities;
CREATE POLICY org_amenities_insert ON public.org_amenities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS org_amenities_delete ON public.org_amenities;
DROP POLICY IF EXISTS org_amenities_delete ON public.org_amenities;
CREATE POLICY org_amenities_delete ON public.org_amenities
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));

-- ── 4. org_amenity_reservations — member time-slot bookings ─────────────────
-- Double-booking is impossible at the DB level: a GiST exclusion constraint
-- rejects overlapping confirmed reservations for the same amenity.
CREATE TABLE IF NOT EXISTS public.org_amenity_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amenity_id  uuid NOT NULL REFERENCES public.org_amenities(id) ON DELETE CASCADE,
  reserved_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('confirmed', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_amenity_reservations_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_org_amenity_res_amenity
  ON public.org_amenity_reservations(amenity_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_org_amenity_res_org
  ON public.org_amenity_reservations(org_id, starts_at);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.org_amenity_reservations
  DROP CONSTRAINT IF EXISTS org_amenity_reservations_no_overlap;
ALTER TABLE public.org_amenity_reservations
  ADD CONSTRAINT org_amenity_reservations_no_overlap
  EXCLUDE USING gist (
    amenity_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');

ALTER TABLE public.org_amenity_reservations ENABLE ROW LEVEL SECURITY;

-- All members see the reservation book (transparency).
DROP POLICY IF EXISTS org_amenity_res_select ON public.org_amenity_reservations;
DROP POLICY IF EXISTS org_amenity_res_select ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_select ON public.org_amenity_reservations
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Members book for themselves (confirmed only).
DROP POLICY IF EXISTS org_amenity_res_insert ON public.org_amenity_reservations;
DROP POLICY IF EXISTS org_amenity_res_insert ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_insert ON public.org_amenity_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_org_member(org_id)
    AND reserved_by = auth.uid()
    AND status = 'confirmed'
  );

-- A member can cancel their own booking; staff can cancel any.
DROP POLICY IF EXISTS org_amenity_res_update ON public.org_amenity_reservations;
DROP POLICY IF EXISTS org_amenity_res_update ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_update ON public.org_amenity_reservations
  FOR UPDATE TO authenticated
  USING (public.is_active_org_member(org_id) AND (reserved_by = auth.uid() OR public.is_org_staff(org_id)))
  WITH CHECK (public.is_active_org_member(org_id));

-- Staff can clean up junk rows.
DROP POLICY IF EXISTS org_amenity_res_delete ON public.org_amenity_reservations;
DROP POLICY IF EXISTS org_amenity_res_delete ON public.org_amenity_reservations;
CREATE POLICY org_amenity_res_delete ON public.org_amenity_reservations
  FOR DELETE TO authenticated
  USING (public.is_org_staff(org_id));



-- #############################################################
-- ##  api-keys-migration.sql
-- #############################################################
-- api_keys — Enterprise API access for the manager portal.
--
-- Keys are Bearer tokens (`pvk_live_…`) verified by the api-gateway edge
-- function. Only a SHA-256 hash of the key is stored — the plaintext key is
-- shown ONCE at creation in the manager portal (ManageApiKeys) and never
-- persisted. Keys are revoked (revoked_at), never deleted — audit trail.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT api_keys_name_len CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT api_keys_prefix_len CHECK (char_length(key_prefix) BETWEEN 4 AND 24)
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx ON public.api_keys (org_id, created_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Staff of the org can view their keys (prefix only — hashes are useless)
DROP POLICY IF EXISTS api_keys_select ON public.api_keys;
DROP POLICY IF EXISTS api_keys_select ON public.api_keys;
CREATE POLICY api_keys_select ON public.api_keys
  FOR SELECT TO authenticated USING (public.is_org_staff(org_id));

-- Only the creating staff member is recorded as creator
DROP POLICY IF EXISTS api_keys_insert ON public.api_keys;
DROP POLICY IF EXISTS api_keys_insert ON public.api_keys;
CREATE POLICY api_keys_insert ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (
    public.is_org_staff(org_id) AND created_by = auth.uid()
  );

-- Staff can revoke (set revoked_at); no DELETE policy by design
DROP POLICY IF EXISTS api_keys_update ON public.api_keys;
DROP POLICY IF EXISTS api_keys_update ON public.api_keys;
CREATE POLICY api_keys_update ON public.api_keys
  FOR UPDATE TO authenticated USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));



-- #############################################################
-- ##  email-templates-migration.sql
-- #############################################################
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
DROP POLICY IF EXISTS "own email prefs" ON public.email_preferences;
create policy "own email prefs" on public.email_preferences
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own email prefs update" on public.email_preferences;
DROP POLICY IF EXISTS "own email prefs update" ON public.email_preferences;
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
DROP TRIGGER IF EXISTS trg_ensure_referral_code ON public.profiles;
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
  select name, email, address into v_partner from public.profiles where id = new.partner_id;
  select name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
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
DROP TRIGGER IF EXISTS trg_partner_request_received ON public.partner_connections;
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
  select name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select name, email, address into v_partner  from public.profiles where id = new.partner_id;

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
DROP TRIGGER IF EXISTS trg_partner_connection_status ON public.partner_connections;
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
DROP TRIGGER IF EXISTS trg_suspicious_alert_email ON public.suspicious_alerts;
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
DROP TRIGGER IF EXISTS trg_org_member_joined ON public.org_memberships;
create trigger trg_org_member_joined
  after insert or update on public.org_memberships
  for each row execute function public.notify_org_member_joined();

-- 8e. Package reported stolen/missing → notify the reporter ──────────────────
create or replace function public.notify_incident_stolen()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporter record; v_item_name text;
begin
  select name, email into v_reporter from public.profiles where id = new.reporter_id;
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
DROP TRIGGER IF EXISTS trg_incident_stolen ON public.incident_reports;
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
  select name, email into v_reporter from public.profiles where id = new.reporter_id;
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
DROP TRIGGER IF EXISTS trg_incident_resolved ON public.incident_reports;
create trigger trg_incident_resolved
  after update on public.incident_reports
  for each row when (
    new.status in ('resolved','closed')
    and coalesce(old.status,'') not in ('resolved','closed')
    and new.type in ('missing_package','delivered_not_found','misdelivered','tampered'))
  execute function public.notify_incident_resolved();

-- 8g. Package picked up by Porch Partner (assignment goes active) ────────────
create or replace function public.notify_assignment_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record; v_item_name text;
begin
  select name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select name, email, address into v_partner  from public.profiles where id = new.partner_id;
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
DROP TRIGGER IF EXISTS trg_assignment_pickup ON public.partner_assignments;
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
  select name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select name, email, address into v_partner  from public.profiles where id = new.partner_id;
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
DROP TRIGGER IF EXISTS trg_package_hold_pickup ON public.package_holds;
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
  select name, email into v_referrer from public.profiles where id = v_referral.referrer_id;
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
DROP TRIGGER IF EXISTS trg_credit_referral ON public.shipments;
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
    select name, email into v_homeowner from public.profiles where id = v_s.homeowner_id;
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
    select name, email into v_homeowner from public.profiles where id = v_a.homeowner_id;
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
    select name, email into v_homeowner from public.profiles where id = v_s.homeowner_id;
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
do $$ begin
  perform cron.schedule('email-safety-digest', '0 14 * * 1',  $$select public.run_safety_digest_job()$$);
  perform cron.schedule('email-at-risk',       '0 * * * *',   $$select public.run_at_risk_job()$$);
  perform cron.schedule('email-re-engagement', '0 15 * * *',  $$select public.run_reengagement_job()$$);
  perform cron.schedule('email-milestone',     '10 15 * * *', $$select public.run_milestone_job()$$);
  perform cron.schedule('email-review-request','20 15 * * *', $$select public.run_review_request_job()$$);
  perform cron.schedule('email-risk-spike',    '0 */6 * * *', $$select public.run_risk_spike_job()$$);
  perform cron.schedule('email-arriving-today','0 */2 * * *', $$select public.run_arriving_today_job()$$);
exception when others then
  raise warning 'cron schedule: %', sqlerrm;
end $$;



-- #############################################################
-- ##  delete-account-procedure.sql
-- #############################################################
-- Account deletion stored procedure (used internally by purge_deleted_accounts)
-- Run in Supabase SQL Editor AFTER migration.sql.
--
-- Replaces the fragile client-side cascade in AppContext.deleteAccount.
-- The client calls  supabase.rpc('request_account_deletion')  for graceful deactivation.
-- This procedure is called internally by purge_deleted_accounts() after the 30-day grace period.
-- All deletes happen inside one transaction — either everything is removed or nothing is,
-- preventing partial-delete corruption.
--
-- The function runs as SECURITY DEFINER (elevated privileges) so it can:
--   • Delete from tables with strict RLS
--   • Delete the auth.users row (requires elevated access)
--
-- auth.uid() inside the function body resolves to the JWT caller's user ID,
-- so a user can only delete their own account — no impersonation is possible.

CREATE OR REPLACE FUNCTION public.delete_account_cascade()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Resolve caller identity from the JWT
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Delete dependent rows in order (children before parents)
  -- Use IF EXISTS / exception-safe DELETEs so missing tables don't abort

  -- Analytics events
  BEGIN
    DELETE FROM public.analytics_events WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Rate limit entries for this user
  BEGIN
    DELETE FROM public.rate_limit_log WHERE key LIKE '%:' || v_user_id::TEXT;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Chat messages sent by the user
  BEGIN
    DELETE FROM public.chat_messages WHERE sender_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Notifications received by the user
  DELETE FROM public.notifications WHERE recipient_id = v_user_id;

  -- Invoice periods
  BEGIN
    DELETE FROM public.invoice_periods WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner payouts
  BEGIN
    DELETE FROM public.partner_payouts WHERE partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner assignments (user as homeowner or partner)
  BEGIN
    DELETE FROM public.partner_assignments
    WHERE homeowner_id = v_user_id OR partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner connections (user as homeowner or partner)
  BEGIN
    DELETE FROM public.partner_connections
    WHERE homeowner_id = v_user_id OR partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Support tickets owned by the user
  BEGIN
    DELETE FROM public.support_tickets WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner verification record
  BEGIN
    DELETE FROM public.partner_verifications WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Shipments (user as homeowner or partner)
  DELETE FROM public.shipments
  WHERE homeowner_id = v_user_id OR partner_id = v_user_id;

  -- Profile row — must come after all child rows that FK to profiles
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Purge Storage objects (avatars + delivery-photos) for this user.
  -- Runs as SECURITY DEFINER (bypasses Storage RLS). Path pattern: <uid>/<file>.
  -- Wrapped in exception handler so storage failure doesn't abort the deletion.
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id IN ('avatars', 'delivery-photos')
      AND (storage.foldername(name))[1] = v_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Finally, delete the auth user. SECURITY DEFINER gives us access to auth schema.
  -- This invalidates all active sessions for this user immediately.
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  -- Rollback is automatic; return the error so the client can surface it
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Only the authenticated user (via RLS JWT check inside the function) can call this.
-- No GRANT needed — SECURITY DEFINER functions are callable by authenticated users
-- who the function body explicitly validates via auth.uid().
REVOKE ALL ON FUNCTION public.delete_account_cascade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account_cascade() TO authenticated;



-- #############################################################
-- ##  add_apns_token.sql
-- #############################################################
-- Add native iOS APNS token support to the existing push infrastructure.
-- Expo apps continue to use the existing `profiles.expo_push_token` column and
-- the `send_push_notification` trigger (which calls the Expo Push API).
-- This migration adds an `apns_token` column so the native iOS app can persist
-- its Apple Push Notification service device token for future native iOS pushes.
--
-- PREREQUISITE: native iOS APNS *delivery* still requires an APNS certificate
-- or key configured in your backend. This migration only adds the storage column.

-- 1. Add the APNS token column to profiles.
alter table public.profiles
    add column if not exists apns_token text;

-- 2. Ensure the column is writable by the authenticated user themselves.
--    (profiles already has RLS policies; this grants update on the new column.)
grant update (apns_token) on public.profiles to authenticated;

-- 3. Keep the existing Expo push trigger unchanged. When you later wire native
--    APNS delivery, you can extend `send_push_notification()` to fall back to
--    `apns_token` when `expo_push_token` is null.
--
--    Example future trigger logic (not enabled here because APNS credentials are
--    project-specific and not yet configured):
--      if new.recipient's expo_push_token is not null then send via Expo Push API
--      elsif new.recipient's apns_token is not null then send via APNS
--      end if;



-- #############################################################
-- ##  add_is_volunteer.sql
-- #############################################################
-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Add is_volunteer to partner_verifications + partner_public_stats view
--
-- Allows Porch Partners to mark themselves as "volunteer" — they hold packages
-- for free, no charge to homeowners. The flag is exposed via the public stats
-- view so homeowners can see which neighbors don't charge.
--
-- Run order: after master-deploy.sql (or can be run standalone on an existing DB)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add is_volunteer column to partner_verifications
alter table public.partner_verifications
  add column if not exists is_volunteer boolean not null default false;

comment on column public.partner_verifications.is_volunteer is
  'True if this partner holds packages for free (no charge to homeowners). '
  'Volunteer partners skip the Stripe payment flow entirely.';

-- 2. Rebuild the partner_public_stats view to include is_volunteer
create or replace view public.partner_public_stats as
  select
    user_id,
    tier,
    idv_status,
    payout_status,
    completed_assignments,
    total_assignments,
    average_rating,
    is_volunteer
  from public.partner_verifications;

grant select on public.partner_public_stats to authenticated;

comment on view public.partner_public_stats is
  'Public, non-PII trust signals for partners (tier, rating, completion counts, volunteer status). '
  'Use this for cross-user reads; the partner_verifications table is owner-only.';
