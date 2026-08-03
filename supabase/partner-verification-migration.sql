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

create policy "Users view own verification"
  on public.partner_verifications for select
  using (auth.uid() = user_id);

create policy "Users insert own verification"
  on public.partner_verifications for insert
  with check (auth.uid() = user_id);

create policy "Users update own verification"
  on public.partner_verifications for update
  using (auth.uid() = user_id);

-- Homeowners need to see partner tier when deciding whom to trust
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

create policy "Homeowners view own connections"
  on public.partner_connections for select
  using (auth.uid() = homeowner_id);

create policy "Partners view their connections"
  on public.partner_connections for select
  using (auth.uid() = partner_id);

create policy "Homeowners manage connections"
  on public.partner_connections for all
  using (auth.uid() = homeowner_id)
  with check (auth.uid() = homeowner_id);

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

create policy "Homeowners view own assignments"
  on public.partner_assignments for select
  using (auth.uid() = homeowner_id);

create policy "Partners view their assignments"
  on public.partner_assignments for select
  using (auth.uid() = partner_id);

create policy "Homeowners create assignments"
  on public.partner_assignments for insert
  with check (auth.uid() = homeowner_id);

create policy "Homeowners update own assignments"
  on public.partner_assignments for update
  using (auth.uid() = homeowner_id);

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

create policy "Partners view own payouts"
  on public.partner_payouts for select
  using (auth.uid() = partner_id);

-- Service role (edge functions) can insert/update payouts
create policy "Service role manage payouts"
  on public.partner_payouts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────

-- 5. updated_at TRIGGERS (reuse the existing update_updated_at function)
create trigger partner_verifications_updated_at
  before update on public.partner_verifications
  for each row execute function public.update_updated_at();

create trigger partner_connections_updated_at
  before update on public.partner_connections
  for each row execute function public.update_updated_at();

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
