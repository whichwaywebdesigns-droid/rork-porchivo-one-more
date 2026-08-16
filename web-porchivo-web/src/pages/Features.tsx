import { Link } from "react-router-dom";
import { ShieldAlert, Bell, Package, MapPin, Users, Clock, Home, Building, ArrowRight, Check } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("features");

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldAlert, Bell, Package, MapPin, Users, Clock, Home, Building,
};

const FEATURES_DETAILED = [
  {
    id: "porch-risk-score",
    icon: "ShieldAlert",
    accent: "amber",
    name: "Porch Risk Score",
    tagline: "A 0–100 risk rating for every incoming delivery.",
    description: "Porchivo calculates a risk score for each package the moment it enters your delivery window. The score is computed from 10 weighted factors — neighborhood theft alerts, delivery timing, Porch Partner assignment, driver assignment, drop instructions, and block delivery volume.",
    facts: [
      "Score range: 0 (minimal risk) to 100 (very high risk)",
      "High risk threshold: 65+ · Medium: 35–64 · Low: <35",
      "10 weighted factors contribute to each score",
      "Porch Partner assigned reduces score by 22 points",
      "3+ neighborhood alerts adds 28 points",
      "Late delivery (after 4pm) adds 14 points",
    ],
    isPremium: false,
  },
  {
    id: "theft-shield",
    icon: "Bell",
    accent: "red",
    name: "Theft Shield",
    tagline: "Instant push notification when your porch risk spikes.",
    description: "When a package's risk score crosses 65/100, Theft Shield fires a push notification immediately. You can then assign a Porch Partner, add drop instructions, or arrange to be home. Theft Shield turns your risk score from passive data into an active intervention trigger.",
    facts: [
      "Triggers when risk score reaches 65/100",
      "Sends push notification immediately",
      "Actionable in-app response options",
      "Premium plan and above",
    ],
    isPremium: true,
  },
  {
    id: "live-tracking",
    icon: "Package",
    accent: "blue",
    name: "Live Package Tracking",
    tagline: "Real-time updates across 1,400+ carriers.",
    description: "Porchivo integrates with Ship24 to track packages from over 1,400 carriers. Premium users get 90-second refresh. Free users get 10-minute intervals. Tracking status feeds directly into the risk score — Out for Delivery packages have elevated risk calculations.",
    facts: [
      "1,400+ carriers including USPS, FedEx, UPS, DHL, Amazon",
      "Premium: 90-second refresh interval",
      "Free: 10-minute refresh interval",
      "Free tier: track 1 package",
      "Premium: unlimited package tracking",
      "OFD status triggers elevated risk calculation",
    ],
    isPremium: false,
  },
  {
    id: "neighborhood-alerts",
    icon: "MapPin",
    accent: "violet",
    name: "Neighborhood Theft Alerts",
    tagline: "Community theft reports that feed your risk score.",
    description: "When Porchivo users near you report a porch theft, you receive an alert. Alerts are geo-filtered to your block. Active alert count directly adjusts your risk score. Crime Stoppers USA (1-800-222-TIPS) is integrated into the report flow for anonymous law enforcement tips.",
    facts: [
      "Geo-filtered to your block and immediate area",
      "3+ alerts on block: +28 risk points",
      "1–2 alerts: +14 risk points · Zero alerts: -6 points",
      "Crime Stoppers USA (1-800-222-TIPS) in report flow",
      "Reports are anonymized",
    ],
    isPremium: false,
  },
  {
    id: "porch-partners",
    icon: "Users",
    accent: "emerald",
    name: "Porch Partners",
    tagline: "Verified neighbors who hold your packages safely.",
    description: "Porch Partners are identity-verified neighbors who accept delivery assignments. Assigning a Porch Partner drops your risk score by 22 points. Porch Partners earn $3–$25 per hold (size + geo-based), keep 85%, and receive Stripe Connect deposits in 2 business days.",
    facts: [
      "Porch Partner assignment reduces risk score by 22 points",
      "Small: $3–$4.20 · Medium: $8–$9.60 · Large: $18–$25.20 per hold",
      "Porch Partners keep 85% of every payment",
      "2-business-day Stripe Connect payouts",
      "Geo premium up to ×1.4 in major metros",
      "Active Porch Partners earn $80–$250/month on average",
    ],
    isPremium: false,
  },
  {
    id: "delivery-windows",
    icon: "Clock",
    accent: "orange",
    name: "Delivery Window Analysis",
    tagline: "Risk-aware timing for when packages land.",
    description: "Porchivo analyzes delivery timing and adjusts risk scores based on time of day. Packages delivered after 4pm sit on the porch during higher-risk overnight hours. Packages delivered in daylight hours receive a small risk reduction.",
    facts: [
      "After 4pm delivery: +14 risk points",
      "Before 4pm delivery: -4 risk points",
      "Historical delivery timing analysis",
      "Retrieval reminders for late deliveries",
    ],
    isPremium: false,
  },
  {
    id: "family-plan",
    icon: "Home",
    accent: "amber",
    name: "Community Coverage",
    tagline: "HOAs and property managers can unlock community features for all residents.",
    description: "When your HOA or property manager subscribes to Porchivo, every resident in your community gets full access at no cost. Community plans start at $79/month for up to 50 units, with tiers scaling to 2,000+ units. Residents never pay — access is provided by your community.",
    facts: [
      "Community plans from $79/mo (Starter) to $599/mo (Enterprise)",
      "Residents always join for free via invite code",
      "Unlimited package tracking for all community members",
      "Announcements, maintenance requests, and amenity reservations",
      "Annual billing saves 20%",
    ],
    isPremium: false,
  },
  {
    id: "hoa-enterprise",
    icon: "Building",
    accent: "slate",
    name: "HOA & Property Management Plans",
    tagline: "Tiered plans for communities of every size.",
    description: "Porchivo offers four B2B tiers: Starter ($79/mo, 50 units), Community ($199/mo, 200 units), Professional ($399/mo, 500 units), and Enterprise ($599/mo, 2,000 units). All plans include package tracking, theft alerts, and community features for every resident. Professional and Enterprise tiers include multi-community dashboards, vendor management, custom branding, API access, and dedicated support.",
    facts: [
      "Starter: $79/mo for up to 50 units",
      "Community: $199/mo for up to 200 units — most popular",
      "Professional: $399/mo for up to 500 units, 3 communities",
      "Enterprise: $599/mo for up to 2,000 units, unlimited communities",
      "Annual billing saves 20% · $1/unit/mo overage above tier limit",
    ],
    isPremium: false,
  },
];

const accentClasses: Record<string, { text: string; bg: string; border: string }> = {
  amber: { text: "text-brand-orange", bg: "bg-brand-orange/10", border: "border-brand-orange/20" },
  red: { text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  blue: { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  violet: { text: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  slate: { text: "text-brand-text-secondary", bg: "bg-brand-navy-800/40", border: "border-brand-navy-500/30" },
};

export default function FeaturesPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Features", url: seo.canonical }]),
    buildMobileAppSchema(),
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }]} />
          <div className="mt-8 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary leading-tight mb-5">
              Every tool to protect your deliveries
            </h1>
            <p className="text-xl text-brand-text-secondary leading-relaxed">
              {seo.aiSummary}
            </p>
          </div>
        </div>
      </section>

      {/* Features list */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-16">
        {FEATURES_DETAILED.map((feat) => {
          const Icon = ICON_MAP[feat.icon];
          const ac = accentClasses[feat.accent] ?? accentClasses.amber;

          return (
            <article
              key={feat.id}
              id={feat.id}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start scroll-mt-20"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${ac.bg} flex items-center justify-center`}>
                    {Icon && <Icon className={`w-5 h-5 ${ac.text}`} />}
                  </div>
                  {feat.isPremium && (
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-semibold border border-brand-orange/20">
                      Premium
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-brand-text-primary mb-2">{feat.name}</h2>
                <p className={`text-sm font-medium ${ac.text} mb-4`}>{feat.tagline}</p>
                <p className="text-brand-text-secondary leading-relaxed">{feat.description}</p>
              </div>

              <div className="bg-brand-navy-900 rounded-2xl border border-brand-navy-500/40 p-5">
                <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-4">Key facts</div>
                <ul className="space-y-3">
                  {feat.facts.map((fact) => (
                    <li key={fact} className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className={`w-4 h-4 ${ac.text} flex-shrink-0 mt-0.5`} />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
                    <article id="delivery-insights" className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-semibold border border-brand-orange/20">
                  Carrier Tools
                </span>
              </div>
              <h2 className="text-2xl font-bold text-brand-text-primary mb-2">Porchivo Delivery Insights</h2>
              <p className="text-sm font-medium text-blue-400 mb-4">Carrier tools that put you in control of every drop-off.</p>
              <p className="text-brand-text-secondary leading-relaxed mb-10 max-w-3xl">
                Porchivo surfaces the native delivery controls already built into UPS and Amazon so you can steer packages before they ever reach your porch. This feature brings scattered carrier settings into one dashboard instead of leaving them buried in separate apps.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-brand-navy-900 rounded-2xl border border-brand-navy-500/40 p-5">
                  <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-4">UPS My Choice</div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Free account setup with delivery alerts by text or email
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Leave At instructions set a default drop spot for your driver
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Custom notes for gate codes or entry instructions
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Vacation Holds pause deliveries while you're away
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Driver preferences saved and applied to future shipments
                    </li>
                  </ul>
                </div>

                <div className="bg-brand-navy-900 rounded-2xl border border-brand-navy-500/40 p-5">
                  <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-4">Amazon Delivery Options</div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Amazon Key in-garage delivery for Prime members with a smart garage hub
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Amazon Hub lockers and counters, free with a 3–14 day pickup window
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Amazon Day consolidates weekly shipments into one delivery day
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Live map tracking once a driver is within 10 stops of your home
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      Free for all packages fulfilled directly by Amazon Logistics
                    </li>
                  </ul>
                </div>
              </div>
            </article>
      </div>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-brand-navy-900/40 border-t border-brand-navy-500/40">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-brand-text-primary mb-4">Ready to score your first delivery?</h2>
          <p className="text-brand-text-secondary mb-8">Free download. Track packages at no cost. Your HOA can unlock community features for everyone.</p>
          <Link to="/download" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange text-brand-text-primary font-bold transition-all hover:scale-[1.02]">
            Download Porchivo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
