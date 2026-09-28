# Porchivo — Maestro UI test suite

Selectors in these flows are grounded in the current Android build
(versionCode 1788441601 / versionName 1.0.9): real tab labels
(Home / Payments / Requests / More), real login CTAs ("Send magic link",
"Developer login"), real onboarding CTAs, and the Safety screen's actual
titles ("Safety Score", "SAFETY FACTORS"). The `appId` matches the Play
identity `com.whichwayweblabs.porchivo` (debug builds use the same ID — no
`applicationIdSuffix` is set).

## Prerequisites

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
2. A running emulator or attached device (Android 13+ fine).
3. Install the app on it. Preferred (Windows/PowerShell): install the exact
   shipped build from the 1.0.9 AAB via bundletool. The AAB is signed with
   the debug keystore (see `signingConfig` in the release build type) and
   `build-apks` without `--ks` also signs with the debug keystore, so the
   signatures match:

   ```powershell
   java -jar bundletool.jar build-apks --bundle=.\Porchivo-1.0.9.aab --output=porchivo-109.apks --mode=universal
   java -jar bundletool.jar install-apks --apks=.\porchivo-109.apks
   ```

   If a differently-signed copy is already installed, uninstall it first or
   `install-apks` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.

   Fallback (gradle, from `android\`): `.\gradlew.bat :app:installDebug`
   — this is a native Kotlin/Compose app, so no Metro/dev server is needed.

## Credentials

- **No credentials are required by default.** The login flow uses the app's
  built-in **"Developer login"** bypass (`AppViewModel.developerLogin()`),
  which signs straight into the app — ideal for deterministic tests.
- **Optional email-OTP path:** supply a test account with
  `maestro test -e TEST_EMAIL=you@example.com ...`. If "Developer login" is
  ever removed, the flow falls back to entering the email and sending the
  magic link, then stops after "Check your email for a 6-digit code." —
  fully automating OTP retrieval needs an inbox hook (e.g. a runScript that
  fetches the code from a test mailbox API). Ask if you want that wired up.

## Running

Interactive (Maestro Studio — record/edit selectors with live feedback):

```bash
maestro studio
# then open any flow file from android/maestro/ in the Studio UI
```

Full suite:

```bash
maestro test android/maestro/run-all.yaml
```

Individual flows:

```bash
maestro test android/maestro/00-launch-onboarding.yaml
maestro test android/maestro/01-login.yaml
maestro test android/maestro/02-browse.yaml
maestro test android/maestro/03-safety-score.yaml
maestro test android/maestro/04-deep-links.yaml
```

## Design notes

- **Permissions are pre-denied** at cold launch (`permissions: all: deny`) so
  the `POST_NOTIFICATIONS` runtime dialog never stalls a run.
- Every onboarding interstitial is handled with `when: visible` conditionals
  ("Skip for now", "Not now", "Maybe later") so the flow survives copy or
  step-order changes.
- The safety-score flow waits out the gauge's 1.4 s entry sweep with
  `waitForAnimationToEnd` before asserting on the needle's accessibility text
  ("Safety score … out of 100 …").
- Deep-link flows intentionally assert **nothing on-screen** (the reset/org
  signup landing copy isn't stable enough to pin) — they navigate, settle,
  and capture screenshots for eyeball verification.
- Screenshots land in Maestro's test-output directory (path printed in the
  run summary).
