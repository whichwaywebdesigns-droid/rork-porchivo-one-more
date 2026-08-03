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
