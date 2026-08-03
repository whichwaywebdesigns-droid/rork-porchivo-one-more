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
create policy "amazon_orders_select_own"
  on public.amazon_orders
  for select
  using (auth.uid() = user_id);

-- Users can insert their own orders
create policy "amazon_orders_insert_own"
  on public.amazon_orders
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own orders (e.g. mark delivered)
create policy "amazon_orders_update_own"
  on public.amazon_orders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own orders
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
