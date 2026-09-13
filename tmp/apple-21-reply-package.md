# Apple 2.1 Reply Package — Porchivo 1.0.7 (app 6797350605)

Two paste-ready texts. Copy from this file — do not retype (the Notes one has a hard 4,000-char limit).

---

## TEXT 1 — Resolution Center reply (App Review thread)

Paste into: App Store Connect → Distribution → App Review → the 2.1 message thread → composer at the bottom. Then ATTACH the screen recording to the same reply.

---

Dear App Review Team,

Thank you for the additional information request. Below we answer each point, and we have attached an unedited screen recording (one take, physical iPhone, portrait, ~4 minutes) demonstrating everything described.

1. PURPOSE AND INTENDED AUDIENCE
Porchivo is a package-safety platform for residential communities (homeowners associations and property managers). It helps communities track deliveries, alert residents to suspicious porch activity, and coordinate "Porch Partner" neighbors who can receive and hold deliveries safely. The intended audience is HOA boards, property managers, and adult residents of residential communities. Residents join free; communities subscribe on our website (porchivo.com) via Stripe — no purchase is made inside the app, and no subscription is needed to use the app's core features.

2. DEMO ACCOUNT — SIGN-IN WITHOUT EMAIL ACCESS
You can fully explore the app without receiving any email:
   Email: reviewer@porchivo.com
   Enter that email → tap "Send magic link" → when the code step appears, enter the demo code: 123456 → tap "Verify code".
This demo path works only for that reviewer address (validated server-side); real users receive a 6-digit code by email. The demo account arrives pre-seeded with sample shipments and a pending member request so every feature is immediately explorable. The same instructions are in App Review Information → Notes.

3. WHAT THE ATTACHED VIDEO SHOWS
   0:00 — Cold launch from the Home Screen
   0:12 — Sign-in using the demo code above (no inbox access required)
   1:00 — Home feed with seeded shipments (UPS out-for-delivery, FedEx in-transit, USPS delivered)
   1:20 — Shipment detail screen with tracking status
   1:45 — Admin moderation: More → Pending Members → approving a join request
   2:20 — Incident-report flow opened and browsed (not submitted)
   2:50 — Settings → Delete account sheet: information shown, then CANCELED (this account must remain available for your review)
   3:20 — Sign out → a brand-new account registered with a real email address, verified with the 6-digit code received in the Mail app → complete account deletion (confirm by typing DELETE)
The video was recorded on a physical iPhone from TestFlight build 38 — the same binary attached to version 1.0.7.

4. THIRD-PARTY SERVICES
   • Supabase — backend: database, authentication, file storage
   • Resend — transactional email delivery (magic-link codes, notifications)
   • Stripe — web billing for community subscriptions (checkout occurs on porchivo.com; the app contains no purchases)
   • Ship24 — carrier package-tracking events
   • PostHog — anonymous product analytics; Sentry — crash reporting
All user-generated content (incident reports, service requests, alerts) is visible only within the user's own community and can be reviewed and removed by that community's admins; new members can be approved or denied by admins before joining.

5. REGIONAL AVAILABILITY
Porchivo is operated by WhichWay Web Labs LLC (Indiana, United States) and is intended for users in the United States and Mexico; the app and website ship with full English and Spanish (es-MX) localization. The app is not a regulated service — it contains no finance, health, gambling, or lottery functionality.

6. ACCOUNT DELETION
Deletion is fully available in the app: Settings → Delete account → confirm by typing DELETE → the account is removed (demonstrated live in the video on a fresh account, end to end).

We are happy to provide anything further you may need. Thank you for your time.

Best regards,
WhichWay Web Labs LLC
support@porchivo.com · porchivo.com

---

## TEXT 2 — App Review Information → Notes (condensed, < 4,000 chars)

Paste into: version 1.0.7 → App Review Information → Notes. (Character count ~2,100 — safe.)

---

Porchivo is a package-safety platform for residential communities (HOAs and property managers): delivery tracking, porch-theft incident reports, and "Porch Partner" neighbors who can receive packages safely. Residents join free; communities subscribe on porchivo.com (Stripe, web checkout — no purchases in-app). Audience: HOA boards, property managers, adult residents. Operated by WhichWay Web Labs LLC (Indiana, USA) for the US and Mexico; full English + Spanish (es-MX) localization. Not a regulated service.

DEMO ACCESS (no email/inbox needed):
Email: reviewer@porchivo.com
Tap "Send magic link" → at the code step enter the demo code: 123456 → "Verify code".
This demo path works only for this reviewer address (server-validated); real users receive a 6-digit code by email. The account is pre-seeded with sample shipments and a pending member request so all features are immediately explorable. You will land in the community-admin view (Home / Payments / Requests / More tabs).

FEATURE HIGHLIGHTS TO TRY:
• Home: seeded shipments (UPS out-for-delivery, FedEx in-transit, USPS delivered) → tap one for the tracking detail screen
• More → Pending Members: approve/deny resident join requests (moderation)
• More → "File a porch incident": user-generated incident report flow (you may browse; no need to submit)
• Settings → Delete account: full in-app deletion, confirm by typing DELETE
• Settings → Sign out

A screen recording demonstrating launch, demo sign-in, tracking, member approval, the incident flow, and complete account deletion (on a separate fresh account) is attached to our reply in the Resolution Center.

Third-party services: Supabase (backend/auth/storage), Resend (transactional email), Stripe (web billing), Ship24 (carrier tracking), PostHog (analytics), Sentry (crash reporting).
