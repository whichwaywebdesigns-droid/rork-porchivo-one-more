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
    id: "homeowner-frequent-deliveries",
    persona: "The Busy Homeowner",
    headline: "You order online constantly. Your porch doesn't protect itself.",
    summary:
      "A homeowner who receives 3–10 packages per week needs to know which deliveries are at risk before they hit the porch — not after.",
    challenge:
      "High delivery volume means more exposure time. Late deliveries sit overnight. Neighborhood theft rates vary by block and season. Most package alerts come too late — after theft has already happened.",
    solution:
      "Porchivo calculates a real-time risk score for every incoming package. When risk is high, Theft Shield fires a notification before delivery. Assigning a Porch Partner on high-risk days moves the delivery to a safe address and drops the risk score by 22 points.",
    keyFeatures: [
      "Real-time porch risk score per package",
      "Theft Shield alerts on high-risk deliveries",
      "Porch Partner assignment for safe holding",
      "Delivery window analysis (before vs after 4pm)",
      "Neighborhood theft alert map",
    ],
    recommendedPlan: "Premium Annual ($4.94/mo)",
    icon: "Home",
  },
  {
    id: "renter-apartment",
    persona: "The City Renter",
    headline: "Shared entrance. Dozens of neighbors. No dedicated safe drop.",
    summary:
      "Renters in apartments and condos face elevated theft risk because packages sit in shared lobbies or unsecured mailrooms for hours.",
    challenge:
      "You can't control your building's entrance. Your package sits in a shared space with dozens of strangers walking past. You have no way to know it's at risk until you get home and it's gone.",
    solution:
      "Porchivo tracks your package in real time and sends you an alert the moment it's delivered. If you can't get home quickly, you can instantly redirect the delivery to a verified Porch Partner in your building or nearby. Your risk score accounts for your building's alert history.",
    keyFeatures: [
      "Delivery notification the moment a package arrives",
      "Instant Porch Partner redirect for missed deliveries",
      "Building-level neighborhood alert history",
      "90-second tracking refresh (Premium)",
    ],
    recommendedPlan: "Premium Monthly ($8.33/mo) or Annual",
    icon: "Building",
  },
  {
    id: "porch-partner-earner",
    persona: "The Porch Partner",
    headline: "Your porch is sitting there. It could be earning.",
    summary:
      "Neighbors with a secure, accessible porch can earn $80–$250/month holding packages for nearby homeowners who aren't home during delivery.",
    challenge:
      "People want to help their neighbors but need a structured, trustworthy system. Informal arrangements have no accountability, no payment system, and no identity verification.",
    solution:
      "The Porchivo Porch Partner program handles everything: assignment routing, payment collection ($3–$25/hold based on package size + geo market), 85% payout to Partner, Stripe Connect deposits in 2 business days, and identity verification for trust. Partners choose when they're available — no schedule commitment.",
    keyFeatures: [
      "Earn $3–$25 per hold (small/medium/large × geo market)",
      "Keep 85% of every payment",
      "2-business-day Stripe payouts",
      "Identity verification for trust (Stripe Identity)",
      "No schedule — accept or decline any assignment",
    ],
    recommendedPlan: "Free (Partners don't pay to participate)",
    icon: "DollarSign",
  },
  {
    id: "hoa-community-manager",
    persona: "The HOA Board Member",
    headline: "One subscription. An entire neighborhood protected.",
    summary:
      "HOAs and property managers need community-wide package security coverage without requiring every resident to manage their own subscription.",
    challenge:
      "Individual homeowner subscriptions create inconsistent coverage. One unprotected home affects the whole block's alert data. HOA boards can't enforce individual app adoption — but they can fund community infrastructure.",
    solution:
      "The Porchivo HOA Plan covers up to 250 households under one subscription. All residents get full Premium access. The community alert map becomes denser and more accurate as more residents participate. One renewal, one invoice, one administrator.",
    keyFeatures: [
      "Up to 250 households covered",
      "All residents get full Premium access",
      "Denser neighborhood alert data",
      "Single billing and administration",
      "14-day free trial on annual plan",
    ],
    recommendedPlan: "HOA Annual ($3,000/yr — save 29%)",
    icon: "Users",
  },
  {
    id: "family-household",
    persona: "The Multi-Person Household",
    headline: "Everyone orders. Everyone should be protected.",
    summary:
      "Households with multiple adults each receiving packages need everyone covered under one subscription, not juggling separate accounts.",
    challenge:
      "Individual plans get expensive quickly for couples or multi-adult households. Package risk affects everyone in the house — a delivery addressed to any member is at risk on the same porch.",
    solution:
      "The Porchivo Family Plan covers up to 5 household members under one subscription at $15.00/month (billed annually). Every member gets their own account with full Premium access: unlimited tracking, Theft Shield, and Porch Partner features.",
    keyFeatures: [
      "Up to 5 household members",
      "Each member gets full Premium features",
      "Shared neighborhood alert data",
      "7-day free trial on annual plan",
      "One renewal for the whole household",
    ],
    recommendedPlan: "Family Annual ($15.00/mo — $179.99/yr)",
    icon: "Heart",
  },
];
