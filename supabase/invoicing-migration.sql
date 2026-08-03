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
create policy "Homeowner views own invoices"
  on public.transaction_invoices for select
  using (auth.uid() = homeowner_id);

-- Partner can see their invoices
create policy "Partner views own invoices"
  on public.transaction_invoices for select
  using (auth.uid() = partner_id);

-- Service role can insert/update
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

create policy "Users view own periods"
  on public.invoice_periods for select
  using (auth.uid() = user_id);

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
