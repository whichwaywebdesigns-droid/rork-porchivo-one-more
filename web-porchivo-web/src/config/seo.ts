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

/**
 * Sitewide search keywords — human SEO + AI/agentic extraction.
 * Single source of truth, consumed by SEOHead (meta keywords), the static
 * index.html tag, JSON-LD schema (schema.ts), and public/llms.txt.
 * Keep all four in sync when updating.
 */
export const SITE_KEYWORDS: string[] = [
  "package theft prevention",
  "porch pirate protection",
  "HOA package management",
  "apartment package security",
  "property manager delivery tracking",
  "resident retention amenities",
  "package tracking app",
  "stolen package alerts",
  "trusted neighbor package pickup",
  "neighborhood safety app",
];

export const PAGE_SEO: Record<string, PageSEO> = {
  home: {
    title: "Porchivo — Package Security & Resident Retention for Communities",
    description:
      "Porchivo is a package security and resident retention app for HOAs, property managers, and community associations. Real-time risk scoring, instant alerts to residents and Porch Partners, and a neighbor-held delivery network — with no hardware or IT project required.",
    canonical: `${BASE_URL}/`,
    ogTitle: "Porchivo — Package Security & Resident Retention for Communities",
    ogDescription:
      "Porchivo provides real-time package risk scoring, instant alerts to residents and Porch Partners, and a neighbor-held delivery network for HOAs and property managers. No hardware or IT project required.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo is a package security and resident retention app for HOAs, property managers, and community associations. It provides real-time package risk scoring for every incoming package, instant alerts to residents and Porch Partners, a Porch Partner network offering safer deliveries, income for every hold, and community reputation, and community insights for managers. Communities can be set up in five minutes with no hardware or IT project.",
    keyFacts: [
      "119 million packages are stolen in the US every year",
      "1 in 5 delivered packages is stolen from a porch",
      "Porchivo provides real-time risk scoring for every incoming package",
      "Residents can join the Porch Partner network for safety, income, and reputation",
      "Porchivo gives managers insights into risk zones, theft hotspots, and delivery congestion",
      "Communities can be registered in five minutes with no hardware or IT project",
      "HOAs and property managers subscribe from $99–$1,499/mo — residents always free",
    ],
    primaryEntity: "Porchivo mobile app",
    primaryIntent: "Product overview — package security and resident retention for HOAs and property managers",
  },

  features: {
    title: "Features — Porchivo Package Security & Resident Retention",
    description:
      "Explore Porchivo's full feature set: real-time package risk scoring, instant alerts, Porch Partners, community insights, live tracking, and easy community setup.",
    canonical: `${BASE_URL}/features`,
    ogTitle: "Porchivo Features — Everything Communities Need to Protect Deliveries",
    ogDescription:
      "Real-time package risk scoring, instant alerts to residents and Porch Partners, Porch Partner network, community insights for managers, and five-minute community setup.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo features include: real-time package risk scoring for every incoming delivery, instant alerts to residents and Porch Partners, a Porch Partner network offering safer deliveries, income per hold, and reputation with full chain-of-custody, community insights for managers, live tracking across 1,400+ carriers, five-minute community setup with no hardware or IT project, and B2B community plans from $99–$1,499/mo.",
    keyFacts: [
      "Real-time risk scoring based on timing, neighborhood activity, and theft history",
      "Instant alerts to residents and Porch Partners when thresholds are crossed",
      "The Porch Partner network offers safety, income, and reputation with chain-of-custody tracking",
      "Managers see risk zones, theft hotspots, and delivery congestion",
      "Communities can be set up in five minutes with no hardware or IT project",
    ],
    primaryEntity: "Porchivo product features",
    primaryIntent: "Feature discovery — what capabilities does Porchivo offer",
  },

  pricing: {
    title: "Pricing — Porchivo Community Plans for HOAs & Property Managers",
    description:
      "Porchivo offers four B2B community plans: Starter ($99/mo, 50 units), Community ($249/mo, 200 units), Professional ($499/mo, 500 units), and Enterprise ($1,499/mo, 2,000 units). Residents always join for free.",
    canonical: `${BASE_URL}/pricing`,
    ogTitle: "Porchivo Pricing — Community Plans for HOAs",
    ogDescription:
      "Residents always free. HOA and property manager plans from $99/mo to $1,499/mo. Annual billing includes 2 months free. Unlock community features for all residents.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo offers four B2B community plans: Starter ($99/mo, up to 50 units), Community ($249/mo, up to 200 units), Professional ($499/mo, up to 500 units), and Enterprise ($1,499/mo, up to 2,000 units). Annual billing includes 2 months free. Professional includes $500 onboarding; Enterprise includes $1,500 onboarding. Overage is $1/unit/mo above the tier limit. Residents always join for free — access is provided by their HOA or property manager.",
    keyFacts: [
      "Residents are always free — no IAP, no subscription",
      "Starter: $99/mo for up to 50 units",
      "Community: $249/mo for up to 200 units — most popular",
      "Professional: $499/mo for up to 500 units, 3 communities",
      "Enterprise: $1,499/mo for up to 2,000 units, unlimited communities",
      "Annual billing includes 2 months free · Overage: $1/unit/mo",
    ],
    primaryEntity: "Porchivo community subscription pricing",
    primaryIntent: "Pricing — B2B community plan comparison for HOAs and property managers",
  },

  useCases: {
    title: "Use Cases — How HOAs, Property Managers & Residents Use Porchivo",
    description:
      "See how Porchivo helps HOAs, property managers, residents, and Porch Partners protect deliveries and reduce management workload.",
    canonical: `${BASE_URL}/use-cases`,
    ogTitle: "Porchivo Use Cases — Community Delivery Security",
    ogDescription:
      "From HOA boards to resident Porch Partners, Porchivo adapts to every community delivery scenario. See real-world use cases for each role.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo serves HOAs and property managers who want community-wide delivery security, residents who need real-time package protection, and trusted neighbors who act as Porch Partners. Each role has different priorities: managers need insights and reduced workload, residents need alerts and safe handoffs, and Porch Partners help neighbors hold parcels securely.",
    keyFacts: [
      "HOAs and property managers: subscribe from $99/mo and reduce package-related workload",
      "Residents: join free, get real-time risk scores and instant alerts",
      "Porch Partners: trusted neighbors authorized to hold parcels for residents",
      "Communities can be set up in five minutes with no hardware or IT project",
    ],
    primaryEntity: "Porchivo user types and use cases",
    primaryIntent: "Use case discovery — who uses Porchivo and how",
  },

  porchPartners: {
    title: "Porch Partners — Trusted Neighbors Holding Packages Safely",
    description:
      "Join the Porch Partner network on Porchivo. Enjoy safer deliveries, earn income for every completed hold, and build your community reputation — all with full chain-of-custody tracking.",
    canonical: `${BASE_URL}/porch-partners`,
    ogTitle: "Porchivo Porch Partners — Trusted Neighbors Holding Packages",
    ogDescription:
      "Join the Porch Partner network: safer deliveries, income for every hold, and a reputation for reliability. Every handoff is tracked in the app with full chain-of-custody for secure, accountable delivery holds.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "The Porch Partner network lets trusted neighbors hold and retrieve parcels for residents. Members enjoy safer communities, income for every completed hold, and a reputation built on tracked, chain-of-custody handoffs. Porch Partners are identity-verified and help reduce porch exposure time.",
    keyFacts: [
      "Join the Porch Partner network for safety, income, and reputation",
      "Every handoff is tracked with full chain-of-custody",
      "Porch Partners are identity-verified",
      "Porch Partners reduce porch exposure time and package theft risk",
    ],
    primaryEntity: "Porchivo Porch Partner program",
    primaryIntent: "Porch Partner program — how neighbors help secure deliveries",
  },

  about: {
    title: "About Porchivo — Package Security & Resident Retention for Communities",
    description:
      "Porchivo is the package security and resident retention platform for HOAs, property managers, and community associations. Learn about our mission, approach, and the problem we're solving.",
    canonical: `${BASE_URL}/about`,
    ogTitle: "About Porchivo — Why We Built This",
    ogDescription:
      "119 million packages stolen annually. We built Porchivo to give communities predictive package security and reduce resident turnover.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo was founded to address the $19 billion porch theft epidemic in the United States. The company builds mobile software that gives HOAs and property managers predictive package security — calculating delivery risk before theft occurs. It also connects residents with trusted Porch Partners to hold parcels securely, reducing porch exposure and package-related management workload.",
    keyFacts: [
      "Porch theft costs US consumers $19 billion annually",
      "Porchivo focuses on predictive prevention, not post-theft reporting",
      "Porch Partners are trusted neighbors who hold parcels with full chain-of-custody",
      "Porchivo communities can be set up in five minutes with no hardware or IT project",
    ],
    primaryEntity: "Porchivo company and mission",
    primaryIntent: "Company overview — mission, approach, founding thesis",
  },

  faq: {
    title: "FAQ — Porchivo Package Security & Community Delivery Questions",
    description:
      "Common questions about Porchivo: how the risk score works, what Porch Partners do, community pricing, carrier support, privacy, and more.",
    canonical: `${BASE_URL}/faq`,
    ogTitle: "Porchivo FAQ — Questions Answered",
    ogDescription:
      "How does the risk score work? What are Porch Partners? How do community plans work? All your Porchivo questions answered.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    robots: "index, follow",
    aiSummary:
      "The Porchivo FAQ covers: how real-time package risk scores are calculated, how to join the Porch Partner network (safety, income, and reputation with chain-of-custody), B2B community pricing for HOAs and property managers, carrier support, privacy practices, and how to set up a community.",
    keyFacts: [
      "Real-time risk scores are based on timing, neighborhood activity, and theft history",
      "Residents can join the Porch Partner network",
      "HOAs and property managers subscribe; residents always join free",
      "Communities can be set up in five minutes with no hardware or IT project",
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
      "Free plan tracks 1 package; Premium is unlimited",
      "Verified Porch Partners earn $3–25 per hold",
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
      "The Porchivo changelog lists all app updates in reverse chronological order. Recent additions include: graceful 30-day account deletion with deactivation, SecureStore session hardening, RevenueCat webhook server authority, rate-limited edge functions, partner-to-homeowner upsell flows, and Crime Stoppers USA tip line integration.",
    keyFacts: [
      "Session tokens moved from AsyncStorage to SecureStore for enhanced security",
      "Account deletion uses a graceful 30-day deactivation period",
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
      "Download Porchivo on the App Store for iPhone or Google Play for Android. Free for residents — community features unlocked by your HOA or property manager.",
    canonical: `${BASE_URL}/download`,
    ogTitle: "Download Porchivo — Free on iOS & Android",
    ogDescription:
      "Get Porchivo on iPhone or Android. Residents always free. HOA and property manager plans from $99/mo.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    robots: "index, follow",
    aiSummary:
      "Porchivo is available as a free download on iOS (App Store) and Android (Google Play). The app requires iOS 16+ or Android 8+. Residents are always free — community features are unlocked when their HOA or property manager subscribes.",
    keyFacts: [
      "Available on iOS App Store",
      "Available on Google Play",
      "Free to download — residents never pay",
      "HOA and property manager plans from $99/mo",
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
