-- ═══════════════════════════════════════════════════════════════════════════
-- Onboarding fee → own payment-mode Checkout session with MSI (2026-09-12)
-- ═══════════════════════════════════════════════════════════════════════════
-- Stripe only offers Mexico installments (meses sin intereses) in payment
-- mode: "Installments only works with payment mode, not setup or
-- subscription mode" (docs.stripe.com/payments/meses-sin-intereses). The
-- one-time onboarding fee therefore moves OFF the subscription-mode session
-- onto its own payment-mode session with
-- payment_method_options[card][installments][enabled]=true — the product-level
-- MSI control the Dashboard's amount-only gating cannot express.
-- USD checkouts keep the mixed session (fee rides the subscription invoice;
-- MSI is MXN-only anyway).
--
-- Tracks the fee session on the organization row so payment state survives
-- app restarts and can be confirmed by confirm-org-signup / stripe-webhook.

alter table public.organizations
  add column if not exists onboarding_payment_status text not null default 'not_required',
  add column if not exists onboarding_checkout_session_id text,
  add column if not exists onboarding_checkout_url text;

alter table public.organizations
  drop constraint if exists organizations_onboarding_payment_status_check;
alter table public.organizations
  add constraint organizations_onboarding_payment_status_check
  check (onboarding_payment_status in ('not_required', 'pending', 'paid'));

comment on column public.organizations.onboarding_payment_status is
  'One-time onboarding fee state: not_required = no fee or USD (fee rides the subscription invoice); pending = MXN fee Checkout session created (payment mode, MSI-enabled); paid = fee session completed (confirm-org-signup or stripe-webhook)';
