import { Link } from "react-router-dom";
import { ShieldAlert, Bell, Package, ArrowRight, MapPin, Users, Globe } from "lucide-react";
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
  ["porch-risk-score", "theft-shield", "live-tracking"].includes(f.id)
);

function StatCard({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { value: count, ref } = useCountUp(value);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center"
    >
      <div className="text-4xl sm:text-5xl font-bold text-amber-400 mb-2">
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm text-slate-400 leading-snug">{label}</div>
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
    <PageLayout>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 sm:px-6 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/8 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {BRAND.shortTagline}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-slate-100 leading-tight mb-4">
            Porch pirate protection starts with knowing your porch risk{" "}
            <span className="text-amber-400">before every delivery</span>
          </h1>
          <p className="text-lg sm:text-xl font-medium text-slate-300 max-w-2xl mx-auto mb-6">
            From blocks to buildings — superior package and property tracking for homeowners, homeowner associations, and HOA package management.
          </p>
          <p className="text-xl text-slate-400 leading-relaxed max-w-3xl mx-auto mb-6">
            {BRAND.description}
          </p>
          <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto mb-4">
            Porchivo is the package delivery security app for modern homes.
          </p>
          <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto mb-6">
            It's smart home package protection for every package that lands at your door.
          </p>
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 text-slate-300 text-sm font-medium">
              <Globe className="w-4 h-4 text-amber-400" />
              Built to work in 190+ countries worldwide
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all hover:scale-[1.02]"
            >
              Download Porchivo
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
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
      <section className="py-16 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard value={119} suffix="M" label="packages stolen in the US every year" />
          <StatCard value={20} suffix="%" label="of delivered packages are stolen from porches" />
          <StatCard value={1400} suffix="+" label="carriers tracked via Ship24 integration" />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">How Porchivo works: package delivery security app</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              From porch-piracy problem to protected delivery — in four simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <img
                src="/images/why-porchivo-porch-piracy.png"
                alt="Porch pirate protection starts with understanding porch piracy — 1 in 5 households are hit"
                loading="lazy"
                className="w-full h-auto"
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-amber-400 mb-1">1. The problem</p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Porch piracy is an everyday problem — 1 in 5 households are hit.
                </p>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <img
                src="/images/how-it-works-three-taps.png"
                alt="Porch package security workflow: track, assign a Porch Partner, and receive in three taps"
                loading="lazy"
                className="w-full h-auto"
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-amber-400 mb-1">2. The solution</p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Track your package, assign a trusted neighbor, and receive — three taps.
                </p>
                <p className="text-slate-500 text-sm leading-relaxed mt-2">
                  Great for when you are going to be home late or about to take a vacation!
                </p>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <img
                src="/images/how-it-works-package-secured.png"
                alt="Delivery theft alert and package secured confirmation when your Porch Partner takes custody"
                loading="lazy"
                className="w-full h-auto"
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-amber-400 mb-1">3. The outcome</p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Get an instant "Package secured" confirmation when your partner takes custody.
                </p>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <img
                src="/images/built-on-trust-real-neighbors.png"
                alt="Trusted neighbor delivery hold and neighborhood package safety with verified Porchivo neighbors"
                loading="lazy"
                className="w-full h-auto"
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-amber-400 mb-1">4. The trust layer</p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Verified, private, local. Real neighbors keep each other accountable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-20 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-100 mb-3">Porch package security, delivery theft alerts, and trusted neighbor delivery holds</h2>
              <p className="text-slate-400 text-lg">Everything you need for neighborhood package safety and HOA package management.</p>
            </div>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium transition-colors"
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
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.tagline}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-100 mb-4">Free to start. Upgrade for HOA package management and neighborhood package safety.</h2>
          <p className="text-slate-400 text-lg mb-8">
            Track up to 3 packages free. Premium unlocks unlimited tracking, Theft Shield alerts, and 90-second live refresh.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
            >
              View pricing
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
