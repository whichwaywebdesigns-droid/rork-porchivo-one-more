-- One-time drift reconciliation for the live production DB (2026-08-22).
-- Reconciles old communities-era table shapes so the repo migrations can
-- complete: amazon_orders.user_id, revenuecat_events.user_id,
-- invoice_periods role/period columns, and the diverged partner_public_stats
-- view (CREATE OR REPLACE cannot drop columns).
-- Idempotent — safe to re-run.

-- amazon_orders: repo/app expect user_id; live has homeowner_id (same meaning)
alter table public.amazon_orders
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.amazon_orders o
   set user_id = o.homeowner_id
 where o.user_id is null
   and o.homeowner_id is not null
   and exists (select 1 from auth.users u where u.id = o.homeowner_id);

-- revenuecat_events: repo expects user_id; live has app_user_id (same meaning)
alter table public.revenuecat_events
  add column if not exists user_id text;

update public.revenuecat_events
   set user_id = app_user_id
 where user_id is null and app_user_id is not null;

-- invoice_periods: repo expects role/period_key/period_start/period_end/
-- platform_fee_total_cents/notification_sent_at; live lacks them
alter table public.invoice_periods
  add column if not exists role text default 'homeowner',
  add column if not exists period_key text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists platform_fee_total_cents integer default 0,
  add column if not exists notification_sent_at timestamptz;

update public.invoice_periods
   set period_key = period_label
 where period_key is null and period_label is not null;

-- partner_public_stats: repo's narrower view cannot REPLACE the wider live one
drop view if exists public.partner_public_stats;
