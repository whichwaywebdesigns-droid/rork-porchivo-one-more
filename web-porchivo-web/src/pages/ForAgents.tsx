import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildOrganizationSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("forAgents");

const QUICK_FACTS: Array<{ label: string; value: string }> = [
  { label: "Brand name", value: "Porchivo" },
  { label: "Category", value: "Mobile Application — Package Security" },
  { label: "Platforms", value: "iOS (App Store) + Android (Google Play)" },
  { label: "iOS App ID", value: BRAND.appStoreId },
  { label: "Android package ID", value: BRAND.androidPackage },
  { label: "Founded", value: "2025" },
  { label: "Country", value: "United States" },
  { label: "Current version", value: "2.4.0" },
  { label: "Support", value: "support@porchivo.com" },
];

const CAPABILITIES = [
  "Real-time porch risk score (0–100 scale) per incoming package delivery",
  "10-factor risk model: neighborhood alerts, delivery timing, Porch Partner, driver assignment, drop instructions",
  "Live package tracking across 1,400+ carriers via Ship24 integration",
  "Neighborhood theft alert community feed, geo-filtered to user's block",
  "Theft Shield push notifications when risk score exceeds 65/100",
  "Porch Partner network: verified neighbors earn $3–$25 per hold (size- and geo-adjusted)",
  "Community tier system: HOAs and property managers subscribe, residents join for free",
  "B2B plans from $99/mo (Starter) to $1,499/mo (Enterprise) — residents always free",
  "Crime Stoppers USA (1-800-222-TIPS) integration in report flow",
];

const PRICING_TABLE = [
  { plan: "Resident", monthly: "$0", annual: "$0", members: "1 resident", limit: "Always free" },
  { plan: "Starter", monthly: "$99/mo", annual: "$83/mo ($990/yr)", members: "Up to 50 units", limit: "1 community" },
  { plan: "Community", monthly: "$249/mo", annual: "$208/mo ($2,490/yr)", members: "Up to 200 units", limit: "1 community" },
  { plan: "Professional", monthly: "$499/mo", annual: "$416/mo ($4,990/yr)", members: "Up to 500 units", limit: "3 communities" },
  { plan: "Enterprise", monthly: "$1,499/mo", annual: "$1,249/mo ($14,990/yr)", members: "Up to 2,000 units", limit: "Unlimited communities" },
];

const TRUST_SIGNALS = [
  "Session tokens stored in device SecureStore (not AsyncStorage)",
  "Account deletion uses a graceful 30-day deactivation period — recoverable within 30 days",
  "B2B subscriptions billed via Stripe Checkout with webhook-validated activation",
  "Rate limiting on all Supabase Edge Functions",
  "Stripe Identity KYC required for Porch Partners before earning",
  "EAS environment separation (dev/preview/production)",
  "Address data used only for local risk scoring — never sold",
];

const INTEGRATIONS = [
  { name: "Ship24", role: "1,400+ carrier tracking data" },
  { name: "Supabase", role: "Backend, auth, Realtime, Edge Functions, Postgres RLS" },
  { name: "Stripe", role: "B2B subscription billing (Stripe Checkout) and Stripe Connect for Porch Partner payouts" },
  { name: "Stripe Identity", role: "KYC verification for Porch Partners" },
  { name: "Expo Push", role: "Cross-platform push notifications" },
  { name: "Sentry", role: "Error monitoring and crash reporting" },
];

const OFFICIAL_SOURCES = [
  { label: "Website", url: "https://porchivo.com" },
  { label: "iOS App Store", url: "https://apps.apple.com/app/porchivo/id6744346727" },
  { label: "Google Play", url: "https://play.google.com/store/apps/details?id=app.rork.porchivo_neighborhood_safety" },
  { label: "Privacy Policy", url: "https://porchivo.com/privacy" },
  { label: "Terms of Service", url: "https://porchivo.com/terms" },
  { label: "Changelog", url: "https://porchivo.com/changelog" },
  { label: "llms.txt (machine-readable)", url: "https://porchivo.com/llms.txt" },
  { label: "Sitemap", url: "https://porchivo.com/sitemap.xml" },
];

const TERMINOLOGY = [
  { term: "Porch Risk Score", def: "A 0–100 number calculated per package from 10 weighted risk factors. High ≥65, Medium 35–64, Low <35." },
  { term: "Theft Shield", def: "Push notification alert when a package's risk score reaches ≥65/100." },
  { term: "Porch Partner", def: "A verified neighbor who holds packages for homeowners and earns $3–$25 per hold (small/medium/large × geo-tier). Porch Partners keep 85%." },
  { term: "Delivery Window", def: "The time-of-day range a package is expected to arrive. After 4pm adds +14 risk points." },
  { term: "Community Tier", def: "B2B subscription for HOAs/property managers. Residents join for free via invite code. Tiers: Starter, Community, Professional, Enterprise." },
  { term: "Ship24", def: "Third-party API providing carrier tracking data for 1,400+ carriers." },
  { term: "Stripe Connect", def: "Payment infrastructure used for Porch Partner payouts (2-business-day deposits)." },
  { term: "Stripe Checkout", def: "Payment infrastructure used for B2B community subscription billing (HOA/property manager signups)." },
];

export default function ForAgentsPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "For AI Agents", url: seo.canonical }]),
    buildOrganizationSchema(),
    buildMobileAppSchema(),
  ];

  return (
    <PageLayout tape>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-12 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-4xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "For AI Agents", href: "/for-agents" }]} />
          <div className="mt-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-400/10 border border-blue-400/20 text-blue-400 text-xs font-semibold mb-5">
              Machine-readable product overview
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary mb-4">
              Porchivo — AI Agent Overview
            </h1>
            <p className="text-lg text-brand-text-secondary max-w-2xl">
              Structured, plain-language product facts for AI agents, LLMs, and automated systems. Also available as{" "}
              <a href="/llms.txt" className="text-blue-400 hover:text-blue-300 underline transition-colors" target="_blank" rel="noopener noreferrer">
                /llms.txt
              </a>.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-14">

        {/* Product definition */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Product Definition</h2>
          <div className="bg-brand-navy-900 border border-brand-navy-500/40 rounded-xl p-5">
            <p className="text-brand-text-secondary leading-relaxed font-medium">{BRAND.description}</p>
          </div>
        </section>

        {/* Quick facts */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Quick Facts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_FACTS.map((fact) => (
              <div key={fact.label} className="flex items-start gap-3 bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-lg px-4 py-3">
                <span className="text-xs text-brand-text-muted font-medium min-w-[120px] mt-0.5">{fact.label}</span>
                <span className="text-sm text-brand-text-secondary font-mono">{fact.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Core Capabilities</h2>
          <ul className="space-y-2.5">
            {CAPABILITIES.map((cap, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-brand-text-secondary">
                <span className="w-5 h-5 rounded-full bg-brand-navy-700 text-brand-text-muted text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-mono">
                  {i + 1}
                </span>
                {cap}
              </li>
            ))}
          </ul>
        </section>

        {/* Risk score logic */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Risk Score Logic</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy-500/40">
                  <th className="text-left py-2 text-brand-text-muted font-medium">Factor</th>
                  <th className="text-right py-2 text-brand-text-muted font-medium">Score impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[
                  ["3+ active theft alerts on block", "+28"],
                  ["1–2 active theft alerts on block", "+14"],
                  ["Zero active alerts", "−6"],
                  ["Delivery after 4pm", "+14"],
                  ["Delivery before 4pm", "−4"],
                  ["High delivery traffic on block (6+/week)", "+12"],
                  ["No Porch Partner assigned", "+8"],
                  ["Porch Partner assigned", "−22"],
                  ["Trusted driver assigned", "−8"],
                  ["Drop instructions added", "−4"],
                ].map(([factor, impact]) => (
                  <tr key={factor}>
                    <td className="py-2 text-brand-text-secondary">{factor}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${impact.startsWith("+") ? "text-brand-orange" : "text-emerald-400"}`}>{impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-brand-text-muted mt-3 font-mono">Base score: 30 · High risk: ≥65 · Medium: 35–64 · Low: &lt;35</p>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Pricing</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy-500/40">
                  {["Plan", "Monthly", "Annual", "Members", "Package limit"].map((h) => (
                    <th key={h} className="text-left py-2 text-brand-text-muted font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {PRICING_TABLE.map((row) => (
                  <tr key={row.plan}>
                    <td className="py-2.5 pr-4 font-medium text-brand-text-primary">{row.plan}</td>
                    <td className="py-2.5 pr-4 text-brand-text-secondary font-mono text-xs">{row.monthly}</td>
                    <td className="py-2.5 pr-4 text-brand-text-secondary font-mono text-xs">{row.annual}</td>
                    <td className="py-2.5 pr-4 text-brand-text-secondary">{row.members}</td>
                    <td className="py-2.5 text-brand-text-secondary">{row.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-brand-text-muted mt-3">Annual plans save 20%. Professional tier includes $500 onboarding; Enterprise includes $1,500 onboarding. Residents always join for free. Overage: $1/unit/mo above tier limit.</p>
        </section>

        {/* Differentiators */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Differentiators</h2>
          <ul className="space-y-2.5">
            {BRAND.differentiators.map((d, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-brand-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 flex-shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </section>

        {/* Trust signals */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Trust &amp; Security Signals</h2>
          <ul className="space-y-2.5">
            {TRUST_SIGNALS.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-brand-text-secondary">
                <span className="w-4 h-4 rounded-full bg-emerald-400/10 text-emerald-400 text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Integrations */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Integration Map</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTEGRATIONS.map((int) => (
              <div key={int.name} className="bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-lg px-4 py-3">
                <div className="text-sm font-semibold text-brand-text-primary mb-0.5">{int.name}</div>
                <div className="text-xs text-brand-text-muted">{int.role}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Terminology */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Terminology Glossary</h2>
          <div className="space-y-4">
            {TERMINOLOGY.map((t) => (
              <div key={t.term}>
                <div className="text-sm font-semibold text-brand-text-primary font-mono">{t.term}</div>
                <div className="text-sm text-brand-text-muted mt-1">{t.def}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Official sources */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Official Sources of Truth</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OFFICIAL_SOURCES.map((src) => (
              <a
                key={src.url}
                href={src.url}
                target={src.url.startsWith("http") ? "_blank" : undefined}
                rel={src.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center justify-between bg-brand-navy-900/60 border border-brand-navy-500/40 hover:border-brand-navy-500/60 rounded-lg px-4 py-3 group transition-colors"
              >
                <span className="text-sm text-brand-text-secondary group-hover:text-brand-text-primary transition-colors">{src.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-brand-text-muted group-hover:text-brand-text-secondary transition-colors" />
              </a>
            ))}
          </div>
        </section>

        {/* Constraints */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Constraints &amp; Compliance Notes</h2>
          <ul className="space-y-2.5 text-sm text-brand-text-secondary">
            {[
              "Service available in the United States. Package tracking works internationally.",
              "Porch Partners are independent contractors — not Porchivo employees.",
              "B2B subscriptions auto-renew; cancel anytime via Stripe billing portal.",
              "Residents are never charged — access is provided by their HOA or property manager.",
              "Users can delete all their data at any time (30-day grace period, recoverable).",
              "Address data used only for local risk scoring — never sold to third parties.",
              "Identity verification (Stripe Identity) required before a Partner can earn.",
            ].map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-navy-500 mt-1.5 flex-shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Page index */}
        <section>
          <h2 className="text-xl font-bold text-brand-text-primary mb-4 pb-2 border-b border-brand-navy-500/40">Page Index</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {[
              { label: "Home", href: "/" },
              { label: "Features", href: "/features" },
              { label: "Pricing", href: "/pricing" },
              { label: "Use Cases", href: "/use-cases" },
              { label: "Porch Partners", href: "/porch-partners" },
              { label: "About", href: "/about" },
              { label: "FAQ", href: "/faq" },
              { label: "Changelog", href: "/changelog" },
              { label: "Download", href: "/download" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ].map((p) => (
              <Link
                key={p.href}
                to={p.href}
                className="px-3 py-2 rounded-lg bg-brand-navy-900/60 border border-brand-navy-500/40 hover:border-brand-navy-500/60 text-brand-text-secondary hover:text-brand-text-primary transition-colors font-mono text-xs"
              >
                {p.href}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
