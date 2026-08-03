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
create policy "Homeowner can manage own holds"
  on public.package_holds for all
  using (auth.uid() = homeowner_id)
  with check (auth.uid() = homeowner_id);

-- Partner can view holds assigned to them
create policy "Partner can view assigned holds"
  on public.package_holds for select
  using (auth.uid() = partner_id);

-- Partner can update status on their holds (picked_up / returned)
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
create policy "Authenticated can view alerts"
  on public.suspicious_alerts for select
  using (auth.role() = 'authenticated');

-- Users can submit alerts
create policy "Users can insert own alerts"
  on public.suspicious_alerts for insert
  with check (auth.uid() = user_id);

-- Alert owner can update their own alert (e.g. resolve)
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
