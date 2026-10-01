PORCHIVO — FULL PROJECT SNAPSHOT
Created: 2026-09-02 · Updated: 2026-10-01
Contains: expo/ (React Native), android/ (Kotlin), ios/ (Swift), web-porchivo-web/ (marketing web),
supabase/ (migrations + edge functions), metadata/, screenshots/, plus env and secret files.

=== CRITICAL: GOOGLE PLAY UPLOAD KEY (NOT INCLUDED in this archive) ===
The signing keystore lives ONLY on the owner's PC and in their backup vault — never commit it,
never put it in any archive, repo, or hosted download.

  Canonical file:   porchivo-upload.jks
  Alias:            porchivo-upload
  CN:               WhichWay Weblabs
  Cert SHA-1:       15:E4:E6:59:03:D3:09:D8:A6:F1:EF:9C:4E:8E:13:75:27:C4:C3:A8
  Cert SHA-256:     FB:FF:6D:D9:…:D0:1B:31  (verify the full hash against the password-manager record)
  Keystore file SHA-256: starts with ed89aad9

Passwords and the .jks itself are stored ONLY in the owner's password manager (+ one USB copy).
They are intentionally NOT written in this file or anywhere in the repo.

VERIFY before trusting any copy of the keystore:
  keytool -list -v -keystore porchivo-upload.jks
It must print cert SHA-1 15:E4:E6:59:… with CN=WhichWay Weblabs.

STOP — DO NOT SIGN / DO NOT UPLOAD if verification instead shows:
  - SHA-1 starting 92:F7:41:…  → the RETIRED Sep-2026 Google-reset key (new-upload-keystore.jks /
    alias upload2026). Superseded; any AAB signed with it will be rejected by Play.
  - CN=Android Debug           → a debug key. Never upload a debug-signed release.

Losing porchivo-upload.jks strands all future Play releases: upload-key resets are limited,
require Google identity verification, and cause release downtime. Back it up and verify the
backup restores (see MAINTENANCE.md).

=== RELEASE STATE (updated 2026-10-01) ===
- Android 1.0.11 (versionCode 1788441603) — Play Closed testing (Alpha, full rollout), changes in review.
- versionCode 1787757778 and earlier are permanently burned; never reuse.
- iOS 1.0.7 (build 37) — went through Apple review (historical; check App Store Connect for current).
- PostHog analytics live through managed proxy https://t.porchivo.com
  (IONOS CNAME t -> c5b5417c3c7ec1295616.cf-prod-us-proxy.proxyhog.com).
- A/B experiment "Home quick links layout v1" (flag home-quick-links-layout-v1) running, 100% rollout.

=== SENSITIVE FILES INCLUDED (this archive contains secrets) ===
- expo/.env, android/.env  (Supabase tokens, RevenueCat keys)
- tmp/fn_internal_secrets.env  (edge-function secrets)
- tmp/payment_test_state.json  (test-user/payment record)
Delete this download from the hosting location once you have stored it safely.
NOTE (2026-10-01): the live keys previously leaked via the public GitHub repo were rotated;
values in any old snapshot copies are dead — keep only current secrets in the password manager.
