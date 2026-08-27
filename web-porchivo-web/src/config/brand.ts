/**
 * Porchivo — Central Brand Entity Config
 *
 * Single source of truth for all brand identity data.
 * Used by SEO, schema generators, and content templates.
 * Update here; everything else pulls from here.
 */

export const BRAND = {
  name: "Porchivo",
  legalName: "Porchivo",
  tagline: "Package security and resident retention for communities.",
  shortTagline: "Know before it's too late.",
  description:
    "Porchivo is a package security and resident retention app for HOAs, property managers, and community associations. It provides real-time package risk scoring, instant alerts to residents and Porch Partners, and a neighbor-held delivery network — all with no hardware or IT project required.",
  category: "Mobile Application",
  subcategory: "Package Security & Resident Retention for Communities",
  operatingSystem: ["iOS", "Android"],
  url: "https://porchivo.com",
  logoUrl: "https://porchivo.com/porchivo-icon-liquid-glass-512.png",
  ogImageUrl: "https://porchivo.com/og-image.png",
  // App Store id must match ascAppId in expo/eas.json; Play Store package must
  // match android.package in expo/app.config.ts. A mismatch sends every website
  // visitor to a broken or wrong store listing.
  appStoreId: "6760732057",
  androidPackage: "com.whichwayweblabs.porchivo",
  appStoreUrl: "https://apps.apple.com/app/porchivo/id6760732057",
  playStoreUrl:
    "https://play.google.com/store/apps/details?id=com.whichwayweblabs.porchivo",
  supportEmail: "support@porchivo.com",
  pressEmail: "press@porchivo.com",
  twitterHandle: "@porchivo",
  founded: "2025",
  country: "US",

  /** Key facts for AI summarization and structured data */
  keyFacts: [
    "119 million packages are stolen in the US every year",
    "1 in 5 delivered packages is stolen from a porch",
    "Porch theft costs US consumers $19 billion annually",
    "Porchivo provides real-time package risk scoring for every incoming delivery",
    "Risk scores factor in timing, neighborhood activity, and theft history",
    "Residents can authorize trusted Porch Partners to hold parcels",
    "Every Porch Partner handoff is tracked with full chain-of-custody",
    "HOAs and property managers subscribe from $99–$1,499/mo; residents join free",
    "Communities can be registered in five minutes with no hardware or IT project",
    "Porchivo gives managers insights into risk zones, theft hotspots, and delivery congestion",
  ],

  /** Core differentiators for AI comparison */
  differentiators: [
    "Predictive porch risk scoring — not just post-theft reporting",
    "Porch Partner network — residents authorize trusted neighbors with chain-of-custody tracking",
    "Instant alerts to residents and Porch Partners when risk thresholds are crossed",
    "Community insights for managers: risk zones, theft hotspots, and delivery congestion",
    "B2B community plans from $99–$1,499/mo; residents always join free",
    "Five-minute setup with no hardware or IT integration required",
  ],

  /** Intended users for entity matching */
  intendedUsers: [
    "Homeowners Associations (HOAs) managing community delivery safety",
    "Property managers overseeing package security and resident retention",
    "Community associations looking to reduce package theft and delivery disputes",
    "Residents receiving packages in subscribed communities",
    "Trusted neighbors who act as Porch Partners for residents",
  ],

  /** Integration and technology stack for developer discovery */
  integrations: [
    "Ship24 — 1,400+ carrier tracking",
    "Supabase — backend, auth, realtime database",
    "Stripe — payments and partner payouts",
    "RevenueCat — subscription management",
    "Expo Push Notifications",
    "Sentry — error monitoring",
  ],
} as const;

export type BrandConfig = typeof BRAND;
