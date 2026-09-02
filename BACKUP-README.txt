PORCHIVO — FULL PROJECT SNAPSHOT
Created: 2026-09-02
Contains: expo/ (React Native), android/ (Kotlin), ios/ (Swift), web-porchivo-web/ (marketing web),
supabase/ (migrations + edge functions), metadata/, screenshots/, plus env and secret files.

=== CRITICAL: GOOGLE PLAY UPLOAD KEY (NOT INCLUDED in this archive) ===
The signing keystore could not be captured in this snapshot — YOU hold the only copy:
  File:      new-upload-keystore.jks   (the copy you downloaded after the Google key reset)
  Password:  33mikaal26!
  Alias:     upload2026
  CN:        WhichWay Weblabs
  SHA-1:     92:F7:41:14:57:30:23:B9:16:53:36:ED:47:F8:8B:69:01:26:F1:28
  Valid from: Sep 2, 2026 3:35 AM UTC
Store this file + password in a password manager or cloud vault. Losing it strands
all future Play releases (upload-key resets are limited).

=== RELEASE STATE (as of snapshot) ===
- Android 1.0.8 (versionCode 1787757779) — IN GOOGLE PLAY REVIEW (closed Alpha).
  NOTE: versionCode 1787757778 and earlier are permanently burned; never reuse.
- iOS 1.0.7 (build 37) — IN APPLE REVIEW (WAITING_FOR_REVIEW).
- PostHog analytics live through managed proxy https://t.porchivo.com
  (IONOS CNAME t -> c5b5417c3c7ec1295616.cf-prod-us-proxy.proxyhog.com).
- A/B experiment "Home quick links layout v1" (flag home-quick-links-layout-v1) running, 100% rollout.

=== SENSITIVE FILES INCLUDED (this archive contains secrets) ===
- expo/.env, android/.env  (Supabase tokens, RevenueCat keys)
- tmp/fn_internal_secrets.env  (edge-function secrets)
- tmp/payment_test_state.json  (test-user/payment record)
Delete this download from the hosting location once you have stored it safely.
