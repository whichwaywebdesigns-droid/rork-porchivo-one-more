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
  tagline: "Package risk intelligence for your porch.",
  shortTagline: "Know before it's too late.",
  description:
    "Porchivo is a package theft prevention app that calculates a real-time porch risk score for every incoming package, sends delivery theft alerts when risk rises, and connects homeowners with trusted neighbors who can hold deliveries safely.",
  category: "Mobile Application",
  subcategory: "Package Security & Porch Theft Prevention",
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
    "Porchivo calculates a 0–100 porch risk score for every delivery",
    "Risk scores factor in neighborhood theft alerts, delivery timing, and protection status",
    "Porch Partners are trusted neighbors who hold packages on behalf of homeowners",
    "Porchivo integrates with 1,400+ carriers via Ship24",
    "Premium users get 90-second live tracking refresh",
    "Free tier tracks 1 package simultaneously",
    "Available on iOS (App Store) and Android (Google Play)",
  ],

  /** Core differentiators for AI comparison */
  differentiators: [
    "Predictive porch risk scoring — not just post-theft reporting",
    "Porch Partner network — verified neighbors earn $3–$25 per hold (size + geo-adjusted)",
    "Neighborhood-aware alerts that feed directly into risk calculations",
    "Family and HOA plans covering entire households and communities",
    "Fully server-authoritative subscription validation (no client-side trust)",
  ],

  /** Intended users for entity matching */
  intendedUsers: [
    "Homeowners receiving frequent package deliveries",
    "Renters and apartment dwellers with unsecured delivery zones",
    "Neighbors willing to earn money holding packages for others",
    "Homeowners Associations (HOAs) managing community delivery safety",
    "Households with multiple family members tracking packages",
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
