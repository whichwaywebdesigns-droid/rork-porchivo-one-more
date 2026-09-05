# Prompt for Rork — Wire Up Porchivo's Email Triggers to Match Resend Templates

Paste everything below into Rork as one prompt.

---

I just finished building 22 transactional email templates in our Resend account (resend.com) for the Porchivo app. I need you to wire up the backend so the app actually fires these emails at the right moments, with the right data. Please implement the following:

## Setup

- Use the Resend Node SDK (`resend` npm package) with `RESEND_API_KEY` as an env var.
- Create a single email service module (e.g. `services/email.ts`) that exposes one function per template, each accepting a typed payload and calling Resend with the matching `template_id` and variables. Confirm the exact Resend "send via template" call signature against Resend's current docs — they've been iterating on this API, don't guess at parameter names.
- Every send needs these footer variables merged in automatically (don't make callers pass them every time): `company_address`, `support_email`, `unsubscribe_url`. Pull these from app config / the recipient's unsubscribe token.
- Every send also needs a unique `reference_number` — generate this in the email service, not by callers, and log it against the triggering record for support traceability.

## Templates, triggers, and required variables

For each row below: fire the email when the **Trigger** happens, pass exactly the **Variables** listed (names must match — they're baked into the template HTML as `{{snake_case}}`), and make sure the **CTA route** actually resolves to a real screen or deep link.

| Template (Resend ID) | Trigger | Variables to pass | CTA variable → where it should go |
|---|---|---|---|
| Account Deletion Confirmation (`7b22e47a-d069-45ad-b6d7-4d999e6f17a3`) | Account deletion finalizes (end of retention window, not the initial request) | `first_name`, `email`, `request_date`, `deletion_date`, `recovery_window` | `support_url` → support contact page |
| Porch Partner Request Received (`f8489094-77b5-4c96-9d7f-b64a2083d466`) | Neighbor A sends a Porch Partner request to Neighbor B | `first_name`, `requester_name`, `requester_address`, `start_date`, `end_date`, `package_count` | `request_url` → deep link to the request screen (accept/decline) |
| Porch Partner Request Accepted (`cb59f4da-b96a-443d-902b-1754f22d5dd3`) | Partner accepts → sent to the **requester** | `first_name`, `partner_name`, `partner_address`, `start_date`, `end_date` | `coverage_url` → coverage details screen |
| Porch Partner Request Declined (`49e26a80-a801-41ae-9289-59c5abdfffb6`) | Partner declines → sent to the **requester** | `first_name`, `partner_name`, `start_date`, `end_date`, `decline_reason` | `find_partner_url` → "find a Porch Partner" search screen |
| You've Been Added as a Porch Partner (`aa55c2e6-b724-4c1c-ab9c-842c511a1307`) | Same acceptance event as above, but sent to the **partner** themselves | `first_name`, `requester_name`, `requester_address`, `start_date`, `end_date` | `settings_url` → partner notification settings |
| High Risk Alert in Your Area (`b0ca0216-15f0-4ed8-8be5-df6902462239`) | Risk-detection job flags a spike in theft reports for a neighborhood | `first_name`, `neighborhood`, `radius`, `risk_level`, `incident_count`, `last_incident_time` | `risk_map_url` → in-app neighborhood risk map |
| Suspicious Activity Reported Near You (`816c7f3c-f73d-43e0-b1cd-014837a67b27`) | A neighbor submits a suspicious-activity report; nearby users notified | `first_name`, `location`, `report_time`, `activity_description`, `reporter_label` | `report_url` → report detail screen |
| Neighborhood Safety Digest (`15ceef92-b528-436a-97a4-b9e9c47c097f`) | Weekly scheduled cron job, per neighborhood | `first_name`, `neighborhood`, `packages_delivered`, `packages_at_risk`, `theft_reports`, `safest_window` | `digest_url` → full digest screen |
| Subscription Started / Upgraded (`ab9dddf7-7a40-4bbb-9d18-3e23d2387ad2`) | Billing webhook: subscription created or upgraded | `first_name`, `plan_name`, `upgrade_or_start` ("starting" / "upgrading to"), `billing_cycle`, `amount`, `next_billing_date` | `dashboard_url` → account/plan dashboard |
| New Member Joined Your Community (`4c0f785c-1735-4b65-b817-1cacfea7cc8d`) | New user finishes signup into an existing community/HOA | `first_name`, `member_name`, `member_address`, `join_date`, `community_name` | `directory_url` → community member directory |
| Community Admin Invitation (`6c7e0d60-ecea-41de-9d9e-27ed68780c35`) | Existing admin invites a new admin | `first_name`, `community_name`, `inviter_name`, `admin_role`, `expiry_date` | `accept_invite_url` → invite-acceptance deep link (must work for invitees who don't have an account yet) |
| Re-engagement (`31742da1-b531-4e33-8389-098d686361a9`) | Scheduled job: user inactive N days (pick your threshold, e.g. 30) | `first_name`, `days_inactive`, `last_active_date`, `lifetime_packages`, `partner_count` | `return_url` → app open / login deep link |
| Referral Reward Confirmation (`9384d07c-cae5-49cb-8a9e-002fb04599bb`) | Referral program: referred friend completes the qualifying action | `first_name`, `referred_name`, `reward_amount`, `reward_type`, `total_referrals` | `referral_url` → referral share screen |
| Milestone Email (`646531e9-4384-4ab5-8657-a6678f0bf71b`) | Lifetime packages-protected counter crosses a milestone (10/50/100/etc.) | `first_name`, `package_milestone`, `join_date`, `partner_uses`, `theft_attempts_blocked` | `stats_url` → stats/achievements screen |
| App Update / New Feature Announcement (`8c5e6d78-155f-46ff-b673-0c9ca99ddfa4`) | Manual/marketing send on release (broadcast to all users or a segment — not per-user automatic) | `first_name`, `feature_name`, `feature_description`, `platforms`, `app_version`, `release_date` | `update_url` → App Store / Play Store listing |
| HOA Pilot Welcome (`26401046-4a64-4381-b48c-e5a6285af393`) | Manual/sales-triggered when a new HOA pilot is signed | `first_name`, `community_name`, `pilot_start_date`, `unit_count`, `account_manager_name` | `hoa_dashboard_url` → HOA admin dashboard |
| Review Request (`ef78436a-6f95-4962-9995-ad7344114ab0`) | N days after a successful Porch Partner hand-off, if the user hasn't left a review yet | `first_name`, `item_name`, `partner_name`, `delivered_date` | `review_url` → App Store/Play Store review prompt, or in-app review screen |
| Package Arriving Today (`86bb7c58-e8d4-4e81-965f-ff665a583aee`) | Carrier tracking webhook: status = out for delivery, ETA today | `first_name`, `item_name`, `carrier_name`, `delivery_window`, `tracking_number` | `tracking_url` → live tracking screen |
| Package Picked Up by Porch Partner (`2b6c2547-5749-4d9a-83e8-9bb9dc8e5a7e`) | Partner marks the package as picked up in-app | `first_name`, `partner_name`, `item_name`, `pickup_time`, `partner_address` | `message_url` → in-app message thread with the partner |
| Package Left Too Long / At-Risk Alert (`4c30f947-fe0c-45a0-8fb0-5cb0025b28eb`) | Scheduled job: package delivered and unclaimed past your risk threshold (e.g. 2 hours) | `first_name`, `item_name`, `time_elapsed`, `risk_level`, `delivery_location` | `request_partner_url` → quick Porch Partner request flow |
| Package Reported Stolen (`ecca98b7-3a21-44de-9358-0578f4b952b4`) | User (or system) marks a package as stolen/missing | `first_name`, `item_name`, `last_seen_time`, `report_id`, `item_value` | `report_url` → theft report detail screen |
| Package Theft Resolved / Recovered (`d26e7d14-c2bc-4575-9cb2-5ac7f146bd70`) | Theft report status updated to recovered/resolved | `first_name`, `item_name`, `recovery_date`, `recovery_source`, `report_id` | `close_report_url` → report detail screen with a "close" action |

## Deep links / screens to confirm exist

Audit the routes list and add anything missing:

`request_url`, `coverage_url`, `find_partner_url`, `settings_url` (notifications), `risk_map_url`, `report_url` (used by both suspicious-activity and theft-report emails — make sure it routes correctly for each context), `digest_url`, `dashboard_url`, `directory_url`, `accept_invite_url`, `return_url`, `referral_url`, `stats_url`, `hoa_dashboard_url`, `review_url`, `tracking_url`, `message_url`, `request_partner_url`, `close_report_url`.

`update_url` is external (App/Play Store), not an in-app route.

## Guardrails

- Don't double-send: dedupe on the triggering event (e.g., don't fire "package at risk" repeatedly for the same package — send once, maybe re-alert once after a longer threshold).
- Respect per-category notification preferences if we have them (e.g., a user should be able to opt out of safety digests without opting out of security emails like account deletion).
- `community-admin-invitation`'s `accept_invite_url` must handle a recipient with no account yet — route to signup-then-accept, not a dead end.
- Log every send (template slug, recipient, reference_number, triggering record id) so support can trace a "did I get this email" question.

## When you're done

Give me a short summary of which triggers you wired up, which ones need a real event source we don't have yet (e.g., the risk-detection job, the referral program), and which deep-link routes didn't exist yet and what you created for them.
