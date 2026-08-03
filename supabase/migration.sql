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

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

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

create policy "Homeowners view own shipments"
  on public.shipments for select
  using (auth.uid() = homeowner_id);

create policy "Partners view assigned shipments"
  on public.shipments for select
  using (auth.uid() = partner_id);

create policy "Authenticated view open shipments"
  on public.shipments for select
  using (auth.role() = 'authenticated' and status = 'open');

create policy "Homeowners insert shipments"
  on public.shipments for insert
  with check (auth.uid() = homeowner_id);

create policy "Homeowners update own shipments"
  on public.shipments for update
  using (auth.uid() = homeowner_id);

create policy "Partners update assigned shipments"
  on public.shipments for update
  using (auth.uid() = partner_id);

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

create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = recipient_id);

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

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger shipments_updated_at
  before update on public.shipments
  for each row execute function public.update_updated_at();

-- 6. INDEXES
create index if not exists idx_shipments_homeowner on public.shipments(homeowner_id);
create index if not exists idx_shipments_partner on public.shipments(partner_id);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_notifications_recipient on public.notifications(recipient_id);
create index if not exists idx_notifications_shipment on public.notifications(shipment_id);
