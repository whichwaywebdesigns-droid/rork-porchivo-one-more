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
    name: "Real-Time Risk Scoring",
    tagline: "Every incoming package is scored for theft risk before it lands.",
    description:
      "Porchivo continuously calculates a risk score for each incoming package based on delivery timing, neighborhood activity, and theft history. Scores update as conditions change, so residents and managers always see the latest risk picture.",
    aiSummary:
      "Porchivo provides real-time package risk scoring for every incoming delivery. Scores are based on timing, neighborhood activity, and theft history, and they update continuously as conditions change.",
    facts: [
      "Score range: 0 (minimal risk) to 100 (very high risk)",
      "Scores update continuously as conditions change",
      "Factors include timing, neighborhood activity, and theft history",
      "High-risk thresholds trigger automatic alerts",
    ],
    benefitsWho: "All residents, HOAs, and property managers",
    icon: "ShieldAlert",
    category: "core",
    isPremium: false,
  },
  {
    id: "theft-shield",
    name: "Instant Theft Alerts",
    tagline: "Residents and Porch Partners are notified the moment risk thresholds are crossed.",
    description:
      "When a package's risk score crosses your community's threshold, Porchivo sends instant alerts to residents and their designated Porch Partners so they can take action before a theft occurs.",
    aiSummary:
      "Porchivo sends instant alerts to residents and opt-in Porch Partners when package risk thresholds are crossed, enabling proactive intervention before theft occurs.",
    facts: [
      "Push notifications to residents and Porch Partners",
      "Customizable risk thresholds per community",
      "Actionable next steps in every alert",
    ],
    benefitsWho: "Residents and Porch Partners in active communities",
    icon: "Bell",
    category: "core",
    isPremium: false,
  },
  {
    id: "guardian-network",
    name: "Porch Partner Network",
    tagline: "Join the Porch Partner network — safer deliveries, extra income, and community reputation.",
    description:
      "Porch Partners are trusted neighbors who accept delivery assignments through the app. Joining the network brings safer deliveries, income for every hold, and a reputation built on reliability — and every handoff is tracked with full chain-of-custody, so residents know exactly where their package is.",
    aiSummary:
      "The Porch Partner network offers safer deliveries, income per hold, and community reputation. Each handoff is tracked in the app with full chain-of-custody.",
    facts: [
      "Earn income and build reputation as a Porch Partner",
      "In-app handoffs with full chain-of-custody",
      "Porch Partners are identity-verified",
      "Reduces porch exposure time",
    ],
    benefitsWho: "Residents who need flexible, secure delivery holds",
    icon: "Users",
    category: "community",
    isPremium: false,
  },
  {
    id: "community-insights",
    name: "Community Insights",
    tagline: "Managers see active risk zones, theft hotspots, and delivery congestion.",
    description:
      "Property managers and HOA boards get a dashboard view of package activity across their community. Identify active risk zones, theft hotspots, and delivery congestion to guide safety measures and staffing decisions.",
    aiSummary:
      "Porchivo gives managers community insights: visibility into active risk zones, theft hotspots, and delivery congestion to guide safety measures and resource allocation.",
    facts: [
      "Dashboard for property managers and HOA boards",
      "Risk zones, theft hotspots, and delivery congestion visibility",
      "Data-driven safety guidance",
    ],
    benefitsWho: "HOA boards and property managers",
    icon: "MapPin",
    category: "enterprise",
    isPremium: false,
  },
  {
    id: "live-tracking",
    name: "Live Package Tracking",
    tagline: "Real-time updates across 1,400+ carriers.",
    description:
      "Porchivo integrates with Ship24 to track packages from over 1,400 carriers. Real-time tracking status feeds directly into the risk score, so risk calculations reflect the latest package location and expected delivery window.",
    aiSummary:
      "Porchivo integrates with Ship24 to track packages across 1,400+ carriers. Live tracking data feeds directly into the real-time risk score.",
    facts: [
      "1,400+ carriers including USPS, FedEx, UPS, DHL, Amazon",
      "Live tracking status feeds into risk scoring",
      "Available for all residents in subscribed communities",
    ],
    benefitsWho: "Anyone receiving packages in a Porchivo community",
    icon: "Package",
    category: "core",
    isPremium: false,
  },
  {
    id: "easy-setup",
    name: "Five-Minute Community Setup",
    tagline: "No hardware, no IT project, no installation.",
    description:
      "Register your community in five minutes, invite residents, and start protecting deliveries. No hardware, no IT integration, and no lengthy onboarding required.",
    aiSummary:
      "Porchivo communities can be registered in five minutes with no hardware or IT project. Residents join via invite code and opt into the Porch Partner network.",
    facts: [
      "Register a community in five minutes",
      "No hardware required",
      "No IT integration project",
      "Residents join via invite code",
    ],
    benefitsWho: "HOA boards and property managers",
    icon: "Zap",
    category: "enterprise",
    isPremium: false,
  },
  {
    id: "resident-retention",
    name: "Resident Retention & Satisfaction",
    tagline: "Fewer package inquiries, proactive safety notices, and better renewals.",
    description:
      "By reducing package anxiety and delivery disputes, Porchivo frees up management staff and improves the resident experience. Aggregated data helps communities send proactive safety notices and continuously improve satisfaction and renewal outcomes.",
    aiSummary:
      "Porchivo reduces management workload by cutting package-related inquiries and enables proactive safety notices. Better resident satisfaction supports stronger renewal rates.",
    facts: [
      "Fewer 'where's my package?' calls for staff",
      "Proactive safety notices powered by community data",
      "Improved resident satisfaction and renewal outcomes",
    ],
    benefitsWho: "Property managers and HOA boards",
    icon: "Heart",
    category: "enterprise",
    isPremium: false,
  },
  {
    id: "community-plan",
    name: "Community Plans",
    tagline: "HOAs and property managers subscribe; residents always join free.",
    description:
      "When your HOA or property manager subscribes to Porchivo, every resident in your community gets full access at no cost. Community plans start at $99/month for up to 50 units, with tiers scaling to 2,000+ units. Residents never pay — access is provided by your community.",
    aiSummary:
      "Porchivo offers B2B community plans from $99/mo to $1,499/mo for HOAs and property managers. Residents always join for free via invite code.",
    facts: [
      "Community plans from $99/mo (Starter) to $1,499/mo (Enterprise)",
      "Residents always join for free via invite code",
      "Unlimited package tracking for all community members",
      "Annual billing includes 2 months free",
    ],
    benefitsWho: "HOA boards and property managers",
    icon: "Building",
    category: "enterprise",
    isPremium: false,
  },
];

export function getFeatureById(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

export function getFeaturesByCategory(category: Feature["category"]): Feature[] {
  return FEATURES.filter((f) => f.category === category);
}
