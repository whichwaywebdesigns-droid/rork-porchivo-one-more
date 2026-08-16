# Stripe Setup Guide — Porchivo B2B Community Subscriptions

This guide covers the B2B community subscription flow (HOA board members / property managers signing up and paying via Stripe Checkout) and the Porch Partner verification + payout system.

---

## Overview

Porchivo uses Stripe for two separate payment flows:

1. **B2B Community Subscriptions** — HOAs and property managers subscribe to a community plan ($79–$599/mo). Residents never pay. Billing is via Stripe Checkout (subscription mode) with webhook-validated activation.
2. **Porch Partner Payouts** — Verified neighbors earn $3–$25 per package hold. Payouts via Stripe Connect (Express accounts). Identity verification via Stripe Identity.

There are **no in-app purchases** anywhere in the app. Residents are always free.

---

## B2B Community Plans

### Current Pricing

| Plan | Monthly | Annual (20% off) | Max Units | Setup Fee |
|------|---------|-------------------|-----------|-----------|
| Starter | $79 | $756/yr ($63/mo) | 50 | — |
| Community | $199 | $1,908/yr ($159/mo) | 200 | — |
| Professional | $399 | $3,828/yr ($319/mo) | 500 | $500 |
| Enterprise | $599 | $5,748/yr ($479/mo) | 2,000 | $1,500 |

- **Overage**: $1.00 per additional unit per month above the tier limit
- **Residents**: Always free — they join via invite code, no payment required
- Communities larger than 2,000 units: contact support@porchivo.com for custom quote

### B2B Flow (3-step signup in the app)

1. **Org details**: HOA board member / property manager enters community name, type, address, and total units
2. **Plan selection**: Choose Starter / Community / Professional / Enterprise + monthly or annual billing
3. **Stripe Checkout**: In-app browser opens Stripe Checkout → payment → redirect back to app → webhook validation → org activated → invite code generated

### Edge Functions (B2B)

```bash
supabase functions deploy create-org-checkout
supabase functions deploy confirm-org-signup
supabase functions deploy create-billing-portal
```

All three functions:
- Validate JWT via `userClient.auth.getUser()` — reject unauthenticated requests
- Deploy with default `verify_jwt = true` (do NOT pass `--no-verify-jwt`)
- Are rate-limited via `_shared/rateLimit.ts`

### Stripe Secrets

```bash
# Your Stripe platform SECRET key (sk_live_... or sk_test_...)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
```

Supabase auto-injects: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### How it works

1. `create-org-checkout` creates the org with `subscription_status = 'pending'`, creates a Stripe Customer, then creates a Stripe Checkout Session (subscription mode) with inline `price_data` — no pre-created Stripe products needed.
2. User completes payment in the Stripe Checkout in-app browser.
3. Stripe redirects back to `porchivo://org-signup/success?session_id={CHECKOUT_SESSION_ID}&org_id={orgId}`
4. `confirm-org-signup` retrieves the session, checks `payment_status === 'paid'`, activates the org, and creates the admin membership (`hoa_admin`, `active`).
5. `create-billing-portal` generates a Stripe Billing Portal URL for plan management, cancellation, and invoice history.

---

## Porch Partner Verification & Payouts

### Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Stripe account with a platform (not connected account) key
- Supabase project linked: `supabase link --project-ref <YOUR_PROJECT_REF>`

### 1. Apply the Database Migration

Run this **after** `migration.sql` in your Supabase SQL Editor:

```
supabase/partner-verification-migration.sql
```

Or via CLI:
```bash
supabase db push
```

### 2. Deploy Edge Functions (Partner flow)

```bash
supabase functions deploy initiate-verification
supabase functions deploy verification-webhook
supabase functions deploy create-connect-account
supabase functions deploy create-assignment
supabase functions deploy partner-payout
```

### 3. Set Required Secrets

```bash
# Stripe platform SECRET key
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx

# Identity webhook secret (see section 5 below)
supabase secrets set STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Connect webhook secret (see section 6 below)
supabase secrets set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

### 4. Register the Identity Webhook

In [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks):

1. Click **Add endpoint**
2. **Endpoint URL:**
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/verification-webhook
   ```
3. **Events to listen for:**
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.cancelled`
4. After saving, copy the **Signing secret** (`whsec_...`) and run:
   ```bash
   supabase secrets set STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_xxxxxx
   ```

### 5. Register the Connect Webhook

Create a **second** webhook endpoint:

1. **Endpoint URL:**
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/verification-webhook
   ```
2. **Events to listen for:**
   - `account.updated` — fires when Stripe finishes reviewing a Connect account
   - `transfer.paid` — fires when a payout lands in the partner's bank
3. Copy the signing secret and run:
   ```bash
   supabase secrets set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxx
   ```

### 6. Enable Stripe Identity

1. Go to [Stripe Dashboard → Identity](https://dashboard.stripe.com/identity)
2. Enable **Identity Verification**
3. Set **Return URL** allowed pattern: `porchivo://partner-verify/*`

### 7. Enable Stripe Connect

1. Go to [Stripe Dashboard → Connect](https://dashboard.stripe.com/connect/accounts/overview)
2. Click **Get started with Connect**
3. Choose **Express accounts** for fastest partner onboarding
4. In **Settings → Connect settings**, set the redirect URI:
   ```
   porchivo://partner-verify/connect-return
   ```

### 8. Partner Flow Summary

```
Partner flow:
  1. /partner-verify  → initiateVerification() → Stripe Identity → verification-webhook updates DB
  2. /partner-verify  → handleStartConnect()   → Stripe Express → account.updated webhook (optional)
  3. /partner-holds   → acceptAssignment()     → DB update
  4. /partner-holds   → confirmPickup()        → DB update (status: active)

Homeowner flow:
  1. /create-assignment → createAssignment()  → create-assignment edge fn → PaymentIntent authorized
  2. /partner-earnings  → completeAssignment() → DB update (status: completed)
  3. /partner-earnings  → triggerPayout()      → partner-payout edge fn → Stripe Transfer → DB payout record
```

---

## Environment Variables Reference

| Secret | Where to get it |
|--------|----------------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Identity endpoint signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Connect endpoint signing secret |

---

## Useful Links

- [Stripe Identity Docs](https://stripe.com/docs/identity)
- [Stripe Connect Express Docs](https://stripe.com/docs/connect/express-accounts)
- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Billing Portal Docs](https://stripe.com/docs/billing/subscriptions/customer-portal)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
