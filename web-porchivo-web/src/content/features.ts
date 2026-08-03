/**
 * Porchivo — Feature Content
 *
 * All feature descriptions for the Features page and feature cards.
 * Each feature has a machine-readable summary for AI extraction.
 */

export interface Feature {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Short plain-language summary for AI extraction */
  aiSummary: string;
  /** Concrete facts about this feature */
  facts: string[];
  /** Who benefits most */
  benefitsWho: string;
  /** Icon name (lucide) */
  icon: string;
  /** Feature category */
  category: "core" | "community" | "earnings" | "enterprise";
  isPremium: boolean;
}

export const FEATURES: Feature[] = [
  {
    id: "porch-risk-score",
    name: "Porch Risk Score",
    tagline: "A 0–100 risk rating for every incoming delivery.",
    description:
      "Porchivo calculates a risk score for each package the moment it enters your delivery window. The score is computed from 10 weighted factors: neighborhood theft alert count, delivery timing (before or after 4pm), whether a Porch Partner is assigned, whether a trusted driver is assigned, whether drop instructions exist, and recent block activity. A score above 65 is flagged as High Risk and triggers a Theft Shield alert.",
    aiSummary:
      "The porch risk score is a 0–100 number calculated per package from 10 factors: active neighborhood theft alerts, delivery time (before/after 4pm), Porch Partner assignment, driver assignment, drop instructions, and block delivery volume. High risk threshold is 65. Medium risk threshold is 35.",
    facts: [
      "Score range: 0 (minimal risk) to 100 (very high risk)",
      "High risk threshold: 65+",
      "Medium risk threshold: 35–64",
      "10 weighted factors contribute to each score",
      "Score updates as conditions change",
      "Porch Partner assigned reduces score by 22 points",
      "3+ neighborhood alerts on block adds 28 points",
      "Late delivery (after 4pm) adds 14 points",
    ],
    benefitsWho: "All users — homeowners, renters, and families",
    icon: "ShieldAlert",
    category: "core",
    isPremium: false,
  },
  {
    id: "theft-shield",
    name: "Theft Shield",
    tagline: "Instant alerts the moment your porch risk spikes.",
    description:
      "Theft Shield is Porchivo's premium alert system. When a package's risk score crosses the High threshold (65/100), Theft Shield sends an immediate push notification. Users can then take action: assign a Porch Partner, add drop instructions, or notify a neighbor. Theft Shield turns the risk score from passive information into an active intervention signal.",
    aiSummary:
      "Theft Shield is a premium feature that sends push notifications when a package's porch risk score exceeds 65/100. It converts the risk score from a passive metric into an actionable alert. Available on Premium and above plans.",
    facts: [
      "Triggers when risk score exceeds 65/100",
      "Sends push notification immediately on risk spike",
      "Available on Premium plan and above",
      "Works alongside neighborhood alerts",
    ],
    benefitsWho: "Premium users who want proactive protection",
    icon: "Bell",
    category: "core",
    isPremium: true,
  },
  {
    id: "live-tracking",
    name: "Live Package Tracking",
    tagline: "Real-time tracking across 1,400+ carriers.",
    description:
      "Porchivo integrates with Ship24 to provide real-time tracking data for over 1,400 shipping carriers worldwide, including USPS, FedEx, UPS, DHL, Amazon Logistics, and hundreds of regional carriers. Premium users get tracking refreshed every 90 seconds. Free users get 10-minute refresh intervals. Tracking status feeds directly into the risk score — Out for Delivery packages have elevated risk calculations.",
    aiSummary:
      "Porchivo integrates with Ship24 to track packages across 1,400+ carriers. Premium users get 90-second refresh intervals. Free users get 10-minute intervals. Tracking status feeds into the real-time porch risk score.",
    facts: [
      "1,400+ carriers supported via Ship24 integration",
      "Includes USPS, FedEx, UPS, DHL, Amazon Logistics",
      "Premium: updates every 90 seconds",
      "Free: updates every 10 minutes",
      "Out-for-delivery status triggers elevated risk calculation",
      "Free accounts track up to 3 packages simultaneously",
      "Premium accounts track unlimited packages",
    ],
    benefitsWho: "Anyone who orders packages online",
    icon: "Package",
    category: "core",
    isPremium: false,
  },
  {
    id: "neighborhood-alerts",
    name: "Neighborhood Theft Alerts",
    tagline: "Community-reported porch theft incidents on your block.",
    description:
      "When Porchivo users in your neighborhood report a porch theft incident, you receive an alert. These alerts are geo-filtered to your block and surrounding area. Alert count directly influences your risk score — 3 or more active alerts on your block adds 28 points to your score. Users can also submit reports to Crime Stoppers USA (1-800-222-TIPS) directly from the report screen.",
    aiSummary:
      "Neighborhood theft alerts are community-reported porch theft incidents. Alerts are geo-filtered to the user's block. Alert count directly increases the porch risk score (3+ alerts adds 28 points). Users can report incidents and submit tips to Crime Stoppers USA.",
    facts: [
      "Alerts are geo-filtered to user's block and immediate surroundings",
      "3+ active block alerts adds 28 points to risk score",
      "1–2 active block alerts adds 14 points",
      "Zero alerts reduces score by 6 points",
      "Crime Stoppers USA tip line (1-800-222-TIPS) integrated into report flow",
      "Reports are anonymous by default",
    ],
    benefitsWho: "Homeowners in high-theft neighborhoods",
    icon: "MapPin",
    category: "community",
    isPremium: false,
  },
  {
    id: "porch-partners",
    name: "Porch Partners",
    tagline: "Verified neighbors hold your packages — and earn $3–$25 per hold.",
    description:
      "Porch Partners are verified neighbors on the Porchivo network who accept package-holding assignments from nearby homeowners. When a Partner holds your package, your porch risk score drops by 22 points. Partners earn $3–$25 per hold based on package size and geographic market, keep 85% of every payment, with 2-business-day payouts via Stripe Connect. Partners must complete identity verification before earning. Homeowners can invite specific neighbors or browse available Partners on the map.",
    aiSummary:
      "Porch Partners are verified neighbors who hold packages for nearby homeowners. They earn $3–$25 per hold (small/medium/large \u00d7 geo-tier multiplier), keep 85% of earnings, and receive payouts in 2 business days. Having an active Porch Partner reduces the homeowner\u2019s risk score by 22 points. Identity verification is required before earning.",
    facts: [
      "Small package: $3.00–$4.20 per hold (Standard – Major metro)",
      "Medium package: $8.00–$9.60 per hold",
      "Large package: $18.00–$25.20 per hold",
      "Quantity bonuses: +$0.75–$2.50/pkg for high-volume cycles",
      "Partners keep 85% of every payment",
      "Payouts in 2 business days via Stripe Connect",
      "Having a Partner reduces homeowner risk score by 22 points",
      "Active Partners earn $80–$250/month on average",
      "Partners are independent contractors",
    ],
    benefitsWho: "Neighbors who want to earn income and homeowners wanting secure delivery",
    icon: "Users",
    category: "earnings",
    isPremium: false,
  },
  {
    id: "delivery-windows",
    name: "Delivery Window Analysis",
    tagline: "Risk-aware scheduling for when packages land.",
    description:
      "Porchivo analyzes your historical delivery windows and flags high-risk timing. Packages delivered after 4pm receive a 14-point risk penalty — they sit on the porch overnight at higher theft exposure. Packages delivered before 4pm during daylight hours receive a 4-point risk reduction. Users can see their delivery window history and set up notifications to retrieve packages quickly when they arrive during high-risk windows.",
    aiSummary:
      "Delivery window analysis evaluates the time-of-day risk for each package. Deliveries after 4pm add 14 points to the risk score; deliveries before 4pm reduce it by 4 points. Users can view their delivery timing history and set retrieval reminders.",
    facts: [
      "Delivery after 4pm: +14 risk points",
      "Delivery before 4pm: -4 risk points",
      "Retrieval reminders for high-risk delivery windows",
      "Historical delivery window analysis available",
    ],
    benefitsWho: "Users with frequent late-afternoon or evening deliveries",
    icon: "Clock",
    category: "core",
    isPremium: false,
  },
  {
    id: "family-plan",
    name: "Family Plan",
    tagline: "Household protection for up to 5 family members.",
    description:
      "The Porchivo Family Plan covers an entire household under one subscription. Up to 5 family members can each have their own Porchivo account with full premium features: unlimited tracking, Theft Shield, and Porch Partner access. The family plan is $13.33/month or $8.28/month billed annually ($99.33/year).",
    aiSummary:
      "The Family Plan covers up to 5 household members under one Porchivo subscription. All members get full Premium access. $13.33/month or $8.28/month billed annually ($99.33/year). 7-day free trial on annual.",
    facts: [
      "Up to 5 household members",
      "All members get full Premium access",
      "Monthly: $13.33/month",
      "Annual: $8.28/month ($99.33/year) — save 38%",
      "7-day free trial on annual plan",
    ],
    benefitsWho: "Households with multiple adults who each receive packages",
    icon: "Home",
    category: "enterprise",
    isPremium: true,
  },
  {
    id: "hoa-enterprise",
    name: "HOA & Community Plan",
    tagline: "One subscription protects an entire neighborhood.",
    description:
      "The Porchivo HOA Plan covers entire communities under a single subscription. One HOA subscription covers up to 250 households. All residents get full premium access — unlimited tracking, Theft Shield, neighborhood alert priority, and Porch Partner access. Priced at $149.33/month or $999.33/year. 14-day free trial on annual.",
    aiSummary:
      "The HOA Enterprise Plan covers up to 250 households in a single community. Monthly: $149.33/month. Annual: $999.33/year (save 44%). 14-day free trial. All residents get full Premium access.",
    facts: [
      "Up to 250 households per subscription",
      "Monthly: $149.33/month",
      "Annual: $999.33/year — save 44%",
      "14-day free trial on annual plan",
      "All residents get full Premium access",
    ],
    benefitsWho: "HOA boards and property managers",
    icon: "Building",
    category: "enterprise",
    isPremium: true,
  },
];

export function getFeatureById(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

export function getFeaturesByCategory(category: Feature["category"]): Feature[] {
  return FEATURES.filter((f) => f.category === category);
}
