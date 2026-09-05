import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Building2, Users, Zap, Shield } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import FAQSection from "@/components/FAQSection";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildProductSchema, buildFAQSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { FAQS, getFAQsByCategory } from "@/content/faqs";

const seo = getPageSEO("pricing");
const pricingFAQs = getFAQsByCategory("pricing");

interface B2BPlan {
  name: string;
  tagline: string;
  monthly: string;
  annual: string;
  annualPerMonth: string;
  maxUnits: string;
  setupFee: string;
  features: string[];
  highlight: boolean;
  badge: string | null;
  cta: string;
  ctaHref: string;
}

const B2B_PLANS: B2BPlan[] = [
  {
    name: "Starter",
    tagline: "Small HOAs and condo associations getting started with community communication.",
    monthly: "$99",
    annual: "$990",
    annualPerMonth: "$83",
    maxUnits: "Up to 50 units",
    setupFee: "No setup fee",
    features: [
      "Community announcements",
      "5GB document library",
      "Maintenance requests",
      "Package tracking (all residents)",
      "Porch Partner network access",
      "Email support",
    ],
    highlight: false,
    badge: null,
    cta: "Get started",
    ctaHref: "/download",
  },
  {
    name: "Community",
    tagline: "The most popular plan for mid-size HOAs with active boards and amenity management needs.",
    monthly: "$249",
    annual: "$2,490",
    annualPerMonth: "$208",
    maxUnits: "Up to 200 units",
    setupFee: "No setup fee",
    features: [
      "Everything in Starter, plus:",
      "HOA dues collection & payments",
      "Payment history & receipts",
      "Ledger exports",
      "Amenity reservations",
      "Board member roles & permissions",
      "Priority email support",
    ],
    highlight: true,
    badge: "Most popular",
    cta: "Get started",
    ctaHref: "/download",
  },
  {
    name: "Professional",
    tagline: "Multi-community property managers who need a portfolio view, vendor directory, and custom branding.",
    monthly: "$499",
    annual: "$4,990",
    annualPerMonth: "$416",
    maxUnits: "Up to 500 units, 3 communities",
    setupFee: "$500 one-time onboarding",
    features: [
      "Everything in Community, plus:",
      "Multi-community portfolio (3 communities)",
      "Maintenance request queue & assignment",
      "Vendor directory & assignment",
      "Custom branding",
      "Resident directory",
      "Phone + email support",
    ],
    highlight: false,
    badge: "Multi-community",
    cta: "Get started",
    ctaHref: "/download",
  },
  {
    name: "Property Manager",
    tagline: "Large-scale property management companies with white-label and API requirements.",
    monthly: "$1,499",
    annual: "$14,990",
    annualPerMonth: "$1,249",
    maxUnits: "Up to 2,000 units, unlimited communities",
    setupFee: "$1,500 one-time onboarding",
    features: [
      "Everything in Professional, plus:",
      "Unlimited communities",
      "White-label options",
      "API access",
      "Dedicated account manager",
      "Custom onboarding & data migration",
      "SLA-backed support",
    ],
    highlight: false,
    badge: "Enterprise",
    cta: "Contact sales",
    ctaHref: "/download",
  },
];

const FREE_FEATURES = [
  "Package tracking with real-time porch risk score",
  "Neighborhood theft alerts (geo-filtered to your block)",
  "Porch Partner network — earn $3–$25 per hold",
  "Community features unlocked when your HOA joins",
  "No credit card required, no time limit",
];

// MXN pricing (Mexico-market push) — fixed MXN, reviewed quarterly.
// Starter + Professional only; prices are IVA-incluido (16% VAT inside the
// gross amount). Must match MXN_PLANS in supabase/functions/create-org-checkout.
const MXN_PLANS: Record<
  string,
  { monthly: number; annual: number; annualPerMonth: number; setupFee: number }
> = {
  Starter: { monthly: 1490, annual: 14900, annualPerMonth: 1242, setupFee: 0 },
  Professional: { monthly: 3690, annual: 36900, annualPerMonth: 3075, setupFee: 3690 },
};

const fmtMXN = (n: number) => `$${n.toLocaleString("en-US")}`;

const COMPARISON_ROWS = [
  { feature: "Max units", starter: "50", community: "200", professional: "500", enterprise: "2,000" },
  { feature: "Communities", starter: "1", community: "1", professional: "3", enterprise: "Unlimited" },
  { feature: "Announcements", starter: true, community: true, professional: true, enterprise: true },
  { feature: "Maintenance requests", starter: true, community: true, professional: true, enterprise: true },
  { feature: "Package tracking", starter: true, community: true, professional: true, enterprise: true },
  { feature: "Porch Partner network", starter: true, community: true, professional: true, enterprise: true },
  { feature: "HOA dues collection", starter: false, community: true, professional: true, enterprise: true },
  { feature: "Amenity reservations", starter: false, community: true, professional: true, enterprise: true },
  { feature: "Board member roles", starter: false, community: true, professional: true, enterprise: true },
  { feature: "Multi-community portfolio", starter: false, community: false, professional: true, enterprise: true },
  { feature: "Vendor directory & assignment", starter: false, community: false, professional: true, enterprise: true },
  { feature: "Custom branding", starter: false, community: false, professional: true, enterprise: true },
  { feature: "White-label options", starter: false, community: false, professional: false, enterprise: true },
  { feature: "API access", starter: false, community: false, professional: false, enterprise: true },
  { feature: "Dedicated account manager", starter: false, community: false, professional: false, enterprise: true },
  { feature: "SLA-backed support", starter: false, community: false, professional: false, enterprise: true },
  { feature: "Onboarding fee", starter: "—", community: "—", professional: "$500", enterprise: "$1,500" },
];

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Starter: Building2,
  Community: Users,
  Professional: Zap,
  "Property Manager": Shield,
};

export default function PricingPage() {
  // Currency — defaults to MXN on Spanish browsers (Mexico-market push)
  const [currency, setCurrency] = useState<"USD" | "MXN">(() =>
    typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es") ? "MXN" : "USD",
  );

  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Pricing", url: seo.canonical }]),
    buildProductSchema(),
    buildFAQSchema(pricingFAQs.map((f) => ({ question: f.question, answer: f.answer }))),
  ];

  return (
    <PageLayout peanuts tape>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-20 px-4 sm:px-6 text-center border-b border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Pricing", href: "/pricing" }]} />
          <div className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold mb-5">
            Residents always free
          </div>
          {/* Currency toggle — MXN is the Mexico-market push (Starter + Professional) */}
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            {(["USD", "MXN"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  currency === c
                    ? "bg-brand-orange border-brand-orange text-brand-text-primary"
                    : "border-brand-navy-500/50 text-brand-text-secondary hover:text-brand-text-primary"
                }`}
              >
                {c === "USD" ? "USD $" : "MXN $"}
              </button>
            ))}
            {currency === "MXN" && (
              <span className="text-xs text-brand-text-muted">
                Precios fijos en pesos — IVA incluido (Starter y Professional)
              </span>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary mb-4">
            Pricing for communities
          </h1>
          <p className="text-xl text-brand-text-secondary">
            HOAs and property managers subscribe to unlock community features for all residents. Residents never pay — they join your community for free.
          </p>
        </div>
      </section>

      {/* Residents banner */}
      <section className="py-12 px-4 sm:px-6 bg-brand-navy-900/40 border-b border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-3">Residents are always free</h2>
          <p className="text-brand-text-secondary mb-6 max-w-2xl mx-auto">
            Every resident in your community gets full access to Porchivo at no cost — package tracking, theft alerts, and Porch Partner features. Your subscription unlocks it all for them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {FREE_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2 text-left bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-lg px-3 py-2.5">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-brand-text-secondary">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* B2B Plans */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {B2B_PLANS.map((plan) => {
              const Icon = PLAN_ICONS[plan.name] ?? Building2;
              const mxn = currency === "MXN" ? MXN_PLANS[plan.name] : undefined;
              const mxnUnavailable = currency === "MXN" && !mxn;
              const monthly = mxn ? fmtMXN(mxn.monthly) : plan.monthly;
              const annual = mxn ? fmtMXN(mxn.annual) : plan.annual;
              const annualPerMonth = mxn ? fmtMXN(mxn.annualPerMonth) : plan.annualPerMonth;
              const setupFee =
                mxn && mxn.setupFee > 0
                  ? `${fmtMXN(mxn.setupFee)} one-time onboarding — IVA incluido`
                  : plan.setupFee;
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    mxnUnavailable
                      ? "border-brand-navy-500/25 bg-brand-navy-900/60 opacity-70"
                      : plan.highlight
                      ? "border-brand-orange/50 bg-gradient-to-b from-brand-orange/5 to-transparent"
                      : "border-brand-navy-500/40 bg-brand-navy-900"
                  }`}
                >
                  {plan.badge && (
                    <div className="inline-flex self-start mb-3 px-2.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-semibold">
                      {plan.badge}
                    </div>
                  )}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${plan.highlight ? "bg-brand-orange/10" : "bg-brand-navy-700/50"}`}>
                    <Icon className={`w-4 h-4 ${plan.highlight ? "text-brand-orange" : "text-brand-text-muted"}`} />
                  </div>
                  <div className="text-brand-text-primary text-base font-bold mb-1">{plan.name}</div>
                  <div className="text-xs text-brand-text-muted mb-4">{plan.maxUnits}</div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-brand-text-primary">{monthly}</span>
                    <span className="text-brand-text-muted text-xs">/mo{mxn ? " MXN" : ""}</span>
                  </div>
                  <div className="text-xs text-brand-text-muted mb-1">
                    or {annual}/yr{mxn ? " MXN" : ""} ({annualPerMonth}/mo) — 2 months free
                  </div>
                  <div className="text-xs text-brand-text-muted mb-5">
                    {mxnUnavailable ? "Billed in USD" : setupFee}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {f.includes("Everything in") ? (
                          <span className="font-semibold text-brand-text-secondary w-full pb-1 border-b border-brand-navy-700/50 mb-1">{f}</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-brand-orange flex-shrink-0 mt-0.5" />
                            <span className="text-brand-text-secondary">{f}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={plan.ctaHref}
                    className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      plan.highlight
                        ? "bg-brand-orange hover:bg-brand-orange text-brand-text-primary hover:scale-[1.02]"
                        : "border border-brand-navy-500/50 hover:border-brand-navy-500 text-brand-text-secondary hover:text-brand-text-primary"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-brand-text-muted mt-8">
            Need more than 2,000 units? <a href="mailto:support@porchivo.com" className="text-brand-orange hover:underline">Contact us</a> for a custom quote.
          </p>

          {currency === "MXN" && (
            <p className="text-center text-xs text-brand-text-muted mt-6 max-w-2xl mx-auto">
              Starter and Professional are billed in fixed Mexican pesos (IVA incluido) and reviewed quarterly — no exchange-rate surprises. Community and Enterprise remain billed in USD.
            </p>
          )}
        </div>
      </section>

      {/* Overage note */}
      <section className="py-8 px-4 sm:px-6 border-y border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-brand-text-secondary">
            <span className="font-semibold text-brand-text-primary">Overage:</span> Exceed your tier's unit limit by a small margin and pay just <span className="text-brand-orange font-semibold">$1.00 per additional unit per month</span>. No need to jump to a higher tier until you're ready.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary text-center mb-2">Compare plans</h2>
          <p className="text-brand-text-secondary text-center text-sm mb-8">Full feature breakdown across all tiers</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy-500/40">
                  <th className="text-left py-3 pr-4 text-brand-text-muted font-medium">Feature</th>
                  <th className="text-center py-3 px-2 text-brand-text-secondary font-semibold">Starter</th>
                  <th className="text-center py-3 px-2 text-brand-orange font-semibold">Community</th>
                  <th className="text-center py-3 px-2 text-brand-text-secondary font-semibold">Professional</th>
                  <th className="text-center py-3 px-2 text-brand-text-secondary font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td className="py-2.5 pr-4 text-brand-text-secondary font-medium">{row.feature}</td>
                    {(["starter", "community", "professional", "enterprise"] as const).map((tier) => (
                      <td key={tier} className="py-2.5 text-center">
                        {typeof row[tier] === "boolean" ? (
                          row[tier] ? (
                            <Check className="w-4 h-4 text-brand-orange inline-block" />
                          ) : (
                            <span className="w-4 h-px bg-brand-navy-700 inline-block" />
                          )
                        ) : (
                          <span className="text-brand-text-muted text-xs">{row[tier]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 bg-brand-navy-900/40 border-t border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary text-center mb-8">How it works</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange text-brand-text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
              <div>
                <h3 className="text-brand-text-primary font-semibold mb-1">Sign up your community</h3>
                <p className="text-sm text-brand-text-secondary">An HOA board member or property manager creates the community, selects a plan, and completes payment via Stripe Checkout.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange text-brand-text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
              <div>
                <h3 className="text-brand-text-primary font-semibold mb-1">Share your invite code</h3>
                <p className="text-sm text-brand-text-secondary">Residents download the free Porchivo app and join your community using the invite code. No payment required from them — ever.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange text-brand-text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">3</div>
              <div>
                <h3 className="text-brand-text-primary font-semibold mb-1">Residents get full access</h3>
                <p className="text-sm text-brand-text-secondary">Everyone in your community gets package tracking, theft alerts, announcements, maintenance requests, and all community features unlocked.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-3">Ready to protect your community?</h2>
          <p className="text-brand-text-secondary text-sm mb-6">Download the app, create your community, and invite residents in minutes.</p>
          <Link to="/download" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange text-brand-text-primary font-bold transition-all hover:scale-[1.02]">
            Get started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <div className="bg-brand-navy-900">
        <FAQSection
          faqs={pricingFAQs}
          title="Pricing questions answered"
        />
      </div>
    </PageLayout>
  );
}
