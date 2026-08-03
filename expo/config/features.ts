/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    PORCHIVO — FEATURE FLAGS                             ║
 * ║                                                                          ║
 * ║  Turn features on or off without touching the rest of the codebase.     ║
 * ║  Each flag has a plain-English comment explaining exactly what it        ║
 * ║  controls and what happens when you flip it.                            ║
 * ║                                                                          ║
 * ║  HOW TO USE:                                                             ║
 * ║    Change true → false (or false → true) next to the feature name.     ║
 * ║    Save the file. The change takes effect next time the app loads.      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export const FEATURES = {

  // ── CORE FEATURES ──────────────────────────────────────────────────────────

  /**
   * PORCH RISK SCORE
   * The main feature — shows a 0–100 risk score for each incoming package.
   * Only turn this off if you're doing emergency maintenance on the scoring logic.
   * Default: ON
   */
  porchRiskScore: true,

  /**
   * THEFT SHIELD
   * The premium upsell anchor — the "Theft Shield" banner and unlock flow
   * on the Porch Risk screen. Turn off only if you're running a full-access
   * beta and don't want the paywall surfaced from the risk screen.
   * Default: ON
   */
  theftShield: true,

  /**
   * TODAY'S RISK CARD (on Home tab)
   * The card at the top of the home screen showing today's overall risk level.
   * Turning this off hides the card — the rest of the home screen stays intact.
   * Default: ON
   */
  todayRiskCard: true,

  /**
   * PACKAGE TRACKING (Ship24 integration)
   * Real carrier tracking via Ship24 API. If you're seeing API errors or
   * costs are too high, set to false — users will see their packages but
   * tracking events won't update.
   * Default: ON
   */
  liveTracking: true,

  /**
   * OUT-FOR-DELIVERY LIVE HERO
   * The animated OFD hero card that appears when a package is out for delivery.
   * A premium-feeling UI moment. Only turn off if it causes crashes.
   * Default: ON
   */
  ofdLiveHero: true,


  // ── COMMUNITY / SOCIAL FEATURES ────────────────────────────────────────────
  // These are secondary features. Keep them off during early beta if you want
  // users focused on the core package tracking + risk experience.

  /**
   * COMMUNITY ALERTS
   * Users can report and view porch theft alerts in their neighborhood.
   * The porch risk score uses active alert count, so if you turn this OFF,
   * alerts won't factor into risk scores (score defaults lower without that data).
   * Default: ON
   */
  communityAlerts: true,

  /**
   * PORCH PARTNERS
   * The neighbor-holds-your-package feature. Secondary to core experience.
   * Turning this off hides the "Invite a Partner" flows and removes partner
   * data from risk score calculation (score will be slightly higher for everyone).
   * Default: ON for now — hide during focused beta if it confuses users.
   * HIDDEN until neighborhood density is reached (see lib/featureFlags.ts PORCH_PARTNERS).
   */
  porchPartners: false,

  /**
   * NEIGHBORHOOD MAP
   * The full-screen map tab showing packages and alerts in the area.
   * This is data-heavy and battery-intensive. Turn OFF for beta to simplify
   * the navigation and reduce API load.
   * Default: OFF (hidden from beta users)
   */
  neighborhoodMap: false,

  /**
   * DELIVERY DRIVERS
   * The last-mile driver assignment flow. Experimental feature.
   * Turn OFF for beta — it's complex and shouldn't be in initial user testing.
   * Default: OFF
   */
  deliveryDrivers: false,

  /**
   * INVITE PARTNER FLOW
   * The SMS invite-a-neighbor feature from the home screen.
   * Turning off hides the "Invite" button on the home screen only.
   * Default: ON
   */
  invitePartner: false,


  // ── MONETIZATION ───────────────────────────────────────────────────────────

  /**
   * DAY-7 HARD PAYWALL
   * After 7 days, free users who haven't upgraded see a paywall they cannot skip.
   * This is your primary conversion mechanism.
   * Set to false during beta if you want all testers to have full access.
   * Default: ON
   */
  day7HardPaywall: true,

  /**
   * SOFT GATE / UPSELL CARDS
   * The inline upsell cards that appear within screens (e.g. on Porch Risk page).
   * These are gentler than the hard paywall — they suggest upgrading but don't block.
   * Default: ON
   */
  softGateUpsellCards: true,

  /**
   * REFERRAL PROGRAM
   * Users who refer a friend get 30 days of free premium.
   * Turn off if you want to pause the referral incentive.
   * Default: ON
   */
  referralProgram: true,

  /**
   * STORE REVIEW PROMPT
   * After certain positive actions, the app asks users to rate it on the App Store.
   * You want this ON — ratings directly affect App Store conversion.
   * Default: ON
   */
  storeReviewPrompt: true,


  // ── INTERNAL / ADMIN ───────────────────────────────────────────────────────

  /**
   * ADMIN FUNNEL SCREEN
   * An internal screen for viewing funnel analytics. Should NEVER be accessible
   * to regular users. Keep this false in production.
   * Default: OFF
   */
  adminFunnel: false,

  /**
   * VERBOSE LOGGING
   * Outputs detailed logs to the console. Useful when debugging issues.
   * Keep OFF in production — it can expose user data paths to logs.
   * Default: OFF (set to true temporarily when debugging a specific issue)
   */
  verboseLogging: false,

} as const;

export type FeatureKey = keyof typeof FEATURES;

/**
 * Check if a feature is enabled.
 * Usage: if (isEnabled('porchRiskScore')) { ... }
 */
export function isEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature];
}
