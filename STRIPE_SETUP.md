# Stripe Setup Guide — Porchivo Partner Verification & Payouts

This guide walks through deploying all four edge functions and configuring the required Stripe secrets in your Supabase project.

---

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Stripe account with a platform (not connected account) key
- Supabase project linked: `supabase link --project-ref <YOUR_PROJECT_REF>`

---

## 1. Apply the Database Migration

Run this **after** `migration.sql` in your Supabase SQL Editor:

```
supabase/partner-verification-migration.sql
```

Or via CLI:
```bash
supabase db push
```

---

## 2. Deploy All Five Edge Functions

```bash
supabase functions deploy initiate-verification
supabase functions deploy verification-webhook
supabase functions deploy create-connect-account
supabase functions deploy create-assignment
supabase functions deploy partner-payout
```

---

## 3. Set Required Secrets

### Stripe Keys

Get these from your [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys).

```bash
# Your Stripe platform SECRET key (sk_live_... or sk_test_...)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx

# Identity webhook secret (see section 4 below)
supabase secrets set STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Connect webhook secret (see section 5 below)
supabase secrets set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

### Supabase auto-injects these (no manual action needed):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. Register the Identity Webhook

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

---

## 5. Register the Connect Webhook (for payout status updates)

Create a **second** webhook endpoint:

1. **Endpoint URL:**
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/verification-webhook
   ```
   *(You can reuse the same function or create a dedicated `connect-webhook` function)*
2. **Events to listen for:**
   - `account.updated` — fires when Stripe finishes reviewing a Connect account
   - `transfer.paid` — fires when a payout lands in the partner's bank
3. Copy the signing secret and run:
   ```bash
   supabase secrets set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxx
   ```

---

## 6. Enable Stripe Identity in Dashboard

1. Go to [Stripe Dashboard → Identity](https://dashboard.stripe.com/identity)
2. Enable **Identity Verification**
3. Set **Return URL** allowed pattern: `porchivo://partner-verify/*`

---

## 7. Enable Stripe Connect

1. Go to [Stripe Dashboard → Connect](https://dashboard.stripe.com/connect/accounts/overview)
2. Click **Get started with Connect**
3. Choose **Express accounts** for fastest partner onboarding
4. In **Settings → Connect settings**, set the redirect URI:
   ```
   porchivo://partner-verify/connect-return
   ```

---

## 8. Verify Deployment

Test each function with curl (replace tokens as needed):

```bash
# Initiate identity verification
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/initiate-verification \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"returnUrl":"porchivo://partner-verify/callback"}'

# Create Stripe Connect account
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/create-connect-account \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Create assignment (homeowner)
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/create-assignment \
  -H "Authorization: Bearer <HOMEOWNER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"<UUID>","partnerId":"<UUID>","agreedRateCents":1000}'

# Trigger payout (homeowner after completion)
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/partner-payout \
  -H "Authorization: Bearer <HOMEOWNER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"assignmentId":"<UUID>"}'
```

---

## 9. Full Flow Summary

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
- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)

---

## Subscription Products (mirrors RevenueCat / App Store pricing)

These Stripe products mirror the in-app pricing defined in `expo/config/app.ts`
1:1. Each price's `lookup_key` matches the RevenueCat product ID exactly, so a
single identifier maps a plan across Stripe, RevenueCat, App Store Connect, and
Google Play.

> ⚠️  **Scope:** mobile subscriptions bill through RevenueCat + App Store /
> Play Store (Apple requires this for in-app digital goods). These Stripe
> products are for **web-based subscriptions and future invoicing only**.
> Keep prices in sync in all three places when anything changes.

Run in **test mode first** (default with your `sk_test_` key), then re-run
against live mode.

### 1. Create the 3 products

```bash
stripe products create --name "Porchivo Premium" \
  --description "Individual premium: unlimited packages, Theft Shield, 90s refresh" \
  -d "metadata[tier]=premium"

stripe products create --name "Porchivo Family" \
  --description "Household plan for up to 5 members" \
  -d "metadata[tier]=family"

stripe products create --name "Porchivo Enterprise / HOA" \
  --description "Community plan covering up to 250 households" \
  -d "metadata[tier]=enterprise"
```

Each command returns a `prod_...` ID — substitute them below.

### 2. Create the prices (lookup keys = RevenueCat product IDs)

**Premium** (`prod_PREMIUM`):

```bash
# Monthly — $13.99/mo, no trial (hard paywall strategy)
stripe prices create \
  --product prod_PREMIUM \
  --currency usd \
  --unit-amount 1399 \
  -d "recurring[interval]=month" \
  --lookup-key premium_monthly

# Annual — $99.99/yr (7-day trial, featured plan)
stripe prices create \
  --product prod_PREMIUM \
  --currency usd \
  --unit-amount 9999 \
  -d "recurring[interval]=year" \
  --lookup-key premium_annual

# Lifetime — $500 one-time (hidden from main paywall)
stripe prices create \
  --product prod_PREMIUM \
  --currency usd \
  --unit-amount 50000 \
  --lookup-key porchivo_lifetime
```

**Family** (`prod_FAMILY`):

```bash
# Monthly — $23.99/mo, no trial
stripe prices create \
  --product prod_FAMILY \
  --currency usd \
  --unit-amount 2399 \
  -d "recurring[interval]=month" \
  --lookup-key com.porchivo.premium.family

# Annual — $179.99/yr (7-day trial)
stripe prices create \
  --product prod_FAMILY \
  --currency usd \
  --unit-amount 17999 \
  -d "recurring[interval]=year" \
  --lookup-key family_annual
```

**Enterprise / HOA** (`prod_ENTERPRISE`):

```bash
# Monthly — $250/mo
stripe prices create \
  --product prod_ENTERPRISE \
  --currency usd \
  --unit-amount 25000 \
  -d "recurring[interval]=month" \
  --lookup-key enterprise_monthly

# Annual — $2,000/yr (14-day trial)
stripe prices create \
  --product prod_ENTERPRISE \
  --currency usd \
  --unit-amount 200000 \
  -d "recurring[interval]=year" \
  --lookup-key enterprise_annual
```

### 3. Trials

Stripe trials are set at checkout/subscription time, not on the price object.
When creating a Checkout Session or Subscription, pass:

```bash
# premium_annual & family_annual → 7-day trial
-d "subscription_data[trial_period_days]=7"

# enterprise_annual → 14-day trial
-d "subscription_data[trial_period_days]=14"
```

Monthly plans get **no trial** (hard paywall strategy — trials on monthly
train users to expect free; push them to annual instead).

### 4. Win-back promo

The $7.99/mo × 3 months win-back offer is configured in the **RevenueCat
dashboard** (display-only in the app). For a Stripe equivalent, use a coupon:

```bash
stripe coupons create \
  --name "Win-back 40% off" \
  --percent-off 43 \
  --duration repeating \
  --duration-in-months 3
```

### 5. Pricing reference table

| Plan | Interval | Price | Lookup key | Trial |
|------|----------|-------|------------|-------|
| Premium | Monthly | $13.99 | `premium_monthly` | — |
| Premium | Annual | $99.99 | `premium_annual` | 7 days |
| Premium | One-time | $500 | `porchivo_lifetime` | — |
| Family (5 members) | Monthly | $23.99 | `com.porchivo.premium.family` | — |
| Family (5 members) | Annual | $179.99 | `family_annual` | 7 days |
| Enterprise / HOA (250 homes) | Monthly | $250 | `enterprise_monthly` | — |
| Enterprise / HOA (250 homes) | Annual | $2,000 | `enterprise_annual` | 14 days |

> Source of truth for display pricing: `expo/config/app.ts` (`PRICING`,
> `FAMILY_PLAN`, `ENTERPRISE_PLAN`). If prices change there, update Stripe,
> RevenueCat, App Store Connect, and Google Play to match.

---

## Subscription Webhooks (`customer.subscription.*`)

Register a **third** webhook endpoint dedicated to subscription lifecycle
events so the backend stays in sync with web-based Stripe subscriptions.

> ⚠️  **Scope reminder:** these events only fire for subscriptions billed
> through **Stripe** (web checkout / invoicing). Mobile subscription state
> comes from **RevenueCat webhooks**, not Stripe. Never let a Stripe event
> downgrade a user who is entitled via RevenueCat — always merge entitlements
> from both sources.

### 1. Register the endpoint

In [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks):

1. Click **Add endpoint**
2. **Endpoint URL:**
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/subscription-webhook
   ```
   *(Create a dedicated `subscription-webhook` edge function — keep it separate
   from `verification-webhook` so signing secrets and concerns don't mix.)*
3. **Events to listen for:**
   - `customer.subscription.created` — new subscription started (or trial began)
   - `customer.subscription.updated` — plan change, renewal, trial → active,
     cancel-at-period-end toggled, past_due, etc.
   - `customer.subscription.deleted` — subscription fully canceled → revoke access
   - `customer.subscription.trial_will_end` — fires **3 days before** trial ends
     (good hook for a "trial ending" push/email)
   - `customer.subscription.paused` / `customer.subscription.resumed` — only if
     you enable pause collection
4. Copy the **Signing secret** and set it:
   ```bash
   supabase secrets set STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxxxxx
   ```

Or via CLI:

```bash
stripe webhook_endpoints create \
  --url "https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/subscription-webhook" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=customer.subscription.trial_will_end"
```

### 2. Handler logic per event

| Event | What to do |
|-------|-----------|
| `customer.subscription.created` | Look up the user by `customer` ID (or `metadata[user_id]` you set at checkout), read the price's `lookup_key` (e.g. `premium_annual`), grant the matching tier. Status `trialing` counts as entitled. |
| `customer.subscription.updated` | Re-read `status` + `items.data[0].price.lookup_key` and upsert the user's tier. Handle `cancel_at_period_end=true` by keeping access until `current_period_end` (do NOT revoke early). `past_due` → grace period, `unpaid` → revoke. |
| `customer.subscription.deleted` | Revoke the Stripe-granted tier (but re-check RevenueCat entitlement before downgrading the account overall). |
| `customer.subscription.trial_will_end` | Send the "your trial ends in 3 days" notification — pairs with the day-7 paywall strategy. |

### 3. Handler requirements (non-negotiable)

- **Verify the signature** with `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` using
  `stripe.webhooks.constructEventAsync()` — reject anything unsigned.
- **Return 200 fast** — do the minimum DB write, never call slow third parties
  inline. Stripe retries non-2xx responses for up to 3 days.
- **Be idempotent** — Stripe can deliver the same event twice. Store processed
  `event.id`s (or upsert by `subscription.id`) so replays are harmless.
- **Don't trust event ordering** — `updated` can arrive before `created`.
  Always write the *latest* state from the event payload rather than applying
  deltas; when in doubt, fetch the subscription fresh from the API.
- **Map by `lookup_key`, never by `price_...` ID** — lookup keys are stable
  across test/live mode and match your RevenueCat product IDs (see the pricing
  reference table above).

### 4. Local testing

```bash
# Forward events to the deployed function
stripe listen --forward-to \
  https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/subscription-webhook

# Fire test events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger customer.subscription.trial_will_end
```

### 5. Secret reference (updated)

| Secret | Where to get it |
|--------|----------------|
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → subscription endpoint signing secret |
