import { Link } from "react-router-dom";
import { ShieldAlert, Bell, BellRing, Package, ArrowRight, MapPin, Users, Globe, Building2, UserPlus, Gauge } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import AppStoreBadges from "@/components/AppStoreBadges";
import FAQSection from "@/components/FAQSection";
import { getPageSEO } from "@/config/seo";
import {
  buildWebPageSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildMobileAppSchema,
} from "@/config/schema";
import { BRAND } from "@/config/brand";
import { FEATURES } from "@/content/features";
import { getFAQsByCategory } from "@/content/faqs";
import { useCountUp } from "@/hooks/useCountUp";

const seo = getPageSEO("home");
const homeFAQs = getFAQsByCategory("general").slice(0, 4);

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldAlert,
  Bell,
  Package,
  MapPin,
  Users,
};

const HIGHLIGHT_FEATURES = FEATURES.filter((f) =>
  ["porch-risk-score", "guardian-network", "community-insights", "easy-setup"].includes(f.id)
);

function StatCard({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { value: count, ref } = useCountUp(value);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6 text-center"
    >
      <div className="text-4xl sm:text-5xl font-bold text-brand-orange mb-2">
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm text-brand-text-secondary leading-snug">{label}</div>
    </div>
  );
}

export default function IndexPage() {
  const schemas = [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildMobileAppSchema(),
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
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

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 sm:px-6 border-b border-brand-navy-500/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative text-center">
          {/* Hero image */}
          <div className="relative mx-auto mb-10 max-w-5xl rounded-3xl overflow-hidden shadow-2xl shadow-brand-blue/10 border border-brand-blue/15">
            {/* App icon badge centered over the before/after split */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              <div className="flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-2xl bg-brand-navy-800/90 backdrop-blur-xl border border-brand-blue/20 shadow-xl">
                <img
                  src="/porchivo-icon-liquid-glass-512.png"
                  alt="Porchivo"
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl shadow-sm"
                />
                <span className="text-gradient-brand text-2xl sm:text-3xl font-black tracking-tight leading-none">
                  Porchivo
                </span>
              </div>
            </div>
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-navy-900/40 via-transparent to-brand-navy-900/40" />
              <div className="absolute inset-0 bg-gradient-to-b from-brand-navy-900/20 via-transparent to-brand-navy-900/50" />
              <div className="hero-edge-blur absolute inset-0" />
            </div>
            <img
              src="/hero-mailroom.jpg"
              alt="Before and after: a chaotic HOA mailroom transformed into an organized Smart HOA Mail Center by Porchivo"
              className="w-full h-full object-cover min-h-[260px] sm:min-h-[420px] max-h-[560px]"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            {BRAND.shortTagline}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-brand-text-primary leading-tight mb-4">
            Package security and resident retention for HOAs, property managers, and community associations
          </h1>
          <p className="text-lg sm:text-xl font-medium text-brand-text-secondary max-w-2xl mx-auto mb-6">
            Real-time package risk scoring, instant alerts to residents and Porch Partners, and a neighbor-held delivery network — with no hardware or IT project required.
          </p>
          <p className="text-xl text-brand-text-secondary leading-relaxed max-w-3xl mx-auto mb-6">
            {BRAND.description}
          </p>
          <p className="text-lg text-brand-text-secondary leading-relaxed max-w-3xl mx-auto mb-4">
            Porchivo reduces management workload, surfaces community insights, and keeps residents satisfied — so they renew.
          </p>
          <p className="text-lg text-brand-text-secondary leading-relaxed max-w-3xl mx-auto mb-6">
            HOAs and property managers subscribe from $99–$1,499/mo. Residents always join free.
          </p>
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-navy-900/60 border border-brand-navy-500/40 text-brand-text-secondary text-sm font-medium">
              <Globe className="w-4 h-4 text-brand-orange" />
              Built to work in 190+ countries worldwide
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange text-brand-text-primary font-bold transition-all hover:scale-[1.02]"
            >
              Download Porchivo
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-brand-navy-500/50 hover:border-brand-navy-500 text-brand-text-secondary font-medium transition-colors"
            >
              See how it works
            </Link>
          </div>
          <div className="flex justify-center">
            <AppStoreBadges />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard value={119} suffix="M" label="packages stolen in the US every year" />
          <StatCard value={20} suffix="%" label="of delivered packages are stolen from porches" />
          <StatCard value={5} label="minutes to register a community and start protecting deliveries" />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-text-primary mb-4">How Porchivo works for your community</h2>
            <p className="text-lg text-brand-text-secondary max-w-2xl mx-auto">
              No hardware. No IT project. Protect every resident's deliveries in four simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="relative overflow-hidden bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6">
              <Building2 aria-hidden className="absolute -bottom-5 -right-5 w-28 h-28 text-brand-orange opacity-[0.07] pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                  <span className="text-brand-orange font-bold text-lg">1</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-brand-orange" />
                </div>
              </div>
              <p className="text-sm font-semibold text-brand-orange mb-1">Register your community</p>
              <p className="text-brand-text-secondary text-sm leading-relaxed">
                Sign up your HOA or property in five minutes. No hardware, no installation, no IT integration.
              </p>
            </div>
            <div className="relative overflow-hidden bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6">
              <UserPlus aria-hidden className="absolute -bottom-5 -right-5 w-28 h-28 text-brand-orange opacity-[0.07] pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                  <span className="text-brand-orange font-bold text-lg">2</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-brand-orange" />
                </div>
              </div>
              <p className="text-sm font-semibold text-brand-orange mb-1">Residents join free</p>
              <p className="text-brand-text-secondary text-sm leading-relaxed">
                Residents download the app and join with your invite code. They authorize trusted Porch Partners from their neighborhood.
              </p>
            </div>
            <div className="relative overflow-hidden bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6">
              <Gauge aria-hidden className="absolute -bottom-5 -right-5 w-28 h-28 text-brand-orange opacity-[0.07] pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                  <span className="text-brand-orange font-bold text-lg">3</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-brand-orange" />
                </div>
              </div>
              <p className="text-sm font-semibold text-brand-orange mb-1">Risk scores update continuously</p>
              <p className="text-brand-text-secondary text-sm leading-relaxed">
                Every incoming package gets a real-time risk score based on timing, neighborhood activity, and theft history.
              </p>
            </div>
            <div className="relative overflow-hidden bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6">
              <BellRing aria-hidden className="absolute -bottom-5 -right-5 w-28 h-28 text-brand-orange opacity-[0.07] pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                  <span className="text-brand-orange font-bold text-lg">4</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                  <BellRing className="w-6 h-6 text-brand-orange" />
                </div>
              </div>
              <p className="text-sm font-semibold text-brand-orange mb-1">Alerts trigger action</p>
              <p className="text-brand-text-secondary text-sm leading-relaxed">
                Residents and Porch Partners are notified instantly when risk thresholds are crossed, with a full chain-of-custody for every handoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-20 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <h2 className="text-3xl font-bold text-brand-text-primary mb-3">Everything your community needs to protect deliveries and retain residents</h2>
              <p className="text-brand-text-secondary text-lg">Real-time scoring, alerts, Porch Partner handoffs, and manager insights — all in one app.</p>
            </div>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 text-brand-orange hover:text-brand-orange-light font-medium transition-colors"
            >
              All features
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HIGHLIGHT_FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon] ?? ShieldAlert;
              return (
                <div
                  key={feature.id}
                  className="bg-brand-navy-900/60 border border-brand-navy-500/40 rounded-2xl p-6 hover:border-brand-navy-500/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h3 className="text-lg font-semibold text-brand-text-primary mb-2">{feature.name}</h3>
                  <p className="text-brand-text-secondary text-sm leading-relaxed">{feature.tagline}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-brand-text-primary mb-4">Residents join free. Communities subscribe from $99/mo.</h2>
          <p className="text-brand-text-secondary text-lg mb-8">
            HOAs and property managers pay one simple subscription. Residents get full access at no cost — no in-app purchases, no upsells.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-brand-navy-500/50 hover:border-brand-navy-500 text-brand-text-secondary font-medium transition-colors"
            >
              View community plans
            </Link>
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-colors"
            >
              Download free
            </Link>
          </div>
        </div>
      </section>

      <FAQSection
        faqs={homeFAQs}
        title="Common questions"
        subtitle="Quick answers about how Porchivo protects your deliveries."
      />
    </PageLayout>
  );
}
