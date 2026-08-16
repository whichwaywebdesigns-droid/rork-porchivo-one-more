/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    PORCHIVO — FOUNDER CONTROL PANEL                     ║
 * ║                                                                          ║
 * ║  This is the single file you need to change for 90% of maintenance       ║
 * ║  tasks. Prices, limits, trial length, risk thresholds, support info —    ║
 * ║  all here. Everything has a plain-English comment explaining what it     ║
 * ║  does and what happens when you change it.                               ║
 * ║                                                                          ║
 * ║  RULE: If you only change one file, change this one.                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — PRICING & SUBSCRIPTIONS
//
// ⚠️  LEGACY — NO IAP ACTIVE
//     Porchivo has moved to a B2B community subscription model. Residents
//     are always free — no in-app purchases, no paywall, no upgrade screen.
//     HOAs and property managers subscribe via Stripe Checkout (see the
//     create-org-checkout edge function and org-signup screen for live pricing).
//
//     These constants are retained for import compatibility with tiers.ts
//     and onboardingExperiments.ts, but are NOT used for any billing.
//     The PaywallContext has been neutralized — guardPremiumAccess() always
//     grants access. Do not surface these prices to users.
// ─────────────────────────────────────────────────────────────────────────────
export const PRICING = {

  monthly: {
    // The price shown on the paywall for the monthly plan
    // ⚠️  Update App Store Connect to match: target Tier 14 (~$13.99)
    displayPrice: '$13.99',
    // The "/mo" label used in plan comparisons
    perMonthLabel: '$13.99/mo',
    // MUST match the product ID set in RevenueCat and the App Store exactly
    productId: 'premium_monthly',
    // No trial on monthly — hard paywall strategy.
    // Trials on monthly train users to expect free; push them to annual instead.
    trialDays: 0,
  },

  annual: {
    // The price shown for the annual plan
    // $99.99/yr = $8.33/mo  →  Save 40% vs monthly
    // Kept under $100 on purpose — clears the three-figure psychological barrier
    // for ~1% less revenue than $100.99.
    // ⚠️  Update App Store Connect to match: target Tier 99 (~$99.99)
    displayPrice: '$99.99',
    // Shown in the plan card as the monthly equivalent (divide annual by 12)
    perMonthLabel: '$8.33/mo',
    // MUST match the product ID set in RevenueCat and the App Store exactly
    productId: 'premium_annual',
    // 7-day trial on annual only — closes the annual sale.
    // Users who start an annual trial rarely cancel; LTV is 12× monthly.
    trialDays: 7,
    // Calculate: 100 - ((99.99 / (13.99 * 12)) * 100) ≈ 40%
    savingsLabel: 'Save 40%',
    // Annual is the plan we push hardest. Keep this true.
    isFeatured: true,
  },

  lifetime: {
    // One-time unlock — premium forever
    // ⚠️  Update App Store Connect to match: $500
    displayPrice: '$500',
    productId: 'porchivo_lifetime',
    // When true, lifetime is hidden from the main paywall.
    // Set to false to show it prominently on the paywall.
    // Optimal: surface as a visible third card for high-intent buyers.
    hideFromMainPaywall: false,
  },

  // Shown to users who previously had premium and let it lapse (win-back offer)
  winback: {
    label: 'Save 40% for 3 months',
    // This is a display label — set the actual promo in RevenueCat dashboard
    displayPrice: '$7.99/mo',
  },

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — FREE TIER LIMITS
//
// These control what free users can do before they're pushed to upgrade.
// Making these more generous = better retention but fewer upgrades.
// Making them tighter = more upgrade pressure but risk of frustration.
// ─────────────────────────────────────────────────────────────────────────────
export const FREE_LIMITS = {

  // Max number of packages a free user can track at once.
  // When they hit this limit they see an upgrade prompt.
  // Hard paywall strategy: 1 package lets the user feel the tracking
  // experience immediately, then gates the second package behind premium.
  // This is the fastest path to the upgrade moment — user adds package #1,
  // experiences the value, then hits the wall before package #2.
  maxPackages: 1,

  // How often (in milliseconds) free users' tracking data refreshes.
  // 600000 = 10 minutes. Premium users get 90 seconds.
  // Higher number = less server load but stalier data for free users.
  pollIntervalMs: 600_000,

  // How many shared recipients a free user can add to a package
  sharedRecipients: 1,

  // Number of free porch-risk checks per day (not currently enforced in UI,
  // but referenced for future rate limiting)
  riskChecksPerDay: 3,

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — PAYWALL TRIGGERS & TIMING
//
// These control WHEN users are shown the upgrade screen.
// ─────────────────────────────────────────────────────────────────────────────
export const PAYWALL_TIMING = {

  // After this many days, free users see a hard paywall they can't skip.
  // Hard paywall strategy: 3 days is the sweet spot — users have seen the value
  // (tracking, risk scores, theft alerts) but haven't formed a free habit.
  // Day 7 is too late; it trains users that the app is free for a week.
  day7HardPaywallDays: 3,

  // Referral credit: when a user is referred, they get this many days of free premium
  referralCreditDays: 30,

  // How long (ms) to wait before showing the day-7 paywall after app load
  // 800ms gives the home screen time to render first so it doesn't feel jarring
  day7DelayMs: 800,

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — RISK SCORE THRESHOLDS
//
// The porch risk score goes from 0 (no risk) to 100 (very high risk).
// These thresholds decide what label and color the score gets.
//
// HOW TO ADJUST:
//   Raise the 'high' threshold if users are complaining the score is always red.
//   Lower it if you want to create more urgency.
// ─────────────────────────────────────────────────────────────────────────────
export const RISK_THRESHOLDS = {

  // Score >= this value shows as HIGH risk (red)
  high: 65,

  // Score >= this value shows as MEDIUM risk (amber)
  // Scores below this are LOW risk (green)
  medium: 35,

  // Base score every package starts with before factors are applied
  baseScore: 30,

  // Score adjustments for each risk factor.
  // Positive = increases risk. Negative = decreases risk.
  factors: {
    manyActiveAlerts: +28,    // 3+ theft alerts on block
    someActiveAlerts: +14,    // 1–2 theft alerts on block
    noActiveAlerts: -6,       // No alerts (good signal)
    highDeliveryTraffic: +12, // 6+ deliveries this week on block
    lateDeliveryWindow: +14,  // Delivered after 4pm
    earlyDeliveryWindow: -4,  // Delivered before 4pm (daytime, safer)
    noPorchPartner: +8,       // No neighbor assigned
    hasPorchPartner: -22,     // Neighbor is holding the package
    hasDriver: -8,            // Trusted driver assigned
    hasDropInstructions: -4,  // User added drop notes
  },

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — PREMIUM POLLING
//
// How often premium users' tracking data auto-refreshes in the background.
// Lower = fresher data but more API calls and battery usage.
// ─────────────────────────────────────────────────────────────────────────────
export const POLLING = {
  // Premium users: refresh every 90 seconds
  premiumIntervalMs: 90_000,
  // Free users: refresh every 10 minutes (see FREE_LIMITS above)
  freeIntervalMs: FREE_LIMITS.pollIntervalMs,
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — SUPPORT & CONTACT INFO
//
// Update these whenever your support email or social handles change.
// These values are used throughout the app wherever contact info appears.
// ─────────────────────────────────────────────────────────────────────────────
export const SUPPORT = {

  // Primary support email shown in the app (Profile → Help, error states, etc.)
  email: 'support@porchivo.com',

  // Used in the "Report a Bug" flow
  bugReportEmail: 'bugs@porchivo.com',

  // Twitter / X handle (without the @)
  twitterHandle: 'porchivo',

  // Your app's website URL
  websiteUrl: 'https://porchivo.com',

  // Privacy policy URL (required for App Store)
  privacyPolicyUrl: 'https://porchivo.com/privacy',

  // Terms of service URL (required for App Store)
  termsUrl: 'https://porchivo.com/terms',

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — APP STORE LINKS
//
// Used in share sheets and "Rate the App" prompts.
// Fill these in once your apps are live in the stores.
// ─────────────────────────────────────────────────────────────────────────────
export const STORE_LINKS = {

  // Your App Store product page URL.
  // ⚠️  HOW TO GET YOUR APPLE APP ID:
  //   1. Log in to App Store Connect → My Apps → Porchivo
  //   2. The numeric App ID is in the URL: .../apps/[NUMERIC_ID]/...
  //      or under App Information → Apple ID on the left sidebar.
  //   3. Replace the number below with that value.
  // Current: real ID pending first public build approval.
  ios: 'https://apps.apple.com/app/porchivo/id6760732057',

  // Your Google Play product page URL
  // Bundle identifier: com.whichwayweblabs.porchivo
  android: 'https://play.google.com/store/apps/details?id=com.whichwayweblabs.porchivo',

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — SOCIAL PROOF
//
// Numbers shown in the onboarding and paywall to build trust.
// Update these as your user base grows.
//
// ⚠️  Keep these truthful or clearly directional.
//     Using fake numbers is an App Store violation and hurts trust.
// ─────────────────────────────────────────────────────────────────────────────
export const SOCIAL_PROOF = {

  // Shown on the welcome screen: "Trusted on X porches"
  // Update this as you grow. Format: '12,000+' or '500+'
  // ⚠️  Keep this truthful — fake numbers violate App Store rules.
  porchesProtected: 'Beta launch',

  // Shown on intro slides / paywall
  // Source: USPS/CargoNet data — "119M packages stolen annually in the US"
  packagesStoredStat: '119M',

  // "1 in X packages stolen" ratio used in onboarding
  stolenRatio: '1 in 5',

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — FAMILY PLAN
//
// ⚠️  LEGACY — No IAP active. Residents are always free. Community features
//     are unlocked by HOA/property manager B2B subscriptions via Stripe.
//     This constant is retained for import compatibility only.
// ─────────────────────────────────────────────────────────────────────────────
export const FAMILY_PLAN = {
  maxMembers: 5,
  monthly: {
    // $23.99/mo for up to 5 household members — no trial on monthly (hard paywall)
    // ⚠️  Update App Store Connect to match: ~$23.99
    displayPrice: '$23.99',
    perMonthLabel: '$23.99/mo',
    productId: 'family_monthly',
    trialDays: 0,
  },
  annual: {
    // $179.99/yr = $15.00/mo  →  Save 37% vs monthly
    // Trial on annual only — same strategy as Premium
    // ⚠️  Update App Store Connect to match: ~$179.99
    displayPrice: '$179.99',
    perMonthLabel: '$15.00/mo',
    productId: 'family_annual',
    trialDays: 7,
    savingsLabel: 'Save 37%',
  },
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — PAYWALL ROUTING BY ROLE
//
// Controls WHICH plan tier each onboarding role is shown on the first paywall.
// During onboarding we ask the user their role (Resident / Property Manager /
// Staff / Other). We then surface the tier that fits how they actually buy:
//
//   • resident / other  → individual Premium  (the personal package tracker)
//   • staff             → Family              (a small team / front-desk plan)
//   • property_manager  → Enterprise / HOA    (whole-building operations)
//
// This protects the consumer price for residents while surfacing the
// high-value tier to the buyer who can actually justify it. The full plan
// grid (with every tier) is still reachable from the in-app upgrade screen —
// this only decides the *first* paywall the user lands on after onboarding.
//
// HOW TO CHANGE: point a role at a different tier below. Valid tiers are
// 'premium', 'family', or 'enterprise'.
// ─────────────────────────────────────────────────────────────────────────────
export const PAYWALL_ROUTING = {
  resident: 'premium',
  other: 'premium',
  staff: 'family',
  property_manager: 'enterprise',
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — ENTERPRISE / HOA PLAN
//
// ⚠️  B2B pricing is now defined in the create-org-checkout edge function
//     and the org-signup screen. The values below are LEGACY and retained
//     for import compatibility with tiers.ts only. They are NOT used for
//     billing. For current B2B pricing, see:
//     - supabase/functions/create-org-checkout/index.ts (PLANS constant)
//     - expo/app/org-signup.tsx (PLANS constant)
//
// Current B2B tiers (source of truth = edge function):
//   Starter:      $79/mo  |  $756/yr   |  50 units
//   Community:    $199/mo |  $1,908/yr |  200 units
//   Professional: $399/mo |  $3,828/yr |  500 units
//   Enterprise:   $599/mo |  $5,748/yr |  2,000 units
// ─────────────────────────────────────────────────────────────────────────────
export const ENTERPRISE_PLAN = {
  // Max households covered under one community subscription
  maxHouseholds: 250,

  monthly: {
    // Legacy — not used for billing. See edge function for live pricing.
    displayPrice: '$599',
    perMonthLabel: '$599/mo',
    productId: 'enterprise_monthly',
  },

  annual: {
    // Legacy — not used for billing. See edge function for live pricing.
    displayPrice: '$5,748',
    perMonthLabel: '$479/mo',
    productId: 'enterprise_annual',
    trialDays: 0,
    savingsLabel: 'Save 20%',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12 — WHICHWAY TRUST ENGINE
//
// The Trust Engine is a continuous compliance operating system that turns the
// existing stack (Supabase, GitHub Actions, Stripe, Expo, Edge Functions) into
// a live, self-documenting evidence pipeline. It runs an agentic monitoring
// loop: monitor → collect evidence → detect drift → remedy → repeat.
//
// SCENARIO B GATING:
//   Trust Engine is available ONLY in the Enterprise tier.
//   It is NOT in Free, Premium, or Family.
//   Residents tracking Amazon packages will never perceive compliance as worth
//   paying for — bundling it into Premium would inflate consumer price and hurt
//   conversion, or seriously undervalue the engine.
//
// The agentic loop runs continuously in the background while the Enterprise
// dashboard is open, checking controls, collecting evidence, and flagging drift
// in real time. Each cycle produces audit-grade evidence stored in the vault.
// ─────────────────────────────────────────────────────────────────────────────
export const TRUST_ENGINE = {
  // Which tiers get the Trust Engine. Currently Enterprise only (Scenario B).
  enabledTiers: ['enterprise'] as const,

  // How often the monitoring loop runs a full cycle (ms).
  // 60_000 = 1 minute. Each cycle: evaluate controls → collect evidence →
  // detect drift → generate remedies → update posture score.
  loopIntervalMs: 60_000,

  // Frameworks supported by the Trust Engine
  frameworks: ['SOC 2 Type II', 'HIPAA', 'ISO 27001', 'PCI DSS'] as const,

  // Default framework enabled on first activation
  defaultFramework: 'SOC 2 Type II' as const,

  // How long evidence is considered fresh before it needs recollection (ms)
  // 86_400_000 = 24 hours. Stale evidence triggers a recollection cycle.
  evidenceFreshnessMs: 86_400_000,

  // Severity thresholds for the posture score (0–100)
  postureThresholds: {
    critical: 40,  // Below this = critical, immediate action needed
    warning: 70,   // Below this = warning, remediation needed
    healthy: 85,   // At or above = healthy, audit-ready
  } as const,
} as const;
