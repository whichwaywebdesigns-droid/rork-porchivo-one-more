/**
 * Porchivo — Central SEO Metadata Config
 *
 * Every page's title, description, canonical, og, and AI-summary fields live here.
 * Update this file to change metadata sitewide — never hardcode meta tags in components.
 *
 * Rules:
 *  - title: 50–60 chars
 *  - description: 140–160 chars
 *  - aiSummary: 2–3 sentence plain-English summary for LLM extraction
 *  - keyFacts: quote-worthy facts for answer engines
 */

import { BRAND } from "./brand";

export interface PageSEO {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: "summary" | "summary_large_image";
  robots: string;
  /** Short plain-English summary for AI extraction */
  aiSummary: string;
  /** Quote-worthy facts for answer engines */
  keyFacts: string[];
  /** Primary entity on this page */
  primaryEntity: string;
  /** Primary topic/intent */
  primaryIntent: string;
}

const BASE_URL = BRAND.url;
const OG_IMAGE = BRAND.ogImageUrl;

export const PAGE_SEO: Record<string, PageSEO> = {
  home: {
    title: "Porchivo — Porch Pirate Protection & Package Theft Prevention App",
    description:
      "Porchivo is a package delivery security app that calculates a real-time porch risk score, sends delivery theft alerts, and connects homeowners with trusted neighbor delivery holds. Built for HOA package management and neighborhood package safety.",
    canonical: `${BASE_URL}/`,
    ogTitle: "Porchivo — Porch Pirate Protection & Package Theft Prevention App",
    ogDescription:
      "Porchivo is a package delivery security app that calculates a real-time porch risk score, sends delivery theft alerts, and connects homeowners with trusted neighbor delivery holds. Built for HOA package management and neighborhood package safety.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo is a package theft prevention app and package delivery security app that calculates a real-time 0–100 porch risk score for every incoming package. It sends delivery theft alerts, enables trusted neighbor delivery holds, and supports HOA package management and neighborhood package safety.",
    keyFacts: [
      "119 million packages are stolen in the US every year",
      "1 in 5 delivered packages is stolen from a porch",
      "Porchivo's porch risk score weighs neighborhood alerts, delivery timing, and porch protection status",
      "Theft Shield sends a delivery theft alert when risk exceeds 65/100",
      "Porch Partners provide trusted neighbor delivery holds and earn $3–$25 per hold",
      "HOA package management plan covers up to 250 households",
    ],
    primaryEntity: "Porchivo mobile app",
    primaryIntent: "Product overview — porch pirate protection, package theft prevention, and porch package security",
  },

  features: {
    title: "Features — Porchivo Package Security & Porch Risk App",
    description:
      "Explore Porchivo's full feature set: porch risk scoring, Theft Shield, neighborhood alerts, Porch Partners, live carrier tracking, and family plans.",
    canonical: `${BASE_URL}/features`,
    ogTitle: "Porchivo Features — Every Tool to Protect Your Deliveries",
    ogDescription:
      "Porch risk scores, live tracking across 1,400+ carriers, Theft Shield alerts, Porch Partners, neighborhood maps, and family plans. All in one app.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo features include: a 0–100 porch risk score calculated per package, real-time carrier tracking via Ship24 (1,400+ carriers), Theft Shield alerts when risk spikes, a Porch Partner network for neighbor-held deliveries, community theft alerts, delivery window risk analysis, and family and HOA subscription plans.",
    keyFacts: [
      "Risk score factors: neighborhood alerts, delivery timing, Porch Partner status, driver assignment",
      "Integrates with 1,400+ shipping carriers",
      "Theft Shield sends notifications when porch risk score exceeds 65/100",
      "Porch Partners earn $3–$25 per hold based on package size and market",
    ],
    primaryEntity: "Porchivo product features",
    primaryIntent: "Feature discovery — what capabilities does Porchivo offer",
  },

  pricing: {
    title: "Pricing — Porchivo Plans for Individuals, Families & HOAs",
    description:
      "Porchivo offers a free tier, an $8.33/mo Premium plan (billed annually at $99.99/yr), a Family plan, and an HOA plan covering up to 250 households. 7-day free trial on annual.",
    canonical: `${BASE_URL}/pricing`,
    ogTitle: "Porchivo Pricing — Plans for Every Household",
    ogDescription:
      "Free tier available. Premium from $8.33/mo. Family plan for up to 5 members. HOA plan covering 250 households. Start with a 7-day free trial.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo offers four plan tiers: Free (tracks 1 package), Premium at $13.99/month or $8.33/month billed annually ($99.99/year), Family at $23.99/month or $15.00/month annually (up to 5 members), and Enterprise/HOA at $350/month or $3,000/year (up to 250 households). Annual plans include a 7-day free trial.",
    keyFacts: [
      "Free tier: track 1 package",
      "Premium monthly: $13.99/mo",
      "Premium annual: $8.33/mo ($99.99/yr) — save 40%",
      "Family plan: up to 5 household members",
      "HOA/Enterprise plan: up to 250 households at $350/mo or $3,000/yr (save 29%)",
      "7-day free trial on all annual plans",
    ],
    primaryEntity: "Porchivo subscription pricing",
    primaryIntent: "Pricing — cost and plan comparison for Porchivo",
  },

  useCases: {
    title: "Use Cases — How Homeowners, Renters & HOAs Use Porchivo",
    description:
      "See how Porchivo protects homeowners, renters, Porch Partners, and entire HOA communities from porch theft and delivery loss.",
    canonical: `${BASE_URL}/use-cases`,
    ogTitle: "Porchivo Use Cases — Protection for Every Delivery Scenario",
    ogDescription:
      "From solo renters to HOA communities, Porchivo adapts to your delivery situation. See real-world use cases and how each role uses the app.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo serves multiple user types: homeowners who want real-time package protection, renters in high-density buildings with shared entrances, Porch Partners who earn income by holding neighbors' packages, and HOAs or property managers who want community-wide delivery safety. Each use case has different feature priorities and subscription needs.",
    keyFacts: [
      "Homeowners: track packages, score risk, activate Theft Shield",
      "Renters: share packages with trusted neighbors in the same building",
      "Porch Partners: earn $3–$25 per hold (size + geo-adjusted), keep 85% of earnings",
      "HOAs: one subscription covers up to 250 households",
    ],
    primaryEntity: "Porchivo user types and use cases",
    primaryIntent: "Use case discovery — who uses Porchivo and how",
  },

  porchPartners: {
    title: "Porch Partners — Earn Money Holding Neighbors' Packages",
    description:
      "Become a Porch Partner on Porchivo. Hold packages for neighbors, earn $3–$25 per hold (size- and location-based), keep 85% of every payment. Payouts in 2 business days.",
    canonical: `${BASE_URL}/porch-partners`,
    ogTitle: "Porchivo Porch Partners — Earn $80–$250/Month on Your Schedule",
    ogDescription:
      "Turn your porch into income. Hold packages for neighbors, earn $3–$25 per hold (size + geo-based), keep 85%. No schedule, no boss — just trusted service in your community.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "The Porch Partner program is Porchivo's neighbor-to-neighbor package holding marketplace. Partners accept delivery assignments from nearby homeowners, hold packages safely, and earn $3–$25 per hold (based on package size: small $3–$4.20, medium $8–$9.60, large $18–$25.20, with geo multipliers up to ×1.4 in major metros). Partners keep 85% of earnings with 2-business-day payouts via Stripe Connect. Identity verification is required before earning.",
    keyFacts: [
      "Porch Partners earn $3–$25 per hold (size + geo-adjusted)",
      "Partners keep 85% of every payment",
      "Payouts deposited in 2 business days via Stripe Connect",
      "Identity verification required to become a Porch Partner",
      "Active Partners earn $80–$250/month on average",
    ],
    primaryEntity: "Porchivo Porch Partner program",
    primaryIntent: "Partner program — how to earn money as a Porch Partner",
  },

  about: {
    title: "About Porchivo — Package Security Intelligence Platform",
    description:
      "Porchivo is building the infrastructure for porch theft prevention. Learn about our mission, approach, and the problem we're solving.",
    canonical: `${BASE_URL}/about`,
    ogTitle: "About Porchivo — Why We Built This",
    ogDescription:
      "119 million packages stolen annually. We built Porchivo to put the data advantage on the homeowner's side.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo was founded to address the $19 billion porch theft epidemic in the United States. The company builds mobile software that gives homeowners predictive risk intelligence — calculating package delivery risk before theft occurs rather than reporting it after. The platform also enables neighbors to earn income by participating in a trusted package-holding network.",
    keyFacts: [
      "Porch theft costs US consumers $19 billion annually",
      "Porchivo focuses on predictive prevention, not post-theft reporting",
      "The Porch Partner network creates economic opportunity for neighbors",
    ],
    primaryEntity: "Porchivo company and mission",
    primaryIntent: "Company overview — mission, approach, founding thesis",
  },

  faq: {
    title: "FAQ — Porchivo Package Security App Questions & Answers",
    description:
      "Common questions about Porchivo: how the risk score works, what Porch Partners do, pricing, carrier support, privacy, and more.",
    canonical: `${BASE_URL}/faq`,
    ogTitle: "Porchivo FAQ — Questions Answered",
    ogDescription:
      "How does the risk score work? What carriers do you support? How do Porch Partners get paid? All your Porchivo questions answered.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "The Porchivo FAQ covers: how porch risk scores are calculated (0–100 scale, 10 weighted factors), supported carriers (1,400+ via Ship24), Porch Partner earning mechanics, free vs Premium differences, privacy policy, and how to report package theft.",
    keyFacts: [
      "Risk score is calculated from 10 weighted factors",
      "Supports 1,400+ carriers via Ship24 integration",
      "Free accounts can track 1 package",
      "Porchivo does not share your address with third parties",
    ],
    primaryEntity: "Porchivo FAQ",
    primaryIntent: "FAQ — answers to common questions about Porchivo",
  },

  guide: {
    title: "The Porchivo Field Guide — How to Use Porchivo",
    description:
      "The complete Porchivo Field Guide: tracking deliveries, delivery windows, Neighborhood Watch, Porch Partners, alerts, your Block Safety Score, billing, privacy, and support.",
    canonical: `${BASE_URL}/guide`,
    ogTitle: "The Porchivo Field Guide",
    ogDescription:
      "Everything you need. Nothing you don't. The full Porchivo user manual — 14 sections from tracking your first package to coordinating your whole block.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "The Porchivo Field Guide is the complete user manual for the Porchivo app, organized into 14 sections: Welcome, Porch Dashboard, Tracking Deliveries, Adding a Package, Delivery Windows, Neighborhood Watch, Porch Partners, Becoming a Partner & Earning, Instant Alerts, Block Safety Score, Premium & Billing, Privacy & Your Data, Notifications Setup, and Help & Support. It explains every feature in plain language for homeowners, renters, and Porch Partners.",
    keyFacts: [
      "The Field Guide covers 14 sections of Porchivo features",
      "Free plan tracks up to 20 active packages; Premium is unlimited",
      "Verified Porch Partners earn $5–25 per hold",
      "Block Safety Score runs from 0 to 100 — higher is safer",
    ],
    primaryEntity: "Porchivo Field Guide (user manual)",
    primaryIntent: "How-to — learn how to use every Porchivo feature",
  },

  changelog: {
    title: "Changelog — Porchivo App Updates & Release Notes",
    description:
      "Stay up to date with Porchivo app updates, new features, bug fixes, and improvements. Full version history.",
    canonical: `${BASE_URL}/changelog`,
    ogTitle: "Porchivo Changelog — What's New",
    ogDescription:
      "Track every Porchivo update: new features, performance improvements, security hardening, and bug fixes.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "The Porchivo changelog lists all app updates in reverse chronological order. Recent additions include: atomic account deletion RPC, SecureStore session hardening, RevenueCat webhook server authority, rate-limited edge functions, partner-to-homeowner upsell flows, and Crime Stoppers USA tip line integration.",
    keyFacts: [
      "Session tokens moved from AsyncStorage to SecureStore for enhanced security",
      "Account deletion is now an atomic Postgres transaction",
      "RevenueCat subscription state is server-authoritative via Supabase Edge Function",
    ],
    primaryEntity: "Porchivo version history",
    primaryIntent: "Changelog — what has changed in Porchivo and when",
  },

  forAgents: {
    title: "Porchivo — Machine-Readable Product Overview for AI Agents",
    description:
      "Structured, plain-language product facts for AI agents, LLMs, and automated systems. Entity map, capability summary, pricing, integrations, and official sources.",
    canonical: `${BASE_URL}/for-agents`,
    ogTitle: "Porchivo — AI Agent Overview",
    ogDescription:
      "Complete machine-readable Porchivo product summary for AI agents, LLMs, and automated discovery systems.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "This page provides a structured, machine-readable overview of Porchivo for AI agents, LLMs, and automated systems. It includes entity definition, product category, core capabilities, pricing, integrations, trust signals, constraints, and official sources of truth.",
    keyFacts: [],
    primaryEntity: "Porchivo AI-readable product summary",
    primaryIntent: "AI agent onboarding — machine-readable product facts",
  },

  download: {
    title: "Download Porchivo — iOS & Android Package Security App",
    description:
      "Download Porchivo on the App Store for iPhone or Google Play for Android. Free to download with optional premium plans.",
    canonical: `${BASE_URL}/download`,
    ogTitle: "Download Porchivo — Free on iOS & Android",
    ogDescription:
      "Get Porchivo on iPhone or Android. Free tier available. Premium from $4.94/mo. Protect every delivery.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo is available as a free download on iOS (App Store) and Android (Google Play). The app requires iOS 16+ or Android 8+. A free tier is available; Premium plans start at $9.99/month.",
    keyFacts: [
      "Available on iOS App Store",
      "Available on Google Play",
      "Free to download",
      "Premium from $8.33/mo billed annually"
    ],
    primaryEntity: "Porchivo app download",
    primaryIntent: "App download — how to install Porchivo",
  },

  privacy: {
    title: "Privacy Policy — Porchivo",
    description:
      "Porchivo's privacy policy: what data we collect, how we use it, who we share it with, and your rights as a user.",
    canonical: `${BASE_URL}/privacy`,
    ogTitle: "Porchivo Privacy Policy",
    ogDescription:
      "Read how Porchivo collects, uses, and protects your data. Your privacy is core to our trust model.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "Porchivo collects address data for neighborhood risk scoring, package tracking numbers for carrier lookups, and push notification tokens for alerts. Location data is used only for risk calculation and is never sold. Session tokens are stored in device SecureStore. Users may delete their account and all data at any time.",
    keyFacts: [
      "Address data used only for local risk scoring",
      "Tracking numbers sent to Ship24 for carrier lookup only",
      "Session tokens stored in device SecureStore, not plain storage",
      "Users can delete all their data at any time",
    ],
    primaryEntity: "Porchivo privacy practices",
    primaryIntent: "Privacy — how Porchivo handles user data",
  },

  terms: {
    title: "Terms of Service — Porchivo",
    description:
      "Porchivo's terms of service: acceptable use, subscription terms, Porch Partner agreement, and user responsibilities.",
    canonical: `${BASE_URL}/terms`,
    ogTitle: "Porchivo Terms of Service",
    ogDescription:
      "Terms governing use of the Porchivo app, Premium subscriptions, and the Porch Partner program.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "Porchivo's terms of service govern use of the app, Premium subscriptions, and the Porch Partner program. Key terms include: subscriptions auto-renew unless cancelled, Porch Partners are independent contractors not employees, Porchivo is not liable for package theft or damage, and the service is available in the United States.",
    keyFacts: [
      "Subscriptions auto-renew; cancel anytime in Settings",
      "Porch Partners are independent contractors",
      "Service available in the United States",
    ],
    primaryEntity: "Porchivo terms of service",
    primaryIntent: "Legal — terms governing use of Porchivo",
  },
};

/** Helper: get SEO config for a page with safe fallback */
export function getPageSEO(page: keyof typeof PAGE_SEO): PageSEO {
  return PAGE_SEO[page] ?? PAGE_SEO.home;
}
