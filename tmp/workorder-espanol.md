# Rork Prompt — Integrate Spanish Resend Templates into Porchivo

Paste everything below into Rork as one prompt.

---

## Context

Today's session in Resend produced Spanish (`Espanol`) versions of Porchivo's core lifecycle/notification email templates. Before writing any code, verify the current live state — do not assume any of the following is already wired up:

1. Whether `profiles` (or wherever user records live) already has a language/locale field.
2. Where outbound transactional emails are actually triggered from — expected locations based on prior work: `send-notification`, `stripe-webhook`, `revenuecat-webhook`, and `connect-webhook` Supabase Edge Functions, plus any client-side calls to the Resend API.
3. How the Resend template alias is currently selected/hardcoded in that code today.

Report back what you find before making changes if it differs from the assumptions below. This is a Heavy-tier change (touches notification delivery across subscription, safety-alert, and partner-request flows) — follow Plan → Build → Test → Review → Ship, and confirm before deploying edge function changes to production.

## What exists in Resend right now

Naming convention: every Spanish template's alias is the English template's alias with `-espanol` appended. Use that pattern for the mapping table, not free-form guessing.

**Published and ready to use (English alias → Spanish alias):**

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

**NOT ready — still a Draft, do not route to it yet:**

- `milestone-email` → `milestone-email-espanol` exists but is stuck in **Draft**. Its body uses `{{first_name}}`, `{{package_milestone}}`, and `{{join_date}}` merge tags, but Resend shows "No variables" registered on the template — the variable schema wasn't saved. Fix that in Resend (or flag it back to me) and confirm it publishes before wiring it in. Until then, keep `milestone-email` (English) as the only live path for this event, regardless of user locale.

**Ignore / cleanup:**

- There is an orphaned draft called `High Risk Alert in Your Area (Copy)` (alias `high-risk-alert-in-your-area-copy`) — it's a leftover duplicate from today's work, still in English, no variables set. It is not part of any mapping and should not be referenced anywhere. Flag it for deletion, don't build around it.

**No Spanish version yet — fall back to English for these until told otherwise:**

- `app-update-new-feature-announcement`
- `hoa-pilot-welcome`
- `review-request`
- `package-arriving-today`
- `package-picked-up-by-porch-partner`
- `package-left-too-long-at-risk-alert`
- `package-theft-resolved-recovered`

(There's also an older batch of 13 generic system templates — welcome/onboarding, password reset, billing, etc. — that have no Spanish versions and weren't part of today's batch. Leave those on English only; they're a separate future task, not part of this integration.)

## What to build

1. **Locale field.** If `profiles` doesn't already have a language preference field, add one (e.g. `preferred_language`, values `en` / `es`, default `en`). Write this as a plain `.sql` migration file for manual review/apply — do not auto-run it against the live database, per our usual migration process (no tracked migration history, manual apply only).

2. **Capture the preference.** Add a language toggle in onboarding (or Settings, whichever is less invasive to the existing flow — your call, but tell me which) so users can set English or Spanish. Default to device locale at signup if nothing is set.

3. **Central template resolver.** Build one shared function (not copy-pasted per edge function) that takes an event key and a user's `preferred_language`, and returns the correct Resend template alias using the mapping table above — falling back to the English alias when：
   - the user's locale is `es` but no Spanish template exists yet for that event, or
   - the Spanish template exists but is still in Draft (treat `milestone-email` as English-only per above until I confirm it's published).

   Have every email-sending call site (`send-notification`, `stripe-webhook`, `revenuecat-webhook`, `connect-webhook`, and any client-side Resend calls) go through this resolver instead of hardcoding an alias.

4. **QA before shipping.** Send yourself test emails for at least three trigger types (one safety alert, one Porch Partner flow, one subscription/billing flow) with a test user set to `es`, and confirm the Spanish alias actually fires and renders correctly. Do the same for `en` to make sure nothing regressed. Report results before calling this done.

5. **Report back:** which call sites you changed, the exact migration SQL (if a locale field was added), and a short list of anything you found in the live code that contradicted the assumptions above.
