import { Link } from "react-router-dom";
import { Home, Building, DollarSign, Users, Heart, ArrowRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { USE_CASES } from "@/content/use-cases";

const seo = getPageSEO("useCases");

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, Building, DollarSign, Users, Heart,
};

const ACCENT_MAP: Record<string, { text: string; bg: string; badge: string }> = {
  "hoa-community-manager": { text: "text-violet-400", bg: "bg-violet-400/10", badge: "bg-violet-400/10 text-violet-400" },
  "resident-high-risk-deliveries": { text: "text-brand-orange", bg: "bg-brand-orange/10", badge: "bg-brand-orange/10 text-brand-orange" },
  "package-guardian": { text: "text-emerald-400", bg: "bg-emerald-400/10", badge: "bg-emerald-400/10 text-emerald-400" },
  "multi-property-manager": { text: "text-blue-400", bg: "bg-blue-400/10", badge: "bg-blue-400/10 text-blue-400" },
  "renter-apartment": { text: "text-blue-400", bg: "bg-blue-400/10", badge: "bg-blue-400/10 text-blue-400" },
  "homeowner-frequent-deliveries": { text: "text-brand-orange", bg: "bg-brand-orange/10", badge: "bg-brand-orange/10 text-brand-orange" },
  "porch-partner-earner": { text: "text-emerald-400", bg: "bg-emerald-400/10", badge: "bg-emerald-400/10 text-emerald-400" },
  "family-household": { text: "text-rose-400", bg: "bg-rose-400/10", badge: "bg-rose-400/10 text-rose-400" },
};

export default function UseCasesPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Use Cases", url: seo.canonical }]),
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
      <section className="pt-16 pb-16 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Use Cases", href: "/use-cases" }]} />
          <div className="mt-8 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary leading-tight mb-3">
              Porchivo protects every delivery scenario
            </h1>
            <p className="text-lg font-medium text-brand-text-secondary mb-4">
              From blocks to buildings — superior package and property tracking for homeowners and homeowner associations.
            </p>
            <p className="text-xl text-brand-text-secondary leading-relaxed">
              From solo renters to HOA communities, Porchivo adapts to how you receive packages and who you trust.
            </p>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-20">
        {USE_CASES.map((uc, index) => {
          const Icon = ICON_MAP[uc.icon] ?? Home;
          const ac = ACCENT_MAP[uc.id] ?? ACCENT_MAP["homeowner-frequent-deliveries"];
          const isEven = index % 2 === 0;

          return (
            <article key={uc.id} id={uc.id} className="scroll-mt-20">
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-start`}>
                {/* Content */}
                <div className={isEven ? "" : "lg:order-2"}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-xl ${ac.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${ac.text}`} />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ac.badge}`}>
                      {uc.persona}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-brand-text-primary mb-3">
                    {uc.headline}
                  </h2>
                  <p className="text-brand-text-secondary text-base leading-relaxed mb-6">{uc.summary}</p>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">The challenge</div>
                      <p className="text-sm text-brand-text-secondary leading-relaxed">{uc.challenge}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">How Porchivo helps</div>
                      <p className="text-sm text-brand-text-secondary leading-relaxed">{uc.solution}</p>
                    </div>
                  </div>
                </div>

                {/* Features + plan card */}
                <div className={isEven ? "" : "lg:order-1"}>
                  <div className="bg-brand-navy-900 border border-brand-navy-500/40 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-brand-navy-500/40">
                      <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-3">Key features used</div>
                      <ul className="space-y-2">
                        {uc.keyFeatures.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                            <span className={`w-1.5 h-1.5 rounded-full ${ac.text.replace("text-", "bg-")} mt-1.5 flex-shrink-0`} />
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-5">
                      <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">Recommended plan</div>
                      <div className={`text-sm font-semibold ${ac.text}`}>{uc.recommendedPlan}</div>
                    </div>
                  </div>
                </div>
              </div>

              {index < USE_CASES.length - 1 && (
                <div className="mt-16 border-b border-brand-navy-500/40/60" />
              )}
            </article>
          );
        })}
      </div>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-brand-navy-900/40 border-t border-brand-navy-500/40 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-brand-text-primary mb-4">Find your use case. Start free.</h2>
          <p className="text-brand-text-secondary mb-8">
            Free tier available for all users. Upgrade to Premium, Family, or HOA when you're ready.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/download" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange text-brand-text-primary font-bold transition-all hover:scale-[1.02]">
              Download free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-brand-navy-500/50 hover:border-brand-navy-500 text-brand-text-secondary font-medium transition-colors">
              View plans
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
