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
create policy "Users stitch own identity"
  on public.experiment_identity for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own identity" on public.experiment_identity;
create policy "Users update own identity"
  on public.experiment_identity for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own identity" on public.experiment_identity;
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
