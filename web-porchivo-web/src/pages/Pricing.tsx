import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
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

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Track up to 3 packages. No time limit, no commitment.",
    cta: "Download free",
    ctaHref: "/download",
    highlight: false,
    badge: null,
    features: [
      { text: "Track up to 3 packages", included: true },
      { text: "10-minute tracking refresh", included: true },
      { text: "Neighborhood theft alerts", included: true },
      { text: "Porch risk score (limited)", included: true },
      { text: "Theft Shield alerts", included: false },
      { text: "90-second live tracking", included: false },
      { text: "Priority risk scoring", included: false },
    ],
  },
  {
    name: "Premium",
    price: "$6.67",
    period: "/mo, billed annually",
    altPrice: "$9.99/mo billed monthly",
    description: "Unlimited tracking, Theft Shield, and full risk intelligence.",
    cta: "Start 7-day free trial",
    ctaHref: "/download",
    highlight: true,
    badge: "Most popular · Save 33%",
    features: [
      { text: "Unlimited package tracking", included: true },
      { text: "90-second live tracking refresh", included: true },
      { text: "Full porch risk score", included: true },
      { text: "Theft Shield push alerts", included: true },
      { text: "Full neighborhood alerts", included: true },
      { text: "Delivery window analysis", included: true },
      { text: "Priority risk scoring", included: true },
    ],
  },
  {
    name: "Family",
    price: "$14.99",
    period: "/mo",
    altPrice: null,
    description: "Up to 5 household members, all with full Premium access. Family Sharing enabled.",
    cta: "Start 7-day free trial",
    ctaHref: "/download",
    highlight: false,
    badge: "Up to 5 members · Family Sharing",
    features: [
      { text: "5 household member accounts", included: true },
      { text: "All Premium features", included: true },
      { text: "Shared neighborhood data", included: true },
      { text: "UPS & Amazon hidden services access", included: true },
      { text: "One billing — Apple Family Sharing", included: true },
    ],
  },
];

const RISK_FACTORS = [
  { factor: "3+ theft alerts on block", impact: "+28", severity: "high" },
  { factor: "1–2 theft alerts on block", impact: "+14", severity: "medium" },
  { factor: "Zero active alerts", impact: "−6", severity: "low" },
  { factor: "Delivery after 4pm", impact: "+14", severity: "medium" },
  { factor: "Delivery before 4pm", impact: "−4", severity: "low" },
  { factor: "High delivery traffic on block", impact: "+12", severity: "medium" },
  { factor: "Trusted driver assigned", impact: "−8", severity: "low" },
  { factor: "Drop instructions added", impact: "−4", severity: "low" },
];

export default function PricingPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Pricing", url: seo.canonical }]),
    buildProductSchema(),
    buildFAQSchema(pricingFAQs.map((f) => ({ question: f.question, answer: f.answer }))),
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
      <section className="pt-16 pb-20 px-4 sm:px-6 text-center border-b border-slate-800">
        <div className="max-w-3xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Pricing", href: "/pricing" }]} />
          <h1 className="mt-8 text-4xl sm:text-5xl font-bold text-slate-100 mb-4">
            Plans for every household
          </h1>
          <p className="text-xl text-slate-400">
            Start free, no time limit. Upgrade for unlimited tracking, Theft Shield, and full risk intelligence.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-7 flex flex-col ${
                  plan.highlight
                    ? "border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-transparent"
                    : "border-slate-800 bg-slate-900"
                }`}
              >
                {plan.badge && (
                  <div className="inline-flex self-start mb-4 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}
                <div className="text-slate-400 text-sm font-medium mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-slate-100">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                {plan.altPrice && (
                  <div className="text-xs text-slate-600 mb-3">{plan.altPrice}</div>
                )}
                <p className="text-sm text-slate-400 mb-6">{plan.description}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <span className="w-3 h-px bg-slate-700" />
                        </span>
                      )}
                      <span className={f.included ? "text-slate-300" : "text-slate-600"}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.ctaHref}
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 hover:scale-[1.02]"
                      : "border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-slate-100"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOA Enterprise */}
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold mb-3">
                HOA &amp; Enterprise — Up to 250 households
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3">Protect an entire community</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                One Porchivo subscription covers up to 250 households. All residents get full Premium access — unified billing, denser neighborhood alert data, and community-wide risk intelligence.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Monthly", price: "$149.33/mo", sub: "up to 250 households" },
                { label: "Annual", price: "$999.33/yr", sub: "$83.28/mo — save 44% · 14-day trial" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{row.label}</div>
                    <div className="text-xs text-slate-500">{row.sub}</div>
                  </div>
                  <div className="text-lg font-bold text-amber-400">{row.price}</div>
                </div>
              ))}
              <Link
                to="/download"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
              >
                Get started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Risk score reference table */}
      <section className="py-16 px-4 sm:px-6 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">How the risk score is calculated</h2>
          <p className="text-slate-400 text-sm mb-8">
            The porch risk score (0–100) is calculated from 10 weighted factors. Higher scores mean higher theft probability.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 text-slate-500 font-medium">Factor</th>
                  <th className="text-right py-3 text-slate-500 font-medium">Score impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {RISK_FACTORS.map((r) => (
                  <tr key={r.factor}>
                    <td className="py-3 text-slate-300">{r.factor}</td>
                    <td className={`py-3 text-right font-semibold ${
                      r.severity === "high" ? "text-red-400" :
                      r.severity === "medium" ? "text-amber-400" : "text-emerald-400"
                    }`}>{r.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-4">Base score: 30 · High risk: ≥65 · Medium: 35–64 · Low: &lt;35</p>
        </div>
      </section>

      {/* FAQ */}
      <div className="bg-slate-950">
        <FAQSection
          faqs={pricingFAQs}
          title="Pricing questions answered"
        />
      </div>
    </PageLayout>
  );
}
