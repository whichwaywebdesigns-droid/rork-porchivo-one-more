-- ============================================================
-- Org billing currency (MXN launch)
-- Records the currency an organization's B2B subscription is
-- billed in. 'usd' everywhere today; 'mxn' for the Mexico-market
-- push (Starter + Professional, fixed MXN prices, IVA incluido,
-- reviewed quarterly). Backfill: every existing org is USD.
-- ============================================================

alter table public.organizations
  add column if not exists billing_currency text not null default 'usd'
  check (billing_currency in ('usd', 'mxn'));

comment on column public.organizations.billing_currency is
  'Currency the B2B subscription is billed in. mxn = fixed MXN prices (Starter/Professional, IVA incluido); reviewed quarterly.';
