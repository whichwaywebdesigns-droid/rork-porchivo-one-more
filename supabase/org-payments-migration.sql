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
create trigger trg_org_payments_updated_at
  before update on public.org_payments
  for each row execute function public.set_org_payments_updated_at();
