# Porchivo — Founder Maintenance Guide

> **Who this is for:** You. A non-developer founder who needs to fix things,
> respond to user feedback, and keep the app healthy without hiring someone
> for every small change.
>
> **Philosophy:** 90% of maintenance tasks only require editing ONE file.
> This guide tells you which file, what to change, and what to expect.

---

## The Three Files You'll Touch Most

| File | What it controls |
|------|-----------------|
| `config/app.ts` | Pricing, limits, trial length, risk score thresholds, support email |
| `config/features.ts` | Turn features on/off with true/false |
| `config/copy.ts` | All text users see — headlines, buttons, error messages |

> **Rule of thumb:** Before digging into any screen file, check if what you
> want to change is already in one of these three files. It usually is.

---

## Common Tasks

### ✏️ Change the subscription price

1. Open `config/app.ts`
2. Find `SECTION 1 — PRICING & SUBSCRIPTIONS`
3. Change the `displayPrice` string to the new price (e.g. `'$6.99'`)
4. **Also update the actual price in App Store Connect:**
   - Log in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Go to My Apps → Porchivo → In-App Purchases
   - Find the matching product and update the price there
5. Save. The paywall screen will automatically show the new price.

> ⚠️ The price in this file is a **display label only**.
> If you change it here but not in App Store Connect, users will see the
> wrong price before purchasing. Always update both.

---

### ✏️ Change the free trial length

1. Open `config/app.ts`
2. Find `trialDays:` under `monthly:` or `annual:`
3. Change the number (e.g. `14` for a 2-week trial, `0` to remove the trial)
4. You also need to update this in RevenueCat:
   - Log in at [app.revenuecat.com](https://app.revenuecat.com)
   - Go to your Porchivo project → Products
   - Update the trial period on the matching product

---

### ✏️ Change how many packages free users can track

1. Open `config/app.ts`
2. Find `SECTION 2 — FREE TIER LIMITS`
3. Change `maxPackages:` to the new number
4. Save. The limit is enforced automatically everywhere in the app.

---

### ✏️ Change any text a user sees

1. Open `config/copy.ts`
2. Find the section that matches the screen (e.g. `paywall:`, `home:`, `auth:`)
3. Edit the string
4. Save

**Examples:**
- Change the paywall headline → edit `copy.paywall.headline`
- Change the "Add a package" empty state → edit `copy.home.emptyPackagesBody`
- Change an error message → edit `copy.states.genericErrorBody`

---

### 🔀 Turn a feature on or off

1. Open `config/features.ts`
2. Find the feature name (every feature has a comment explaining what it does)
3. Change `true` to `false` (to hide/disable) or `false` to `true` (to enable)
4. Save

**Examples:**
- Hide the neighborhood map during beta → set `neighborhoodMap: false`
- Disable the day-7 hard paywall during a promo → set `day7HardPaywall: false`
- Turn off delivery driver feature entirely → set `deliveryDrivers: false`

---

### 🗣️ Responding to common user complaints

#### "The app says I hit my package limit but I'm a paid subscriber"

This means the user's subscription status didn't sync correctly. Ask them to:
1. Open Porchivo → Profile tab
2. Scroll to Subscription section
3. Tap "Restore purchases"

If that doesn't work, check RevenueCat dashboard to confirm they have an
active subscription (`app.revenuecat.com` → Customers → search their email).

---

#### "I bought a subscription but it's not showing as active"

1. Check RevenueCat dashboard → confirm purchase exists
2. Ask the user to tap Profile → Restore purchases
3. If still broken, check if the RevenueCat product IDs in `config/app.ts`
   match what's configured in RevenueCat and the App Store exactly
   (they must be identical character-for-character)

---

#### "The tracking information isn't updating"

Tracking data comes from Ship24 (a third-party API). Check:
1. Go to [ship24.com](https://ship24.com) and log in
2. Check your API usage — you may have hit your plan limit
3. If the API is down, set `liveTracking: false` in `config/features.ts`
   as a temporary measure (users can still see packages but no live updates)

---

#### "Push notifications aren't working"

1. Make sure the user has given notification permission (they can check in
   iPhone Settings → Porchivo → Notifications)
2. Check your Expo Push notification quota at [expo.dev](https://expo.dev)
3. If it's a widespread issue, check the Supabase dashboard for errors
   in the notifications table

---

#### "The risk score seems wrong / too high / too low"

The risk score algorithm is in `lib/porchRisk.ts`. The score thresholds
(what score = High/Medium/Low) are in `config/app.ts` → `SECTION 4 — RISK SCORE THRESHOLDS`.

To make the score feel less alarming to users:
- Raise `RISK_THRESHOLDS.high` from 65 to e.g. 72
- Raise `RISK_THRESHOLDS.medium` from 35 to e.g. 45

To make the score more sensitive:
- Lower those numbers

---

#### "The app crashes on launch"

1. Check the error logs in your Sentry dashboard (`sentry.io`)
2. Look for the most recent error — it will tell you which file and line
3. If you can't identify the fix, post the exact error in a support chat
   with your developer

---

#### "A user wants a refund"

Refunds are handled by the App Store (Apple) or Google Play — not by you.
- **Apple:** The user goes to [reportaproblem.apple.com](https://reportaproblem.apple.com)
- **Google Play:** The user contacts Google Play support

You can also cancel their subscription in RevenueCat to prevent future charges.

---

### 🔢 Update the "Trusted on X porches" social proof number

1. Open `config/app.ts`
2. Find `SECTION 8 — SOCIAL PROOF`
3. Update `porchesProtected:` to the new number (e.g. `'25,000+'`)

> ⚠️ Keep this number truthful. Apple reviewers can reject apps for
> misleading social proof claims.

---

### 📧 Update support email address

1. Open `config/app.ts`
2. Find `SECTION 6 — SUPPORT & CONTACT INFO`
3. Update `email:` to your new address
4. This automatically updates everywhere the email appears in the app

---

### 📦 Add a new package carrier or tracking format

Carrier detection happens in `lib/trackingApi.ts`.
This is more technical — look for the `detectCarrier()` function and
follow the existing pattern for adding a new carrier regex.

---

## File Map — What Each File Does

> Use this when a user reports a bug on a specific screen. Find the screen
> below to know which file to look in.

| Screen | File |
|--------|------|
| Welcome / splash | `app/welcome.tsx` |
| Intro slides | `app/intro.tsx` |
| Login / Sign up | `app/login.tsx` |
| Post-signup setup | `app/post-signup.tsx` |
| Home tab | `app/(tabs)/(home)/index.tsx` |
| Packages tab | `app/(tabs)/packages/index.tsx` |
| Activity tab | `app/(tabs)/activity/index.tsx` |
| Profile tab | `app/(tabs)/profile/index.tsx` |
| Add package | `app/add-package.tsx` |
| Package detail | `app/package-detail.tsx` |
| Porch risk screen | `app/porch-risk.tsx` |
| Alerts list | `app/alerts.tsx` |
| Alert detail | `app/alert-detail.tsx` |
| Upgrade / paywall | `app/upgrade.tsx` |
| Notifications | `app/notifications.tsx` |
| Neighborhood map | `app/map.tsx` |
| Edit profile | `app/edit-profile.tsx` |
| Porch Partners | `app/partners.tsx` |
| Invite Partner | `app/invite-partner.tsx` |
| Privacy Policy | `app/privacy-policy.tsx` |
| Terms of Service | `app/terms-of-service.tsx` |

<!-- AUTO-GENERATED:SCREEN-INDEX:START -->
> _Auto-generated from `expo/app/` on **2026-09-02 16:37 UTC** by `scripts/refresh-docs.mjs`. The
> curated table above stays hand-written; this list is the complete, always-current
> set of route files so nothing silently goes missing as the app grows._

**101 route screens detected:**

| Route | File |
|-------|------|
| `(tabs)/(home)/index.tsx` | `app/(tabs)/(home)/index.tsx` |
| `(tabs)/activity/index.tsx` | `app/(tabs)/activity/index.tsx` |
| `(tabs)/community.tsx` | `app/(tabs)/community.tsx` |
| `(tabs)/create/index.tsx` | `app/(tabs)/create/index.tsx` |
| `(tabs)/more.tsx` | `app/(tabs)/more.tsx` |
| `(tabs)/packages/index.tsx` | `app/(tabs)/packages/index.tsx` |
| `(tabs)/payments.tsx` | `app/(tabs)/payments.tsx` |
| `(tabs)/porch-partner.tsx` | `app/(tabs)/porch-partner.tsx` |
| `(tabs)/profile/index.tsx` | `app/(tabs)/profile/index.tsx` |
| `(tabs)/requests.tsx` | `app/(tabs)/requests.tsx` |
| `activity-history.tsx` | `app/activity-history.tsx` |
| `add-package.tsx` | `app/add-package.tsx` |
| `add-property.tsx` | `app/add-property.tsx` |
| `admin-dashboard.tsx` | `app/admin-dashboard.tsx` |
| `admin-funnel.tsx` | `app/admin-funnel.tsx` |
| `alert-detail.tsx` | `app/alert-detail.tsx` |
| `alerts.tsx` | `app/alerts.tsx` |
| `analytics-dashboard.tsx` | `app/analytics-dashboard.tsx` |
| `announcements.tsx` | `app/announcements.tsx` |
| `auth-fail.tsx` | `app/auth-fail.tsx` |
| `billing.tsx` | `app/billing.tsx` |
| `chat.tsx` | `app/chat.tsx` |
| `community-calendar.tsx` | `app/community-calendar.tsx` |
| `community-guidelines.tsx` | `app/community-guidelines.tsx` |
| `contact-support.tsx` | `app/contact-support.tsx` |
| `create-assignment.tsx` | `app/create-assignment.tsx` |
| `create-event.tsx` | `app/create-event.tsx` |
| `delete-account.tsx` | `app/delete-account.tsx` |
| `delivery-alerts.tsx` | `app/delivery-alerts.tsx` |
| `delivery-windows.tsx` | `app/delivery-windows.tsx` |
| `drivers.tsx` | `app/drivers.tsx` |
| `edit-profile.tsx` | `app/edit-profile.tsx` |
| `field-guide.tsx` | `app/field-guide.tsx` |
| `file-incident.tsx` | `app/file-incident.tsx` |
| `guest-browse.tsx` | `app/guest-browse.tsx` |
| `how-it-works.tsx` | `app/how-it-works.tsx` |
| `incident-queue.tsx` | `app/incident-queue.tsx` |
| `invite-partner.tsx` | `app/invite-partner.tsx` |
| `invoices.tsx` | `app/invoices.tsx` |
| `join-community.tsx` | `app/join-community.tsx` |
| `location-consent.tsx` | `app/location-consent.tsx` |
| `log-package.tsx` | `app/log-package.tsx` |
| `login.tsx` | `app/login.tsx` |
| `maintenance-queue.tsx` | `app/maintenance-queue.tsx` |
| `manage-subscription.tsx` | `app/manage-subscription.tsx` |
| `map.tsx` | `app/map.tsx` |
| `my-assignments.tsx` | `app/my-assignments.tsx` |
| `neighborhood.tsx` | `app/neighborhood.tsx` |
| `network-map.tsx` | `app/network-map.tsx` |
| `notifications-permission.tsx` | `app/notifications-permission.tsx` |
| `notifications.tsx` | `app/notifications.tsx` |
| `onboarding-setup.tsx` | `app/onboarding-setup.tsx` |
| `onboarding.tsx` | `app/onboarding.tsx` |
| `org-branding.tsx` | `app/org-branding.tsx` |
| `org-signup.tsx` | `app/org-signup.tsx` |
| `org-vendors.tsx` | `app/org-vendors.tsx` |
| `package-detail.tsx` | `app/package-detail.tsx` |
| `package-ops-board.tsx` | `app/package-ops-board.tsx` |
| `pain-point.tsx` | `app/pain-point.tsx` |
| `partner-detail.tsx` | `app/partner-detail.tsx` |
| `partner-earnings.tsx` | `app/partner-earnings.tsx` |
| `partner-holds.tsx` | `app/partner-holds.tsx` |
| `partner-onboarding.tsx` | `app/partner-onboarding.tsx` |
| `partner-payout-setup.tsx` | `app/partner-payout-setup.tsx` |
| `partner-verify.tsx` | `app/partner-verify.tsx` |
| `partners.tsx` | `app/partners.tsx` |
| `porch-risk.tsx` | `app/porch-risk.tsx` |
| `post-announcement.tsx` | `app/post-announcement.tsx` |
| `privacy-policy.tsx` | `app/privacy-policy.tsx` |
| `property-management.tsx` | `app/property-management.tsx` |
| `referral.tsx` | `app/referral.tsx` |
| `reset-password.tsx` | `app/reset-password.tsx` |
| `resident-directory.tsx` | `app/resident-directory.tsx` |
| `role-management.tsx` | `app/role-management.tsx` |
| `role-selection.tsx` | `app/role-selection.tsx` |
| `safe-dropoff.tsx` | `app/safe-dropoff.tsx` |
| `safety-score.tsx` | `app/safety-score.tsx` |
| `settings.tsx` | `app/settings.tsx` |
| `shipment-detail.tsx` | `app/shipment-detail.tsx` |
| `splash.tsx` | `app/splash.tsx` |
| `staff-support-queue.tsx` | `app/staff-support-queue.tsx` |
| `submit-maintenance.tsx` | `app/submit-maintenance.tsx` |
| `support-ticket-detail.tsx` | `app/support-ticket-detail.tsx` |
| `terms-of-service.tsx` | `app/terms-of-service.tsx` |
| `tracking-add-delivery.tsx` | `app/tracking-add-delivery.tsx` |
| `tracking-complete.tsx` | `app/tracking-complete.tsx` |
| `tracking-notifications.tsx` | `app/tracking-notifications.tsx` |
| `tracking-onboarding.tsx` | `app/tracking-onboarding.tsx` |
| `tracking-partners.tsx` | `app/tracking-partners.tsx` |
| `tracking-theft-shield.tsx` | `app/tracking-theft-shield.tsx` |
| `tracking-welcome.tsx` | `app/tracking-welcome.tsx` |
| `trust-engine.tsx` | `app/trust-engine.tsx` |
| `ups-amazon/access-points.tsx` | `app/ups-amazon/access-points.tsx` |
| `ups-amazon/code-ready.tsx` | `app/ups-amazon/code-ready.tsx` |
| `ups-amazon/hub.tsx` | `app/ups-amazon/hub.tsx` |
| `ups-amazon/intercept.tsx` | `app/ups-amazon/intercept.tsx` |
| `ups-amazon/live-tracking.tsx` | `app/ups-amazon/live-tracking.tsx` |
| `ups-amazon/not-delivered.tsx` | `app/ups-amazon/not-delivered.tsx` |
| `value-preview.tsx` | `app/value-preview.tsx` |
| `welcome-features.tsx` | `app/welcome-features.tsx` |
| `welcome.tsx` | `app/welcome.tsx` |
<!-- AUTO-GENERATED:SCREEN-INDEX:END -->

**Shared components** (used across multiple screens):

| Component | What it does |
|-----------|-------------|
| `components/TodayRiskCard.tsx` | The risk card on the home screen |
| `components/ShipmentCard.tsx` | Each package card in the list |
| `components/BrandSplash.tsx` | The loading/splash screen |
| `components/ErrorBoundary.tsx` | Catches crashes and shows a recovery screen |
| `components/SkeletonLoader.tsx` | The loading placeholder animations |

**Core logic** (the engine):

| File | What it does |
|------|-------------|
| `config/app.ts` | **YOUR MAIN CONTROL PANEL** — pricing, limits, thresholds |
| `config/features.ts` | Feature on/off switches |
| `config/copy.ts` | All user-facing text |
| `lib/tiers.ts` | Subscription plan definitions and tier capabilities |
| `lib/porchRisk.ts` | Risk score calculation algorithm |
| `lib/revenueCat.ts` | In-app purchase integration |
| `lib/supabase.ts` | Database connection |
| `lib/trackingApi.ts` | Package carrier tracking integration |
| `lib/notifications.ts` | Push notification sending logic |
| `store/AppContext.tsx` | Global app state (auth, subscription, user profile) |
| `store/ShipmentsContext.tsx` | Package list state |

---

## Before You Ship Any Change

1. **Test the main flow:** Launch → sign in → home screen → add a package → see risk score
2. **Test the paywall:** Tap upgrade → see correct prices → tap "Start Free Trial"
3. **Test on a free account:** Make sure the 5-package limit still works
4. **Check for typos:** Read any copy you changed out loud
5. **Check the preview** in the Rork simulator before publishing

---

## Monitoring After Launch

### Where to watch for problems

| Tool | What to watch | Link |
|------|--------------|-------|
| **Sentry** | Crash reports and JS errors | sentry.io |
| **RevenueCat** | Subscription revenue, churn, failed purchases | app.revenuecat.com |
| **Supabase** | Database errors, auth issues, slow queries | supabase.com/dashboard |
| **Expo** | Push notification delivery | expo.dev |
| **App Store Connect** | Reviews, crash reports, download stats | appstoreconnect.apple.com |

### Key metrics to track weekly

- **Conversion rate:** What % of installs start a trial? (Target: >8%)
- **Trial-to-paid rate:** What % of trials convert? (Target: >40%)
- **Day-7 retention:** Are users still opening after 7 days? (Target: >30%)
- **Crash-free rate:** Should be above 99.5% — below that, something is wrong

---

## Emergency Procedures

### If the app is crashing for all users

1. Check Sentry immediately for the error
2. If it's a server issue (Supabase down), there's nothing to do in the code —
   wait for Supabase to recover
3. If it's a code error, set the feature flag for the broken feature to `false`
   in `config/features.ts` as a temporary fix while you diagnose

### If RevenueCat is down (purchases failing)

RevenueCat has its own status page at [status.revenuecat.com](https://status.revenuecat.com).
If it's a RevenueCat outage, purchases will fail temporarily but resume automatically.
Post a status update to your users if it lasts more than 2 hours.

### If Supabase is down (login failing)

Check [status.supabase.com](https://status.supabase.com). Outages are rare but happen.
Nothing to change in the code — wait for it to recover.

---

## Support Tickets + AI-Drafted Replies (2026-07-18)

The `public.support_tickets` table is now defined in
`supabase/support-tickets-migration.sql` (bundled into `master-deploy.sql`).
Before this migration was added, every call from `expo/lib/supportTickets.ts`
failed with `relation "public.support_tickets" does not exist`.

**What the migration creates**
- `support_tickets` table with the columns the app already reads/writes
  (subject, body, category, status, priority, staff_reply, resolution_note,
  attachment_url, app_version, platform, device_model).
- Four `ai_draft_*` columns (STAFF-ONLY): `ai_draft_reply`,
  `ai_draft_generated_at`, `ai_draft_model`, `ai_draft_feedback`.
  Column-level grants revoke SELECT on them from `authenticated`, so a
  user's `select *` never sees the draft. The `support-ticket-ai-draft`
  Edge Function (service role) is the only writer.
- Six RLS policies: user SELECT/INSERT/UPDATE/DELETE on own rows + staff
  SELECT/UPDATE on any row (gated on `app_metadata.role = 'support_staff'`
  or `super_admin`).
- Three triggers: `trg_stamp_ticket_owner` (fill user_id from auth.uid()),
  `trg_guard_ticket_writes` (reject user writes to staff-only columns),
  `trg_enqueue_ticket_ai_draft` (fire-and-forget pg_net POST to the Edge
  Function on INSERT).

**AI-draft Edge Function** — `supabase/functions/support-ticket-ai-draft/`
- Called by the trigger right after a ticket is created.
- Bearer-token auth (`SUPPORT_TICKET_AI_DRAFT_TOKEN`) — the same token is
  set as a DB GUC (`app.support_ticket_ai_draft_token`) so the trigger can
  call it.
- Loads the ticket via the service role, bails if a draft already exists
  (idempotent) or the ticket is closed/resolved.
- Calls the Rork AI Gateway (`/v2/vercel/v1/chat/completions`) with a tight
  system prompt and the ticket body. Primary model: `openai/gpt-5-nano`
  ($0.05/M in, $0.40/M out, ~4.4s p50). Fallbacks: `openai/gpt-5-mini`,
  `google/gemini-2.5-flash-lite`.
- Writes the draft back into the `ai_draft_*` columns (guarded by
  `.is('ai_draft_reply', null)` to win a race against two trigger deliveries).
- Any error is logged and acknowledged with 200 so the pg_net trigger does
  not retry in a loop. The ticket still exists; staff draft manually.

**One-time setup after deploying the migration + function**
```sh
supabase secrets set SUPPORT_TICKET_AI_DRAFT_TOKEN=<random-32-char-string>
supabase secrets set RORK_TOOLKIT_URL=https://toolkit.rork.com
supabase secrets set RORK_TOOLKIT_SECRET_KEY=<same as EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY>
supabase functions deploy support-ticket-ai-draft

-- In SQL Editor:
ALTER DATABASE <your-db> SET app.support_ticket_ai_draft_url =
  'https://<project-ref>.supabase.co/functions/v1/support-ticket-ai-draft';
ALTER DATABASE <your-db> SET app.support_ticket_ai_draft_token = <same token>;
```
If the GUCs are not set, the trigger skips silently — tickets still create,
staff just draft manually.

**Account deletion** — `delete-account-procedure.sql` now removes the
user's `support_tickets` rows before the profile cascade.

---

## Pre-Beta Entitlement / Product-ID Audit (2026-07-18)

This section records the state of the entitlement and product-id layer at beta launch.
It is the founder-facing companion to the audit punch list; the code-level fixes are
noted inline so you can verify them without grepping history.

### ✅ Resolved in code

- **M-2 — Service-role key liveness:** All 13 Edge Functions read
  `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env.get(...)` — the same mechanism Supabase
  auto-injects into every function. There is **no** `SUPABASE_SECRET_KEYS` migration
  in this repo (zero references anywhere in code, docs, SQL, or CI). The supposed
  "disabled 2026-07-12" migration never landed here, so there is nothing to clean up
  client-side. The one remaining check is platform-side: confirm the Supabase project
  still has the service-role key enabled (Dashboard → Project Settings → API →
  `service_role` secret present). If it was disabled, every Edge Function is silently
  500-ing — check Edge Function logs for `Missing SUPABASE_SERVICE_ROLE_KEY`.

- **H-2 — Phantom `'lifetime'` product id removed:** `expo/lib/tiers.ts`
  `LIFETIME_PRODUCT_IDS` is now `['porchivo_lifetime']` only. The bare `'lifetime'`
  string matched no real product in RevenueCat or the stores and was a trap if someone
  ever created a product literally named `lifetime`.

- **H-3 — Webhook tier resolver hardened:** `supabase/functions/revenuecat-webhook/index.ts`
  `resolveTierFromProductId` now uses an explicit `PRODUCT_ID_TIER_MAP`
  (exact, case-insensitive match) instead of fragile `productId.includes('family')` /
  `includes('premium')` substring checks. The old resolver would silently mis-resolve a
  product id like the legacy `com.porchivo.premium.family` (which contains *both*
  'premium' and 'family') if the check order ever changed. Unknown paid product ids now
  log a warning and fall back to conservative `'premium'` rather than over-entitling.

### ✅ Resolved in code (additional — 2026-07-18)

- **M-1 — Supabase key var renamed to publishable convention:** `expo/lib/supabase.ts`
  now reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first, falling back to the
  legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` so a stale `.env` / EAS secret doesn't
  break the app mid-transition. `expo/.env` declares the new var name with the
  current key value. **Founder action:** once Supabase Dashboard → Settings →
  API Keys shows the new `sb_publishable_...` key, replace the JWT value in
  `.env` and EAS secrets with it, then drop the legacy fallback line in
  `lib/supabase.ts`.

- **M-3 — Webhook hardened with subscriber-API callback (not signature):**
  RevenueCat officially does **not** send a webhook signature header (confirmed
  by RC staff: "We don't provide a x-revenuecat-signature header (or similar)
  mechanism"). So `REVENUECAT_SIGNATURE_SECRET` as imagined in the audit cannot
  be implemented. Instead, `supabase/functions/revenuecat-webhook/index.ts` now
  supports an **optional** defence-in-depth layer: when `REVENUECAT_API_SECRET`
  + `REVENUECAT_PROJECT_ID` are set as Supabase secrets, the function calls
  back to `GET /v1.1/subscribers/{app_user_id}` to confirm the user referenced
  by the event is a real RC subscriber before mutating any state. If the
  lookup fails the event is acknowledged without state change; if RC is
  unreachable the check fails open so a real subscriber isn't locked out by a
  transient RC outage. **Founder action (optional):** `supabase secrets set
  REVENUECAT_API_SECRET=<rc-secret-api-key> REVENUECAT_PROJECT_ID=<rc-project-id>`
  then `supabase functions deploy revenuecat-webhook`. If left unset, the
  webhook runs bearer-token-only (RC's recommended minimum).

- **M-4 — `EXPO_PUBLIC_SHIP24_API_KEY` removed from the client bundle:** the
  var is no longer in `expo/.env` and no code reads it (tracking routes through
  the `track-shipment` Edge Function, which reads the server-only
  `SHIP24_API_KEY`). The key is no longer inlined into the IPA/APK. **Founder
  action:** rotate the Ship24 key in the Ship24 dashboard (the old value was
  public in the bundle), then `supabase secrets set SHIP24_API_KEY=<new_key>`.

- **M-5 — `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY` removed from the client
  bundle:** the var is no longer in `expo/.env` and no code in `expo/` reads it
  (zero grep hits). The name (`..._SECRET_KEY` in an `EXPO_PUBLIC_*` var) was
  the exposure; removing it eliminates the leak. **Founder action:** rotate
  the key with Rork support and, if any server-side code ever needs it, set it
  as a Supabase Edge Function secret without the `EXPO_PUBLIC_` prefix.

- **L-2 — `DbRevenueCatEvent` interface added:** `expo/types/database.ts` now
  has a typed interface for the `revenuecat_events` audit-log table, matching
  the schema in `supabase/subscription-entitlements-migration.sql`. Clients
  still have zero runtime access to this table (RLS enabled, no permissive
  policies); the type is for code-completeness and any future server-side tooling.

- **Staff AI-draft push fan-out wired:** when the `support-ticket-ai-draft`
  Edge Function persists a new `ai_draft_reply`, it now calls the new
  service-role-only `get_staff_push_tokens()` RPC and fans out an Expo push
  notification to every `support_staff` / `super_admin` user who has a push
  token on file. The push carries `{ ticketId, type: 'staff_ticket_ai_draft' }`
  in its data payload. Tapping the push deep-links into `/staff-support-queue`,
  which reads the `ticketId` search param and auto-opens that ticket's review
  modal (draft shown for edit/regenerate/use-draft/send). Best-effort: a push
  failure is logged and never rolls back the draft. **Founder action:**
  re-deploy the edge function (`supabase functions deploy support-ticket-ai-draft`)
  and re-run `supabase/support-tickets-migration.sql` (idempotent) so the new
  `get_staff_push_tokens()` RPC exists on the database. Staff must have push
  notifications enabled in the app for the ping to land.

### ⏳ Requires dashboard coordination (not code-fixable in isolation)

- **H-1 — Family monthly product id is `com.porchivo.premium.family` (wrong namespace).**
  Every other product id uses a flat namespace (`premium_monthly`, `family_annual`,
  `porchivo_lifetime`). The family-monthly id literally contains `premium`. The new
  explicit tier map in the webhook handles it correctly today (it is listed under
  `'family'`), so this is no longer a *resolver* risk — but the id is still confusing in
  the RevenueCat / App Store Connect / Play Console dashboards. **To rename:** create
  `family_monthly` in RC + both stores first, attach it to the `family_household`
  entitlement, then update `expo/config/app.ts` → `FAMILY_PLAN.monthly.productId` to
  `'family_monthly'`, then remove the legacy `com.porchivo.premium.family` line from
  `PRODUCT_ID_TIER_MAP` in the webhook. Do NOT just rename in code — existing
  subscribers are tied to the old id and would lose entitlement lookups.

- **H-4 — RevenueCat entitlement identifiers must match `ENTITLEMENTS` exactly.**
  `expo/lib/tiers.ts` `ENTITLEMENTS` = `premium`, `family_household`, `enterprise_hoa`,
  `lifetime`, `remove_ads`. The client reads `info.entitlements.active['family_household']`
  etc. — if the RC dashboard entitlement is named `family` instead of `family_household`,
  the client never sees it and the user stays free. **Manual check:** RC Dashboard →
  Entitlements → confirm the five names are exactly `premium`, `family_household`,
  `enterprise_hoa`, `lifetime`, `remove_ads`, and that every product id
  (`premium_monthly`, `premium_annual`, `com.porchivo.premium.family`, `family_annual`,
  `enterprise_monthly`, `enterprise_annual`, `porchivo_lifetime`) is attached to the
  correct entitlement.

---

## Asking AI for Help


When using an AI coding assistant (like the one that built this app), include context:

**Good prompt template:**
> "In the Porchivo React Native app, the [SCREEN NAME] screen has an issue where [DESCRIBE THE PROBLEM]. 
> The relevant file is [FILE PATH]. Here is the error I'm seeing: [PASTE ERROR].
> Please fix only this issue without changing anything else."

**Tips:**
- Always paste the exact error message, not a paraphrase
- Mention which file you think is involved (use the File Map above)
- Say "make the smallest possible change" to avoid unintended side effects
- After any AI fix, test the same flow you were testing before

---

*Last updated: May 2026*
