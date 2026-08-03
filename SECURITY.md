# Porchivo — Security Audit & Hardening Report

**Date:** 2026-05-23  
**Auditor:** Senior Mobile Security Engineer / Lead Expo/React Native Architect  
**Scope:** Full codebase + Supabase schema + EAS config + environment variable posture

---

## ⚠️ READ THIS FIRST

This document is honest and direct. Several findings are launch-blocking. None of this is
personal — it is standard mobile app attack surface. The goal of this document is to fix
every exploitable pattern before users (and attackers) see them.

> **Rule:** All client-side code is readable by attackers. Treat it that way.

---

## SECTION A — SECURITY FINDINGS

### 🔴 CRITICAL

---

#### C-1 — Ship24 paid API key fully exposed in client bundle ✅ FIXED

**File:** `lib/ship24.ts`, env var `EXPO_PUBLIC_SHIP24_API_KEY`  
**Status: RESOLVED** — `EXPO_PUBLIC_SHIP24_API_KEY` is no longer read anywhere in the client bundle.  
**What was wrong:** Ship24 is a paid tracking API. The key was read from `EXPO_PUBLIC_SHIP24_API_KEY` and used directly in the mobile client. `EXPO_PUBLIC_*` variables are **inlined into the JS bundle at build time** and trivially extractable from any IPA/APK.  
**Fix applied:**
1. Created `supabase/functions/track-shipment/index.ts` — Deno Edge Function that reads `SHIP24_API_KEY` via `Deno.env.get()` (server-only, never in the bundle)
2. `lib/ship24.ts` now calls `supabase.functions.invoke('track-shipment', ...)` instead of Ship24 directly — the Supabase JWT authenticates the user server-side before any tracking call is made
3. `isShip24Configured()` now checks `isSupabaseConfigured` instead of the removed env var
4. **Action required:** Remove `EXPO_PUBLIC_SHIP24_API_KEY` from EAS secrets and your `.env` files, then run: `supabase secrets set SHIP24_API_KEY=<your_rotated_key>`

```typescript
// supabase/functions/track-shipment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  // Verify the caller is an authenticated Porchivo user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const { trackingNumber, carrier } = await req.json()
  const apiKey = Deno.env.get('SHIP24_API_KEY')! // server-only secret

  const res = await fetch('https://api.ship24.com/public/v1/trackers/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ trackingNumber, courierCode: carrier }),
  })
  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: res.status,
  })
})
```

Client call changes to:
```typescript
const { data, error } = await supabase.functions.invoke('track-shipment', {
  body: { trackingNumber, carrier },
})
```

---

#### C-2 — `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY` is not secret

**File:** Public env vars list  
**What is wrong:** A variable named `..._SECRET_KEY` is in `EXPO_PUBLIC_*`. The name contains "SECRET." It is inlined into the client bundle.  
**Why it is dangerous:** Whatever this key unlocks (Rork toolkit AI/image APIs) is fully public. Any user can extract it and use your API quota.  
**Exact fix:**
- If this key is used only for backend-to-backend calls, move it to a Supabase Edge Function environment variable and remove `EXPO_PUBLIC_` prefix entirely.
- If it is required client-side (e.g. an SDK publishable key), rename it and document clearly why it is safe to expose. "SECRET" in the name is misleading.
- Rotate the current key.

---

#### C-3 — `__DEV__` purchase bypass grants free premium in debug builds

**File:** `store/AppContext.tsx:351-354`  
**What is wrong:**
```typescript
if (isUnavailable || __DEV__) {
  console.log('[AppContext] RC unavailable or dev build, simulating purchase...');
  await applySimulatedPurchase(); // sets isPremium=true, tier='premium'
  return true;
}
```
This silently grants premium access to ANY user in a `__DEV__` build. Expo development client builds distributed via `eas build --profile development` or `preview` can have `__DEV__ = true`. If a development/preview APK leaks, anyone who installs it gets free premium.  
**Why it is dangerous:** It bypasses RevenueCat, sets `is_premium: true` in Supabase, and grants full tier capabilities without any payment. It also writes the fake tier to AsyncStorage which persists.  
**Exact fix:** Remove `|| __DEV__` from the condition. Use RC's sandbox environment for dev testing instead. **Fixed in this audit.**

---

#### C-4 — Client sends push notifications directly to Expo Push API

**File:** `lib/notifications.ts:87-117`  
**What is wrong:** `sendPushNotification()` calls `https://exp.host/--/api/v2/push/send` directly from the client. Push tokens for ALL users are stored in `profiles.expo_push_token`. Any authenticated user can read all profiles (see RLS finding H-1), harvest all push tokens, and call this function to spam any user.  
**Why it is dangerous:** This is a push spam vector. A malicious user can send arbitrary notifications to any user in your app. There is no authentication on the Expo Push API — just a valid token is sufficient.  
**Exact fix:**
- Remove `sendPushNotification()` from the client entirely.
- Push notifications must only be triggered from a Supabase Edge Function or database trigger (you already have `supabase/push-notification-trigger.sql`).
- The push token column on `profiles` should NOT be selectable by other users (see RLS fix H-1).
- **Fixed in this audit:** The function is now marked as backend-only and will throw if called from the client.

---

### 🟠 HIGH

---

#### H-1 — Over-broad RLS: ALL authenticated users can read ALL profiles

**File:** `supabase/migration.sql:37-39`  
**What is wrong:**
```sql
create policy "Authenticated can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');
```
This policy allows ANY signed-in user to `SELECT *` from `profiles`. That table contains: full name, email, phone number, home address, `expo_push_token`, `is_premium`, `role`.  
**Why it is dangerous:** Any user in your app can dump the entire user database: names, addresses, phone numbers, push tokens. Combined with C-4, this is a targeted push spam attack.  
**Exact fix:** Drop this policy. Users only need to see the minimum fields of other users to display partner names in the shipment flow. Create a restricted view or use column-level grants. **Fixed in RLS hardening SQL in this audit.**

---

#### H-2 — Over-broad RLS: Any authenticated user can UPDATE any open shipment

**File:** `supabase/migration.sql:95-97`  
**What is wrong:**
```sql
create policy "Authenticated accept open shipments"
  on public.shipments for update
  using (auth.role() = 'authenticated' and status = 'open');
```
Any signed-in user can update any open shipment — change the partner, notes, address, location, anything.  
**Why it is dangerous:** Malicious users can assign themselves to any open shipment, read the homeowner's address, or corrupt data.  
**Exact fix:** A partner should only be able to update specific columns (e.g. `partner_id`, `status`) when accepting, not the full row. Use column-level RLS or a dedicated RPC function. **Fixed in hardened SQL.**

---

#### H-3 — Over-broad RLS: Any authenticated user can insert notifications for anyone

**File:** `supabase/migration.sql:123-124`  
**What is wrong:**
```sql
create policy "Authenticated insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');
```
Any user can insert a notification with any `recipient_id`.  
**Why it is dangerous:** A user can flood any other user's notification inbox with arbitrary messages.  
**Exact fix:** Notifications should only be insertable by Supabase Edge Functions or database triggers using `security definer`. The client should never insert directly. **Fixed in hardened SQL.**

---

#### H-4 — Admin funnel screen has no access control

**File:** `app/admin-funnel.tsx`  
**What is wrong:** The screen is accessible to any authenticated user who navigates to `/admin-funnel`. There is no role check, no admin flag check — nothing.  
**Why it is dangerous:** Any user can see your funnel analytics, conversion rates, event stream, and device-level data. This is business intelligence that should only be visible to you.  
**Exact fix:** Guard the screen with a hardcoded admin user ID check against the session. **Fixed in this audit.**

---

#### H-5 — `is_premium` is client-controlled with no server verification

**File:** `store/AppContext.tsx:273-278`, `saveProfileMutation`  
**What is wrong:** The client decides when to write `is_premium: true` to Supabase after checking RevenueCat locally. The server never independently validates the subscription state with RevenueCat.  
**Why it is dangerous:** If RC validation is bypassed (e.g. via the `__DEV__` bug in C-3, or a future bug), the database gets `is_premium = true` with no real payment. The `is_premium` field in your DB is effectively a client-writable flag.  
**Exact fix:**
- Do not rely on `is_premium` in the DB as a source of truth for gating features. Always verify via RC SDK (which validates server-side with Apple/Google receipts).
- If you want a server-side record, use a Supabase Edge Function as the RC webhook receiver — RC will POST subscription events to it and you can update the DB there only.
- Remove the ability for the client to write `is_premium` directly.

---

#### H-6 — Verbose production logging leaks PII and internal state

**File:** All `lib/` files and `store/AppContext.tsx`  
**What is wrong:** `console.log` calls throughout production code log: user IDs, email addresses (on sign-up), entitlement states, profile data, internal system state. These appear in production device logs, crash reporters, and analytics tools.  
**Why it is dangerous:** Crash analytics tools (Sentry etc.) capture console output. PII in logs may violate GDPR/CCPA. Internal state leaks help reverse engineers understand your system.  
**Exact fix:** Create a production-safe logger that is a no-op in production. **Fixed in this audit.**

---

#### H-7 — Session tokens stored in unencrypted AsyncStorage

**File:** `lib/supabase.ts:49-72`  
**What is wrong:** Supabase session JWTs (including refresh tokens) are stored in plain AsyncStorage. AsyncStorage on Android is stored unencrypted. On jailbroken iOS, it is readable without root tools.  
**Why it is dangerous:** A stolen device or jailbroken device exposes long-lived refresh tokens. An attacker with physical access to a device can hijack sessions.  
**Exact fix:** Use `expo-secure-store` (backed by iOS Keychain and Android Keystore) for token storage. Supabase supports a custom storage adapter — swap AsyncStorage for SecureStore.

```typescript
import * as SecureStore from 'expo-secure-store';

const supabaseStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
```

Note: SecureStore has a 2048-byte value limit. Supabase sessions can exceed this. Use the chunking pattern:
```typescript
// chunk large values across multiple SecureStore entries
const CHUNK_SIZE = 1900;
```

---

### 🟡 MEDIUM

---

#### M-1 — Subscription tier cached in unencrypted AsyncStorage (tamperable)

**File:** `store/AppContext.tsx:328,340,376`  
**What is wrong:** `porchivo_tier` and `porchivo_referral_credit_until` are written to AsyncStorage and read back on launch.  
**Why it is dangerous:** On a jailbroken device, a user can set `porchivo_tier` to `'lifetime'` and `porchivo_referral_credit_until` to a future date. If your feature gates read from `tier` state (which is seeded from AsyncStorage), free users get premium features.  
**Exact fix:** Do not use AsyncStorage tier as a gate. Always gate features using the live RevenueCat `customerInfo` object. AsyncStorage tier is a UX cache only (to avoid flash of free content) and must always be overridden by RC's authoritative response on session start.

---

#### M-2 — Password minimum is 6 characters

**File:** `app/login.tsx:92`  
**What is wrong:** `password.length < 6` is the only password strength check. 6-character passwords are trivially brutable.  
**Why it is dangerous:** Weak passwords + no CAPTCHA = credential stuffing risk.  
**Exact fix:** Enforce minimum 8 characters, ideally with 1 number or symbol. Update Supabase Auth settings in the dashboard to match (`minimum_password_length = 8`).

---

#### M-3 — Hardcoded project ID in notifications

**File:** `lib/notifications.ts:49`  
**What is wrong:** `const projectId = 'itw0s622ahx9uel9v4pjt';` is hardcoded.  
**Why it is dangerous:** Not a security risk per se, but inconsistent — the same value is in `EXPO_PUBLIC_PROJECT_ID`. Hardcoded values get forgotten and cause silent failures after migrations.  
**Exact fix:** Use `process.env.EXPO_PUBLIC_PROJECT_ID`.

---

#### M-4 — Analytics events insertable by any authenticated user

**File:** `lib/analytics.ts:85-103`  
**What is wrong:** The `analytics_events` table presumably has no RLS, allowing any user to insert arbitrary events with any `session_id` or `user_id`.  
**Why it is dangerous:** Competitors or curious users can pollute your funnel data, inflating conversion metrics.  
**Exact fix:** Add RLS to `analytics_events`: users can only insert events where `user_id = auth.uid()` (or `user_id IS NULL` for pre-auth events).

---

#### M-5 — EAS has no environment variable separation

**File:** `eas.json`  
**What is wrong:** No `env` blocks in `eas.json`. All three build profiles (development, preview, production) use the same environment variables.  
**Why it is dangerous:** Development builds may accidentally hit production Supabase. Production builds might accidentally use test RevenueCat keys.  
**Exact fix:** Add explicit `env` overrides per profile. See Section 8.

---

#### M-6 — `deleteAccount` does client-side cascade deletes

**File:** `store/AppContext.tsx:411-461`  
**What is wrong:** The client manually deletes from `shipments` and `notifications` before calling `supabase.rpc('delete_user')`. If the RPC fails partway, you get a partial delete.  
**Why it is dangerous:** Partially deleted accounts leave orphaned data. The client delete of `shipments` only targets `homeowner_id = user`, missing cases where the user was a `partner_id`.  
**Exact fix:** Move the entire account deletion to a Supabase Edge Function or stored procedure that deletes everything in a transaction. Client calls a single RPC, gets a single result.

---

### 🔵 LOW

---

#### L-1 — No deep link / universal link validation

**File:** `app/+native-intent.tsx`  
**What is wrong:** The file exists but deep link payloads are not sanitized before being routed.  
**Fix:** Validate deep link params against an allowlist before passing to the router.

#### L-2 — Error messages may reveal internal details

**File:** `app/login.tsx:127`  
**What is wrong:** The fallback `return error;` in `getSupabaseErrorMessage` can surface raw Supabase error strings to users, which may include internal schema details.  
**Fix:** Replace the fallback with a generic message: `'Something went wrong. Please try again.'`

#### L-3 — No Sentry PII scrubbing configured

**File:** env var `EXPO_PUBLIC_SENTRY_DSN` present  
**What is wrong:** If Sentry is capturing verbose logs (see H-6), user emails and IDs flow into Sentry.  
**Fix:** Configure Sentry `beforeSend` to strip PII from breadcrumbs and event data.

---

## SECTION B — TARGET ARCHITECTURE

### What stays in the Expo client
- UI rendering
- RevenueCat SDK (publishable keys only — RC keys are designed to be client-side)
- Supabase anon client (anon key is designed to be public — RLS is the security layer)
- expo-notifications token registration
- Local analytics buffering (session events, pre-upload)

### What moves to Supabase Edge Functions
- All Ship24 API calls (secret key)
- Push notification dispatch (no client-to-Expo-push-API)
- Account deletion (transactional)
- Any operation writing `is_premium` based on external validation
- RevenueCat webhook receiver (to sync subscription state server-side)

### What uses Supabase RLS policies
- Every table access — no exceptions
- Profiles: users see only their own row (plus a limited public view)
- Shipments: homeowners see their own; partners see assigned
- Notifications: recipient sees only their own
- Chat: only shipment participants
- Analytics: users insert only their own session's events

### What uses secure device storage
- Supabase session tokens → `expo-secure-store`
- Nothing else sensitive should be on-device

### What must NEVER be stored on device
- Service role keys
- Ship24 API key
- Any webhook secrets
- Stripe/billing secrets
- Admin credentials

### Environment variable classification

| Variable | Classification | Should be |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Public ✅ | Anon URL is safe to expose |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public ✅ | Anon key is safe; RLS is the guard |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Public ✅ | RC publishable keys are client-safe |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Public ✅ | Same |
| `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` | Public ✅ | Same |
| `EXPO_PUBLIC_SHIP24_API_KEY` | **✅ REMOVED — now server-only** | `SHIP24_API_KEY` set as Supabase Edge Function secret |
| `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY` | **🔴 CRITICAL — move to server** | Remove from client entirely |
| `EXPO_PUBLIC_SENTRY_DSN` | Public ✅ | DSN is designed to be client-side |
| `EXPO_PUBLIC_PROJECT_ID` | Public ✅ | Fine |
| `EXPO_PUBLIC_RORK_APP_KEY` | Review needed | Verify it's a publishable key |
| `EXPO_PUBLIC_RORK_AUTH_URL` | Public ✅ | URL is fine |
| `EXPO_PUBLIC_RORK_FUNCTIONS_URL` | Public ✅ | URL is fine |
| `EXPO_PUBLIC_TEAM_ID` | Public ✅ | Fine |
| `EXPO_PUBLIC_TOOLKIT_URL` | Public ✅ | Fine |

---

## SECTION C — EAS ENVIRONMENT SEPARATION

Update `eas.json`:

```json
{
  "cli": { "appVersionSource": "local" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development",
        "EXPO_PUBLIC_SUPABASE_URL": "https://YOUR-DEV-PROJECT.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "DEV_ANON_KEY"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "preview",
        "EXPO_PUBLIC_SUPABASE_URL": "https://YOUR-STAGING-PROJECT.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "STAGING_ANON_KEY"
      },
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "env": {
        "APP_ENV": "production"
      },
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

Recommendation: Run a **separate Supabase project** for dev/preview vs production. This prevents dev data from polluting prod, and prevents dev RLS mistakes from affecting real users.

---

## SECTION D — SUPABASE HARDENING SQL

See `supabase/hardened-rls.sql` for the complete replacement policies.

Key changes from current `migration.sql`:
1. **DROP** "Authenticated can view all profiles" — replaced with a safe read of minimal columns
2. **DROP** "Authenticated accept open shipments" — replaced with a constrained partner-accept RPC
3. **DROP** "Authenticated insert notifications" — notifications only insertable via `security definer` functions
4. Push token column only readable by the owning user
5. `analytics_events` table gets RLS

---

## SECTION E — SECRET HANDLING POLICY

### Rules
1. `EXPO_PUBLIC_*` variables are part of the compiled JS bundle. Treat them as world-readable.
2. Service role keys (`supabase.service_role`) must never appear in any client code or `EXPO_PUBLIC_*` variable. They belong only in Edge Function environment variables.
3. Third-party API keys that bill per-use (Ship24, OpenAI, etc.) must only live in Edge Function secrets.
4. No secrets in git. Use `.gitignore` for `.env*` files and EAS secrets for build-time values.
5. No secrets in `app.config.ts` `extra` block.
6. Rotate any key that has ever been in a public env var or committed to git.

### Key rotation checklist
- [ ] Rotate `SHIP24_API_KEY` in Ship24 dashboard → update Supabase Edge Function secret
- [ ] Rotate `RORK_TOOLKIT_SECRET_KEY` → move to server
- [ ] Rotate Supabase anon key if service role key was ever in client code
- [ ] Audit git history: `git log -S 'secret' --all` and `git log -S 'api_key' --all`

### Pre-commit secret scanning
Add to `.gitignore`:
```
.env
.env.local
.env.*.local
```

Install `git-secrets` or add a pre-commit hook:
```bash
#!/bin/sh
# .git/hooks/pre-commit
if git diff --cached | grep -i 'EXPO_PUBLIC.*SECRET\|service_role\|sk_live\|rk_live'; then
  echo "ERROR: Possible secret in staged files. Aborting commit."
  exit 1
fi
```

---

## SECTION F — AUTH & SESSION HARDENING

### Current state: Acceptable, with improvements needed
- PKCE flow: ✅ (configured in `lib/supabase.ts`)
- Auto-refresh: ✅
- Session persistence: ✅ but in plain AsyncStorage (fix with SecureStore per H-7)
- Sign-out: ✅ clears state and AsyncStorage

### Recommended improvements
1. **Password minimum**: 8 chars (update both `login.tsx` validation and Supabase Auth settings)
2. **Error messages**: Never reveal "User already registered" — use generic "Check your email" response to prevent user enumeration
3. **Re-auth for sensitive actions**: Account deletion should require password re-confirmation before calling `deleteAccount`
4. **Session revocation**: On sign-out, call `supabase.auth.signOut({ scope: 'global' })` to revoke all sessions, not just the current device

```typescript
// Revoke all sessions on explicit sign-out
await supabase.auth.signOut({ scope: 'global' });
```

---

## SECTION G — DEVICE DATA HARDENING

| Data | Current Storage | Recommended |
|---|---|---|
| Supabase session JWT | AsyncStorage (plain) | SecureStore (Keychain/Keystore) |
| Subscription tier cache | AsyncStorage | AsyncStorage is fine (not a gate) |
| Referral credit timestamp | AsyncStorage | AsyncStorage is fine (server is source of truth) |
| Onboarded flag | AsyncStorage | Fine |
| Analytics session ID | AsyncStorage | Fine |
| Push token | Not stored locally (in Supabase) | Fine |
| User email (remember me) | AsyncStorage plain | Acceptable for email, never password |

**Never store passwords locally.** Currently you store emails for "remember me" — that is acceptable. Passwords: never.

### Sentry PII scrubbing (add to Sentry init)
```typescript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    // Strip email from user context
    if (event.user?.email) delete event.user.email;
    // Strip any breadcrumb messages that look like auth logs
    event.breadcrumbs?.values?.forEach(b => {
      if (b.message?.includes('@') || b.message?.includes('session')) {
        b.message = '[redacted]';
      }
    });
    return event;
  },
});
```

---

## SECTION H — RELEASE HARDENING CHECKLIST

### Before every production build
- [ ] `APP_ENV=production` is set
- [ ] No `localhost` URLs in any env var
- [ ] No test credentials or test API keys in production profile
- [ ] `__DEV__` bypass is removed (fixed in this audit)
- [ ] `console.log` replaced with production logger (fixed in this audit)
- [ ] All Ship24 calls routed through Edge Function
- [ ] Sentry DSN is the production project DSN (not dev)
- [ ] RevenueCat SDK uses production (not sandbox) keys
- [ ] All Supabase tables have RLS enabled — verify with:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = false;
  ```
  This should return zero rows.
- [ ] Run `eas build --profile production` — not preview or development
- [ ] Test purchase flow on TestFlight/Play Store internal track (not simulator)
- [ ] Verify push notifications deliver on real device

### Dependency review
```bash
bun audit
# or
npx expo install --check
```

### Privacy review
- [ ] Privacy manifest complete (iOS — required for App Store)
- [ ] `ITSAppUsesNonExemptEncryption: false` is set ✅ (already in `app.config.ts`)
- [ ] Location permission strings are specific and accurate ✅ (already good)
- [ ] No third-party SDKs collecting data without disclosure

---

## SECTION I — TOP 10 LAUNCH BLOCKERS

1. **Ship24 API key is public** — rotate key + move to Edge Function before launch
2. **`RORK_TOOLKIT_SECRET_KEY` is public** — rotate + move server-side
3. **All user profiles readable by all users** — push tokens, addresses, phones exposed
4. **Any user can send push to any user** — remove client-side push dispatch
5. **`__DEV__` purchase bypass** — grants free premium; removed in this audit
6. **Any user can update any open shipment** — massive data corruption risk
7. **Admin funnel accessible to all users** — business intelligence exposed
8. **Session tokens in unencrypted storage** — migrate to SecureStore
9. **Notifications insertable by any user** — spam vector
10. **No EAS environment separation** — dev builds could hit production DB

---

## SECTION J — TOP 10 QUICKEST WINS (do today)

1. ✅ **Remove `__DEV__` purchase bypass** — 1 line change (done in this audit)
2. ✅ **Guard admin-funnel with user ID check** — ~10 lines (done in this audit)
3. ✅ **Create production-safe logger** — replaces console.log app-wide (done in this audit)
4. ✅ **Fix notification dispatch** — remove client→Expo API call (done in this audit)
5. ✅ **Hardened RLS SQL** — run in Supabase SQL editor (provided in this audit)
6. **Rotate Ship24 key** — 5 minutes in Ship24 dashboard
7. **Rotate RORK_TOOLKIT_SECRET_KEY** — contact Rork support
8. **Change password minimum to 8 chars** — 1 line + Supabase Auth settings
9. **Update error message fallback** — prevent user enumeration in login.tsx
10. **Set `supabase.auth.signOut({ scope: 'global' })` on sign-out** — 1 line

---

## SECTION M — SECURITY HARDENING IMPLEMENTED (2026-06-08)

All six requirements from the security hardening pass have been resolved in code.

---

### M-1 — .gitignore expanded to block all env file variants ✅ FIXED

**File:** `.gitignore`

Previously only `.env` and `.env*.local` were blocked. A file named `.env.production`, `.env.staging`, or `.env.development` would have been committed. Now `.env.*` catches all variants. `.env.example` is explicitly allowed as a documented template.

```gitignore
.env
.env.*
.env*.local
!.env.example
```

---

### M-2 — Password minimum raised from 6 → 8 characters ✅ FIXED

**File:** `app/login.tsx`

Client-side validation now enforces a minimum of 8 characters on both sign-up and sign-in. Error copy updated to match. Also update Supabase Auth settings: Dashboard → Authentication → Password → Minimum length = 8.

---

### M-3 — Generic error message fallback prevents internal detail leaks ✅ FIXED

**File:** `app/login.tsx`

The `getSupabaseErrorMessage()` fallback previously returned the raw Supabase error string. Raw errors can surface internal schema details (table names, column names, constraint names). Fallback is now `'Something went wrong. Please try again.'`

---

### M-4 — signOut now revokes ALL sessions (scope: global) ✅ FIXED

**File:** `store/AppContext.tsx`

Changed `supabase.auth.signOut()` to `supabase.auth.signOut({ scope: 'global' })`. Without this, signing out only invalidates the local device session. A stolen refresh token on another device would remain active. Global scope invalidates all refresh tokens for the user across all devices.

---

### M-5 — Rate limiting added to track-shipment Edge Function ✅ FIXED

**File:** `supabase/functions/track-shipment/index.ts`

Added the existing `checkRateLimit` / `rateLimitResponse` shared utility (already used by `initiate-verification`, `create-connect-account`, `partner-payout`). Limit: 60 tracking lookups per 10 minutes per user. Prevents a single abusive account from exhausting the paid Ship24 API quota.

**Rate limit table:**

| Function | Limit | Window |
|---|---|---|
| `initiate-verification` | 3 | 10 min |
| `create-connect-account` | 5 | 10 min |
| `partner-payout` | 10 | 60 min |
| `track-shipment` | 60 | 10 min |

---

### M-6 — Open-redirect protection on Edge Function callback URLs ✅ FIXED

**Files:** `supabase/functions/initiate-verification/index.ts`, `supabase/functions/create-connect-account/index.ts`

Both functions accept `returnUrl` (and `refreshUrl`) from the request body and pass them to Stripe as the post-verification redirect target. Without validation, an attacker could craft a request that makes Stripe redirect to an arbitrary URL. Both functions now reject any URL that does not start with `porchivo://` with a 400 error.

---

### Note: Auth endpoint rate limiting

The user requirement specified "login and auth endpoints rate-limited in Cloudflare." Porchivo does not use Cloudflare — the stack is Supabase + Expo/React Native. Supabase Auth has built-in rate limiting on `/auth/v1/token`, `/auth/v1/signup`, etc. To tune these limits, go to: Supabase Dashboard → Project Settings → Auth → Rate limits. No code change required.

---

## SECTION L — LAUNCH FIXES IMPLEMENTED (2026-06-02)

The following 5 launch-blocking issues from the audit have been resolved in code:

---

### L-1 — SecureStore session token hardening ✅ FIXED

**File:** `lib/supabase.ts`

- Replaced the AsyncStorage-backed Supabase storage adapter with an `expo-secure-store` adapter.
- Large values (Supabase sessions routinely exceed the 2048-byte SecureStore limit) are transparently chunked across multiple SecureStore keys using a `${key}__chunks` + `${key}__N` pattern.
- Web builds fall back to `localStorage` (acceptable — web is not the primary target).
- Non-auth AsyncStorage usage elsewhere (UI preferences, install timestamp, onboarded flag) is intentionally left as-is per the SECTION G table.

**Verification:** Install the app on a real device, sign in, kill the process, reopen — session must be restored without re-login.

---

### L-2 — RevenueCat webhook → Supabase Edge Function (single source of truth) ✅ FIXED

**Files:** `supabase/functions/revenuecat-webhook/index.ts`, `store/AppContext.tsx`, `lib/revenueCat.ts`

- Created `supabase/functions/revenuecat-webhook/index.ts` — verifies `Authorization: Bearer <REVENUECAT_WEBHOOK_BEARER_TOKEN>`, parses RC lifecycle events, and upserts `is_premium` to `profiles` via service role.
- Removed **all** `saveProfileMutation.mutate({ is_premium: ... })` calls from the client. `is_premium` is now a server-only write.
- After purchase/restore, client invalidates `['profile', userId]` query so it re-reads the DB value set by the webhook.
- Added `loginRevenueCat(userId)` / `logoutRevenueCat()` in `lib/revenueCat.ts` and called from AppContext, ensuring RC's `app_user_id` matches the Supabase user ID in all webhook events.

**Required manual steps:**
1. `supabase secrets set REVENUECAT_WEBHOOK_BEARER_TOKEN=<random-32-char-string>`
2. `supabase functions deploy revenuecat-webhook`
3. RevenueCat Dashboard → Project → Integrations → Webhooks → Add endpoint:
   - URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: `Bearer <same-token-from-step-1>`
4. Select events: `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE_RESOLVED`, `UNCANCELLATION`, `TRANSFER`

---

### L-3 — Rate limiting on Supabase Edge Functions ✅ FIXED

**Files:** `supabase/rate-limit-migration.sql`, `supabase/functions/_shared/rateLimit.ts`, modified `initiate-verification`, `create-connect-account`, `partner-payout`

- Created `rate_limit_log` table and `increment_rate_limit` atomic upsert RPC.
- Shared `checkRateLimit` / `rateLimitResponse` utility at `supabase/functions/_shared/rateLimit.ts`.
- Applied to the three highest-value functions:

| Function | Limit | Window |
|---|---|---|
| `initiate-verification` | 3 calls | 10 min / user |
| `create-connect-account` | 5 calls | 10 min / user |
| `partner-payout` | 10 calls | 1 hour / user |

- Returns HTTP 429 with `{ error, code: "RATE_LIMIT_EXCEEDED", retryAfter, resetAt }` and `Retry-After` header.
- Fails open (allows request) if the DB is unreachable — never blocks legitimate users.

**Required manual step:**
Run `supabase/rate-limit-migration.sql` in Supabase SQL Editor.

---

### L-4 — Atomic account deletion transaction ✅ FIXED

**Files:** `supabase/delete-account-procedure.sql`, `store/AppContext.tsx`

- Created `delete_account_cascade()` SECURITY DEFINER stored procedure that deletes all user data in a single Postgres transaction: analytics_events, rate_limit_log, chat_messages, notifications, invoice_periods, partner_payouts, partner_assignments, partner_connections, partner_verifications, shipments, profiles, then auth.users.
- `AppContext.deleteAccount` now calls a single `supabase.rpc('delete_account_cascade')` and gets a typed `{ success, error? }` result.
- Partial-delete risk is eliminated — either everything is removed or nothing is (transaction rollback).

**Required manual step:**
Run `supabase/delete-account-procedure.sql` in Supabase SQL Editor.

---

### L-5 — EAS environment separation ✅ FIXED

**Files:** `eas.json`, `app.config.ts`, `lib/revenueCat.ts`

- Added `channel` per EAS build profile (`development`, `preview`, `production`) for OTA update track isolation.
- Added `EXPO_PUBLIC_APP_ENV` env var per profile so the value is available in the client bundle.
- `lib/revenueCat.ts` now selects the RevenueCat API key based on `EXPO_PUBLIC_APP_ENV`:
  - `development` / `preview` → uses `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` (sandbox)
  - `production` → uses `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `ANDROID_API_KEY` (live)
- This prevents dev/preview builds from generating real charges.

**Recommended additional step:**
Create separate Supabase projects for dev and prod. Set per-environment Supabase URL/anon key overrides via:
```bash
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <dev-url> --environment development
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <dev-anon-key> --environment development
```
This prevents dev data from ever touching the production database.

---

## SECTION K — COMMANDS TO RUN

```bash
# 1. Check for secrets in git history
git log --all --full-history -S "api_key" --oneline
git log --all --full-history -S "secret" --oneline

# 2. Verify RLS is enabled on all tables (run in Supabase SQL editor)
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

# 3. Install SecureStore for session storage
npx expo install expo-secure-store

# 4. Audit dependencies
bun audit

# 5. Verify no localhost URLs in production build
grep -r "localhost" app/ lib/ store/ config/ --include="*.ts" --include="*.tsx"

# 6. After rotating Ship24 key, remove EXPO_PUBLIC_SHIP24_API_KEY from all env configs
# and add SHIP24_API_KEY as a Supabase Edge Function secret:
supabase secrets set SHIP24_API_KEY=your_new_key
```
