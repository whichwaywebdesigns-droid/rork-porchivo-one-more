/**
 * Porchivo — Use Case Content
 *
 * Real-world scenarios for the /use-cases page.
 * Written to be easily quoted by AI answer engines.
 */

export interface UseCase {
  id: string;
  persona: string;
  headline: string;
  summary: string;
  challenge: string;
  solution: string;
  keyFeatures: string[];
  recommendedPlan: string;
  icon: string;
}

export const USE_CASES: UseCase[] = [
  {
    id: "hoa-community-manager",
    persona: "The HOA Board or Property Manager",
    headline: "One subscription. An entire community protected.",
    summary:
      "HOAs and property managers need community-wide package security coverage without requiring every resident to manage their own subscription or install new hardware.",
    challenge:
      "Package theft and delivery disputes create constant work for management: 'where's my package?' calls, mailroom congestion, and dissatisfied residents. Individual homeowner subscriptions create inconsistent coverage, and hardware solutions are expensive and slow to deploy.",
    solution:
      "Porchivo covers the entire community under one B2B subscription. Residents join free with an invite code, get real-time risk scores and alerts, and can join the Porch Partner network for safer deliveries, extra income, and community reputation. Managers get a dashboard view of risk zones, theft hotspots, and delivery congestion — with no hardware or IT project required.",
    keyFeatures: [
      "Community-wide coverage under one subscription",
      "Residents join free with an invite code",
      "Real-time package risk scoring for every incoming delivery",
      "Instant alerts to residents and Porch Partners",
      "Manager dashboard with risk zones and hotspots",
      "Five-minute setup with no hardware installation",
    ],
    recommendedPlan: "Community or Enterprise Plan (residents free)",
    icon: "Building",
  },
  {
    id: "resident-high-risk-deliveries",
    persona: "The Resident",
    headline: "Know your package risk before it lands.",
    summary:
      "Residents in subscribed communities get full access to track packages, see risk scores, and receive instant alerts when a delivery needs attention.",
    challenge:
      "You're at work, traveling, or home late. A package is about to sit on your porch during high-risk hours. You need to know the risk and have a trusted neighbor ready to take custody before a theft happens.",
    solution:
      "Porchivo scores every incoming package in real time and sends an instant alert when risk crosses your community's threshold. Trusted Porch Partners from your network receive the same alert and can retrieve the package with full chain-of-custody tracking — every member joins for the safety, income, and reputation the network provides.",
    keyFeatures: [
      "Real-time package risk score per delivery",
      "Instant alerts when risk thresholds are crossed",
      "Porch Partner network benefits: safety, income, and reputation",
      "Full chain-of-custody for every handoff",
      "Live tracking across 1,400+ carriers",
    ],
    recommendedPlan: "Free for residents in a subscribed community",
    icon: "Home",
  },
  {
    id: "package-guardian",
    persona: "The Porch Partner",
    headline: "Be the trusted neighbor who keeps deliveries safe.",
    summary:
      "Trusted neighbors help residents by retrieving and holding packages securely, with every handoff tracked in the app for full accountability.",
    challenge:
      "Informal arrangements for holding neighbors' packages have no accountability, no verification, and no clear chain of custody. Residents are hesitant to hand off a package to someone without a structured system.",
    solution:
      "Joining the Porch Partner network comes with real benefits: safer streets, income for every completed hold, and a reputation for reliability. Accept handoff requests from neighbors — every pickup, hold, and handoff is tracked in the app with full chain-of-custody, and identity verification shows residents their packages are in trusted hands.",
    keyFeatures: [
      "Identity-verified Porch Partner status",
      "In-app handoff requests from residents",
      "Full chain-of-custody tracking",
      "No payment or schedule commitment required",
    ],
    recommendedPlan: "Free for Porch Partners",
    icon: "Users",
  },
  {
    id: "multi-property-manager",
    persona: "The Multi-Community Manager",
    headline: "Scale package security across every property you manage.",
    summary:
      "Property management companies overseeing multiple communities need a single dashboard to monitor risk, reduce workload, and improve retention across all their properties.",
    challenge:
      "Managing package security across multiple buildings or HOAs means fragmented tools, inconsistent resident experiences, and no centralized view of where theft or delivery problems are concentrated.",
    solution:
      "Porchivo Professional and Enterprise plans include multi-community dashboards, custom branding, and manager insights. See risk zones, theft hotspots, and delivery congestion across all properties from one place, while residents at every location join free.",
    keyFeatures: [
      "Multi-community dashboard",
      "Risk zones and theft hotspot visibility across properties",
      "Custom branding",
      "Dedicated account manager and SLA-backed support",
      "API access for advanced integrations",
    ],
    recommendedPlan: "Professional or Enterprise Plan",
    icon: "Building",
  },
  {
    id: "renter-apartment",
    persona: "The Apartment Renter",
    headline: "Shared entrances and mailrooms don't have to mean lost packages.",
    summary:
      "Renters in apartments and condos face elevated theft risk because packages sit in shared lobbies or unsecured mailrooms for hours.",
    challenge:
      "You can't control your building's entrance or mailroom. Your package sits in a shared space with dozens of strangers walking past. You have no way to know it's at risk until you get home and it's gone.",
    solution:
      "Porchivo tracks your package in real time and sends you an alert the moment it's delivered. If you can't get home quickly, you can request a handoff to a verified Porch Partner in your building or nearby. Your community's alert history feeds into your risk score.",
    keyFeatures: [
      "Delivery notification when a package arrives",
      "Instant Porch Partner handoff request",
      "Building-level alert history feeds risk scores",
      "Real-time tracking across 1,400+ carriers",
    ],
    recommendedPlan: "Free for residents in a subscribed community",
    icon: "Home",
  },
];
