# Rork Prompt — Integrate Spanish Resend Templates into Porchivo

Paste everything below into Rork as one prompt.

---

## Context

Porchivo's full template set in Resend is now built out: 36 English templates and 36 Spanish (`Espanol`) counterparts, covering every lifecycle, safety-alert, Porch Partner, subscription/billing, and system email in the app. Before writing any code, verify the current live state — do not assume any of the following is already wired up:

1. Whether `profiles` (or wherever user records live) already has a language/locale field.
2. Where outbound transactional emails are actually triggered from — expected locations based on prior work: `send-notification`, `stripe-webhook`, `revenuecat-webhook`, and `connect-webhook` Supabase Edge Functions, plus any client-side calls to the Resend API.
3. How the Resend template alias is currently selected/hardcoded in that code today.

Report back what you find before making changes if it differs from the assumptions below. This is a Heavy-tier change (touches notification delivery across subscription, safety-alert, and partner-request flows) — follow Plan → Build → Test → Review → Ship, and confirm before deploying edge function changes to production.

## What exists in Resend right now

Naming convention: every Spanish template's alias is the English template's alias with `-espanol` appended (a few older English aliases carry a legacy `-1` suffix from earlier renames — the Spanish alias drops that suffix, per the table below; use the exact aliases listed, don't derive them mechanically).

**Published and ready to use — all 36 event pairs (English alias → Spanish alias):**

| Event | English alias | Spanish alias |
|---|---|---|
| Package reported stolen | `package-reported-stolen` | `package-reported-stolen-espanol` |
| Package reported missing | `package-reported-missing` | `package-reported-missing-espanol` |
| Account deletion confirmation | `account-deletion-confirmation` | `account-deletion-confirmation-espanol` |
| Porch Partner request received | `porch-partner-request-received` | `porch-partner-request-received-espanol` |
| Porch Partner request accepted | `porch-partner-request-accepted` | `porch-partner-request-accepted-espanol` |
| Porch Partner request declined | `porch-partner-request-declined-1` | `porch-partner-request-declined-espanol` |
| Added as a Porch Partner | `youve-been-added-as-a-porch-partner` | `youve-been-added-as-a-porch-partner-espanol` |
| High risk alert in your area | `high-risk-alert-in-your-area` | `high-risk-alert-in-your-area-espanol` |
| Suspicious activity reported nearby | `suspicious-activity-reported-near-you` | `suspicious-activity-reported-near-you-espanol` |
| Neighborhood safety digest | `neighborhood-safety-digest` | `neighborhood-safety-digest-espanol` |
| Subscription started/upgraded | `subscription-started-upgraded` | `subscription-started-upgraded-espanol` |
| New member joined your community | `new-member-joined-your-community` | `new-member-joined-your-community-espanol` |
| Community admin invitation | `community-admin-invitation` | `community-admin-invitation-espanol` |
| Re-engagement | `re-engagement` | `re-engagement-espanol` |
| Referral reward confirmation | `referral-reward-confirmation` | `referral-reward-confirmation-espanol` |
| App update / new feature announcement | `app-update-new-feature-announcement` | `app-update-new-feature-announcement-espanol` |
| HOA pilot welcome | `hoa-pilot-welcome` | `hoa-pilot-welcome-espanol` |
| Review request | `review-request` | `review-request-espanol` |
| Package arriving today | `package-arriving-today` | `package-arriving-today-espanol` |
| Package picked up by Porch Partner | `package-picked-up-by-porch-partner` | `package-picked-up-by-porch-partner-espanol` |
| Package left too long / at-risk alert | `package-left-too-long-at-risk-alert` | `package-left-too-long-at-risk-alert-espanol` |
| Package theft resolved / recovered | `package-theft-resolved-recovered` | `package-theft-resolved-recovered-espanol` |
| Porchivo Welcome | `porchivo-welcome-1` | `porchivo-welcome-espanol` |
| Welcome to Porchivo | `welcome-to-porchivo-1` | `welcome-to-porchivo-espanol` |
| Getting started | `getting-started-1` | `getting-started-espanol` |
| Beta welcome | `beta-welcome` | `beta-welcome-espanol` |
| Package shipped | `package-shipped` | `package-shipped-espanol` |
| Package received | `package-received` | `package-received-espanol` |
| Trial ending soon | `trial-ending-soon` | `trial-ending-soon-espanol` |
| Security alert | `security-alert` | `security-alert-espanol` |
| Password reset | `password-reset` | `password-reset-espanol` |
| Email verification | `email-verification` | `email-verification-espanol` |
| Subscription canceled | `subscription-canceled` | `subscription-canceled-espanol` |
| Payment failed | `payment-failed` | `payment-failed-espanol` |
| Subscription renewal notice | `subscription-renewal-notice` | `subscription-renewal-notice-espanol` |

**One exception — NOT fully ready yet:**

- `milestone-email` (English) is Published and fine to use for all users regardless of locale. But `milestone-email-espanol` is still sitting in **Draft** in Resend as of this writing — do not route Spanish-locale users to it yet. Fall back to the English `milestone-email` alias for this one event until I confirm the Spanish version has been published, then flip it over.

**Ignore / cleanup:**

- There is still an orphaned draft called `High Risk Alert in Your Area (Copy)` (alias `high-risk-alert-in-your-area-copy`) sitting in Resend — a leftover duplicate, still in English, no variables set, still in Draft. It is not part of any mapping and should not be referenced anywhere. Flag it for deletion, don't build around it.

## What to build

1. **Locale field.** If `profiles` doesn't already have a language preference field, add one (e.g. `preferred_language`, values `en` / `es`, default `en`). Write this as a plain `.sql` migration file for manual review/apply — do not auto-run it against the live database, per our usual migration process (no tracked migration history, manual apply only).

2. **Capture the preference.** Add a language toggle in onboarding (or Settings, whichever is less invasive to the existing flow — your call, but tell me which) so users can set English or Spanish. Default to device locale at signup if nothing is set.

3. **Central template resolver.** Build one shared function (not copy-pasted per edge function) that takes an event key and a user's `preferred_language`, and returns the correct Resend template alias using the mapping table above — falling back to the English alias when:
   - the user's locale is `es` but the event is `milestone-email` (Spanish version still in Draft — see exception above), or
   - any future event is added to the mapping before its Spanish counterpart is published (build the resolver to treat "alias not found or not Published" as a safe fallback to English generally, not just as a one-off special case for milestone).

   Have every email-sending call site (`send-notification`, `stripe-webhook`, `revenuecat-webhook`, `connect-webhook`, and any client-side Resend calls) go through this resolver instead of hardcoding an alias.

4. **QA before shipping.** Send yourself test emails for at least four trigger types (one safety alert, one Porch Partner flow, one subscription/billing flow, one system/account flow like password reset or email verification) with a test user set to `es`, and confirm the Spanish alias actually fires and renders correctly. Do the same for `en` to make sure nothing regressed. Also confirm a test send for `milestone-email` correctly stays on the English alias even when the test user is set to `es`. Report results before calling this done.

5. **Report back:** which call sites you changed, the exact migration SQL (if a locale field was added), confirmation of the `milestone-email` fallback behavior, and a short list of anything you found in the live code that contradicted the assumptions above.
