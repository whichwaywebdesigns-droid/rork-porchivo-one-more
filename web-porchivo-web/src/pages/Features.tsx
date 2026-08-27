import { Link } from "react-router-dom";
import { ShieldAlert, Bell, Package, MapPin, Users, Clock, Zap, Heart, Building, ArrowRight, Check } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { FEATURES } from "@/content/features";

const seo = getPageSEO("features");

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldAlert, Bell, Package, MapPin, Users, Clock, Zap, Heart, Building,
};

const ACCENT_MAP: Record<string, string> = {
  "porch-risk-score": "amber",
  "theft-shield": "red",
  "guardian-network": "emerald",
  "community-insights": "blue",
  "live-tracking": "violet",
  "easy-setup": "orange",
  "resident-retention": "rose",
  "community-plan": "slate",
};

const accentClasses: Record<string, { text: string; bg: string; border: string }> = {
  amber: { text: "text-brand-orange", bg: "bg-brand-orange/10", border: "border-brand-orange/20" },
  red: { text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  blue: { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  violet: { text: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  rose: { text: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" },
  slate: { text: "text-brand-text-secondary", bg: "bg-brand-navy-800/40", border: "border-brand-navy-500/30" },
};

export default function FeaturesPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Features", url: seo.canonical }]),
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
      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }]} />
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary leading-tight mb-5">
                Everything your community needs to protect deliveries and retain residents
              </h1>
              <p className="text-xl text-brand-text-secondary leading-relaxed">
                {seo.aiSummary}
              </p>
            </div>
            <div>
              {/* Edge-faded community handoff photo (soft radial mask on all sides) */}
              <img
                src="/images/community-handoff.jpg"
                alt="A Porch Partner handing a package to a neighbor over a wooden fence"
                className="w-full h-auto"
                style={{
                  WebkitMaskImage:
                    "radial-gradient(ellipse 72% 72% at 50% 50%, black 55%, transparent 98%)",
                  maskImage:
                    "radial-gradient(ellipse 72% 72% at 50% 50%, black 55%, transparent 98%)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features list */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-16">
        {FEATURES.map((feat) => {
          const Icon = ICON_MAP[feat.icon];
          const accent = ACCENT_MAP[feat.id] ?? "amber";
          const ac = accentClasses[accent] ?? accentClasses.amber;

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
      </div>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-brand-navy-900/40 border-t border-brand-navy-500/40">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-brand-text-primary mb-4">Ready to protect your community's deliveries?</h2>
          <p className="text-brand-text-secondary mb-8">Residents join free. HOAs and property managers subscribe from $99/mo.</p>
          <Link to="/download" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange text-brand-text-primary font-bold transition-all hover:scale-[1.02]">
            Download Porchivo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
