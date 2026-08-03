/**
 * Porchivo — FAQ Content
 *
 * All FAQ questions and answers. Used on the /faq page and for FAQ schema.
 * Keep answers factual, specific, and under 200 words each.
 * Answers are used verbatim in JSON-LD FAQPage schema — accuracy matters.
 */

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: "risk-score" | "tracking" | "pricing" | "privacy" | "general";
}

export const FAQS: FAQ[] = [
  // ── Risk Score ─────────────────────────────────────────────────────────────
  {
    id: "how-is-risk-score-calculated",
    question: "How does Porchivo calculate a porch risk score?",
    answer:
      "Porchivo calculates a 0–100 porch risk score using multiple weighted factors: the number of active theft alerts in your neighborhood, whether your delivery is scheduled before or after 4pm, whether a trusted driver is assigned, whether drop instructions exist, and recent delivery traffic volume on your block. A score of 65 or above is High Risk, 35–64 is Elevated Risk, and under 35 is Low Risk. The score updates in real time as any of these factors change.",
    category: "risk-score",
  },
  {
    id: "what-is-high-risk",
    question: "What does a High Risk score mean for my package?",
    answer:
      "A score of 65 or above means your package has multiple risk factors stacking simultaneously — for example, late afternoon delivery timing combined with recent theft alerts on your block. A High Risk score triggers a Theft Shield notification (Premium feature) so you can take action: add drop instructions, arrange to be home, or reroute the delivery. The score is predictive, not a guarantee of theft.",
    category: "risk-score",
  },
  {
    id: "does-risk-score-affect-insurance",
    question: "Does Porchivo's risk score affect my homeowners insurance?",
    answer:
      "No. Porchivo's risk scores are for your personal awareness only. We do not share scores with insurance providers, and your score has no bearing on your insurance premiums or claims. The score is a private tool to help you make better decisions about protecting incoming deliveries.",
    category: "risk-score",
  },

  // ── Tracking ───────────────────────────────────────────────────────────────
  {
    id: "which-carriers-are-supported",
    question: "Which shipping carriers does Porchivo track?",
    answer:
      "Porchivo tracks packages from over 1,400 carriers worldwide via our Ship24 integration. This includes all major US carriers — USPS, FedEx, UPS, DHL, and Amazon Logistics — plus hundreds of regional and international carriers. If you can paste a tracking number, Porchivo can likely track it.",
    category: "tracking",
  },
  {
    id: "how-many-packages-can-i-track",
    question: "How many packages can I track at the same time?",
    answer:
      "Free accounts can track up to 3 packages simultaneously. Premium accounts track unlimited packages. When you exceed the free limit, the app prompts you to upgrade. Your existing packages remain visible; you just can't add new ones until you upgrade or a current package is delivered.",
    category: "tracking",
  },
  {
    id: "how-often-does-tracking-update",
    question: "How often does tracking information update?",
    answer:
      "Premium users receive tracking updates every 90 seconds. Free users receive updates every 10 minutes. Tracking data is pulled from Ship24 in real time — we do not cache old data. During high-activity periods like peak shipping season, updates may occasionally be slower due to carrier data availability.",
    category: "tracking",
  },

  // ── Pricing ────────────────────────────────────────────────────────────────
  {
    id: "is-porchivo-free",
    question: "Is Porchivo free to use?",
    answer:
      "Yes — Porchivo has a free tier with no time limit. Free accounts can track up to 3 packages simultaneously with 10-minute refresh intervals and access to neighborhood alerts. Premium plans add unlimited package tracking, 90-second refresh, Theft Shield alerts, and priority risk scoring. The free tier does not expire.",
    category: "pricing",
  },
  {
    id: "what-does-premium-include",
    question: "What does Porchivo Premium include?",
    answer:
      "Porchivo Premium includes: unlimited package tracking, 90-second live tracking refresh, Theft Shield push alerts when risk exceeds 65/100, priority risk scoring, access to the full neighborhood alert history, UPS & Amazon hidden services (intercept, live tracking, access points, and A-to-Z claim filing), and early access to new features. Premium is $9.99/month or $6.67/month billed annually ($79.99/year). Annual plans include a 7-day free trial.",
    category: "pricing",
  },
  {
    id: "can-i-cancel-anytime",
    question: "Can I cancel my Porchivo subscription at any time?",
    answer:
      "Yes. Subscriptions can be cancelled at any time through your iPhone Settings (iOS) or Google Play subscription manager (Android). Cancellations take effect at the end of the current billing period — you retain Premium access until then. Porchivo does not charge cancellation fees. Refunds are handled by the App Store (Apple) or Google Play.",
    category: "pricing",
  },
  {
    id: "what-is-the-family-plan",
    question: "What is the Family Plan?",
    answer:
      "The Family Plan covers up to 5 household members under one subscription. Each member gets their own Porchivo account with full Premium access — unlimited tracking, Theft Shield, and UPS & Amazon hidden services. Family Sharing is enabled so members can be added through Apple Family Sharing. The Family Plan is $14.99/month. A 7-day free trial is available.",
    category: "pricing",
  },
  {
    id: "is-there-an-hoa-plan",
    question: "Is there a plan for HOAs or property managers?",
    answer:
      "Yes. The Porchivo Enterprise/HOA Plan covers entire communities under one subscription — up to 250 households. All residents get full Premium access. The plan is $149.33/month or $999.33/year (save 44%). A 14-day free trial is available on the annual plan. Contact support@porchivo.com for onboarding assistance for communities larger than 250 households.",
    category: "pricing",
  },

  // ── Privacy ────────────────────────────────────────────────────────────────
  {
    id: "what-data-does-porchivo-collect",
    question: "What data does Porchivo collect?",
    answer:
      "Porchivo collects: your home address (for neighborhood risk scoring), package tracking numbers (sent to Ship24 for carrier lookup), push notification tokens (for alerts), and anonymized risk score events (for aggregate analysis). We do not collect browsing history, contacts, or payment card details (payments handled by Stripe). Your exact address is never shared with other users — only your general neighborhood radius is used for alert geo-filtering.",
    category: "privacy",
  },
  {
    id: "does-porchivo-sell-my-data",
    question: "Does Porchivo sell my personal data?",
    answer:
      "No. Porchivo does not sell, rent, or trade your personal data to third parties. Tracking numbers are sent to Ship24 strictly for carrier lookup. Address data is used only for local risk score calculation and neighborhood alert filtering. We do not monetize user data in any form.",
    category: "privacy",
  },
  {
    id: "how-do-i-delete-my-account",
    question: "How do I delete my Porchivo account?",
    answer:
      "Go to Profile → Delete account. Confirmation is required. Account deletion is an atomic operation: all your packages, alerts, risk scores, and profile data are permanently deleted in a single transaction. Deletion cannot be undone. If you have an active Premium subscription, cancel it through the App Store or Google Play before deleting your account.",
    category: "privacy",
  },

  // ── General ────────────────────────────────────────────────────────────────
  {
    id: "what-devices-does-porchivo-support",
    question: "What devices and operating systems does Porchivo support?",
    answer:
      "Porchivo is available on iOS (iPhone, requires iOS 16 or later) and Android (requires Android 8.0 or later). Download from the Apple App Store or Google Play Store. Porchivo is optimized for phones and does not currently have a dedicated tablet or web interface.",
    category: "general",
  },
  {
    id: "is-porchivo-available-outside-the-us",
    question: "Is Porchivo available outside the United States?",
    answer:
      "Porchivo's package tracking works internationally via Ship24. However, the neighborhood alerts and porch risk scores are currently optimized for US addresses. The app can be downloaded from the App Store and Google Play in most regions, but community features will be limited outside the US.",
    category: "general",
  },
  {
    id: "how-do-i-report-porch-theft",
    question: "How do I report a porch theft incident in Porchivo?",
    answer:
      "Tap the report icon on the Alerts or Neighborhood screen to open the report sheet. Select the type of incident, add any details, and submit. Your report is anonymized and added to the community alert feed for your neighborhood. You can also call Crime Stoppers USA at 1-800-222-TIPS to submit an anonymous tip to law enforcement — this option is available directly within the Porchivo report screen.",
    category: "general",
  },
];

export function getFAQsByCategory(category: FAQ["category"]): FAQ[] {
  return FAQS.filter((f) => f.category === category);
}

export function getAllFAQsForSchema(): Array<{ question: string; answer: string }> {
  return FAQS.map(({ question, answer }) => ({ question, answer }));
}
