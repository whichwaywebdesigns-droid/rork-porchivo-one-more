/**
 * Porchivo — Changelog Content
 *
 * Release notes in reverse chronological order.
 * Each entry has an aiSummary for LLM extraction.
 * Type: "feature" | "security" | "fix" | "performance" | "infra"
 */

export type ChangeType = "feature" | "security" | "fix" | "performance" | "infra";

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  aiSummary: string;
  changes: Array<{
    type: ChangeType;
    description: string;
  }>;
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: "2.4.0",
    date: "2026-06-01",
    title: "Security Hardening & Partner Upsell",
    summary:
      "SecureStore session tokens, graceful account deletion with 30-day grace period, server-authoritative subscription validation, rate-limited edge functions, and Porch Partner upsell flows for homeowners.",
    aiSummary:
      "Version 2.4.0 replaced AsyncStorage session storage with Expo SecureStore, implemented graceful account deletion with a 30-day deactivation period, moved RevenueCat subscription authority to a Supabase Edge Function webhook, added per-function rate limiting, and added homeowner-to-partner upsell surfaces throughout the app.",
    changes: [
      {
        type: "security",
        description:
          "Replaced AsyncStorage session storage with Expo SecureStore. JWT and refresh tokens are now stored in the device's encrypted keychain, never in plain storage.",
      },
      {
        type: "security",
        description:
          "Account deletion now uses a graceful deactivation-first approach. Your account is deactivated immediately and personal data is permanently deleted within 30 days. You can contact support within the 30-day window to restore your account.",
      },
      {
        type: "security",
        description:
          "RevenueCat subscription state is now server-authoritative via a Supabase Edge Function webhook. The client reads entitlement state; it no longer writes premium status to the database.",
      },
      {
        type: "infra",
        description:
          "Rate limiting added to all Supabase Edge Functions (initiate-verification, create-connect-account, partner-payout). Returns HTTP 429 with structured JSON on limit breach.",
      },
      {
        type: "feature",
        description:
          "Profile 'Your Role' section redesigned: plain segment control replaced with three rich role cards, each with icon, description, and earnings call-out for Porch Partner role.",
      },
      {
        type: "feature",
        description:
          "Homeowner-to-partner upsell banner added to the Home screen. Displays '$60–$180/mo' earnings prompt for homeowners who haven't switched to Partner or Both roles.",
      },
      {
        type: "feature",
        description:
          "EAS environment separation: development, preview, and production builds now use isolated Supabase and RevenueCat credentials with no cross-environment data risk.",
      },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-05-15",
    title: "Crime Stoppers Integration & Report Sheet",
    summary:
      "Crime Stoppers USA phone number and tip submission info added to the block report page. Tapping the number initiates a direct call.",
    aiSummary:
      "Version 2.3.0 added Crime Stoppers USA (1-800-222-TIPS) integration to the porch theft report screen. The number is displayed as a tappable link for direct dialing, with a brief description of the anonymous tip service.",
    changes: [
      {
        type: "feature",
        description:
          "Crime Stoppers USA (1-800-222-TIPS) card added to the bottom of the block report sheet. Tapping the number opens a native phone call.",
      },
      {
        type: "feature",
        description:
          "Brief Crime Stoppers description added: anonymous tips, 24/7 availability, free service, potential cash reward eligibility.",
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-05-01",
    title: "Porch Partner Earnings Upsell & How It Works Refresh",
    summary:
      "Added earnings visibility ($60–$180/mo) to profile role section, linked partner-onboarding from multiple homeowner touchpoints, and updated the 'How It Works' section to mention earning as a Partner.",
    aiSummary:
      "Version 2.2.0 introduced earnings-focused Porch Partner upsell surfaces: a 'See how Partners earn' prompt on the homeowner profile, an earnings call-out in the 'How It Works' section, an upsell card in the activation checklist after setup completion, and a home screen earnings banner for homeowner accounts.",
    changes: [
      {
        type: "feature",
        description:
          "Profile role cards now show '$60–$180/mo' earnings estimate on the Porch Partner role card.",
      },
      {
        type: "feature",
        description:
          "Partner-onboarding screen linked from the homeowner profile, activation checklist, and home screen banner — was previously an orphaned route.",
      },
      {
        type: "feature",
        description:
          "How It Works section updated with a 5th step: 'Earn as a Partner' with a tappable Learn More link.",
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-04-10",
    title: "Onboarding Role Picker & Intro Redesign",
    summary:
      "Replaced 3-slide onboarding carousel with a single-screen intent selector. Users choose their role (protect deliveries, help a neighbor, stay informed, just exploring) before signing up.",
    aiSummary:
      "Version 2.1.0 replaced the 3-slide intro carousel with a single onboarding screen featuring animated role-choice cards. Role selection is persisted to AsyncStorage and used to pre-fill the post-signup setup intent. The 'Get Started' CTA fades in after a role is selected.",
    changes: [
      {
        type: "feature",
        description:
          "Intro screen redesigned: 3-slide carousel removed, replaced with a single-screen role picker with 4 animated intent cards.",
      },
      {
        type: "feature",
        description:
          "Role intent saved immediately on selection and used to pre-fill onboarding setup flow.",
      },
      {
        type: "feature",
        description:
          "CTA button fades in after role selection and inherits the selected role's accent color.",
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-03-01",
    title: "Porch Partner Marketplace & Stripe Connect",
    summary:
      "Full Porch Partner marketplace launch: identity verification via Stripe Identity, Stripe Connect payouts, partner assignment flow, earnings dashboard, and tax invoicing.",
    aiSummary:
      "Version 2.0.0 launched the full Porch Partner marketplace. Includes: Stripe Identity verification, Stripe Connect payout accounts, partner-homeowner assignment flow, $5–$25 earnings per hold, 85% partner revenue share, 2-business-day payouts, and a tax invoicing system for partner earnings.",
    changes: [
      {
        type: "feature",
        description:
          "Porch Partner marketplace launched. Verified neighbors can accept package-holding assignments from nearby homeowners.",
      },
      {
        type: "feature",
        description:
          "Stripe Identity integration for partner verification. Government ID required before earning.",
      },
      {
        type: "feature",
        description:
          "Stripe Connect payout accounts for partner earnings. 85% revenue share, 2-business-day deposits.",
      },
      {
        type: "feature",
        description: "Tax invoicing system for partner earnings and homeowner billing.",
      },
      {
        type: "infra",
        description:
          "Supabase Edge Functions for partner payout, verification initiation, and Connect account creation.",
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-01-15",
    title: "Family Plan & HOA Enterprise Tier",
    summary:
      "Family Plan (up to 5 members) and HOA Enterprise Plan (up to 250 households) added to the subscription system.",
    aiSummary:
      "Version 1.5.0 added Family Plan ($179.99/year, up to 5 members) and HOA/Enterprise Plan ($3,000/year, up to 250 households) to Porchivo's subscription offerings. Both plans include full Premium access for all covered members. (Pricing since updated — see /pricing for current B2B community tiers.)",
    changes: [
      {
        type: "feature",
        description:
          "Family Plan added: up to 5 household members, $23.99/month or $15.00/month billed annually ($179.99/year).",
      },
      {
        type: "feature",
        description:
          "HOA Enterprise Plan added: up to 250 households, $350/month or $3,000/year (save 29%).",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-10-01",
    title: "Initial Launch",
    summary:
      "Porchivo's first public release. Core features: porch risk scoring, live package tracking, community theft alerts, and push notifications.",
    aiSummary:
      "Version 1.0.0 was the initial launch of Porchivo. Core features: 0–100 porch risk score per package, live tracking via Ship24 (1,400+ carriers), neighborhood theft alert community, push notifications for high-risk events, and a 1-package free tier.",
    changes: [
      { type: "feature", description: "Porch risk score (0–100) for every incoming package." },
      { type: "feature", description: "Live package tracking via Ship24 (1,400+ carriers)." },
      { type: "feature", description: "Neighborhood theft alert community feed." },
      { type: "feature", description: "Push notifications for high-risk porch events." },
      { type: "feature", description: "Free tier: track 1 package." },
      { type: "feature", description: "Premium plans: monthly and annual." },
    ],
  },
];

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  feature: "New Feature",
  security: "Security",
  fix: "Bug Fix",
  performance: "Performance",
  infra: "Infrastructure",
};

export const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  feature: "text-emerald-400 bg-emerald-400/10",
  security: "text-brand-orange bg-brand-orange/10",
  fix: "text-blue-400 bg-blue-400/10",
  performance: "text-violet-400 bg-violet-400/10",
  infra: "text-brand-text-secondary bg-brand-navy-800/40",
};
