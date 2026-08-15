import { Link } from "react-router-dom";
import { ShieldAlert, TrendingUp, Heart, ArrowRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import AppStoreBadges from "@/components/AppStoreBadges";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildOrganizationSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("about");

const VALUES = [
  {
    icon: ShieldAlert,
    color: "text-brand-orange",
    bg: "bg-brand-orange/10",
    title: "Predictive, not reactive",
    body: "Every existing porch theft solution tells you after it happened. We built Porchivo to tell you before. The risk score exists so you can act — not grieve.",
  },
  {
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Data that actually helps",
    body: "A risk number with no context is noise. Porchivo shows you exactly what's driving your score and exactly what to do about it — in the same interface.",
  },
  {
    icon: Heart,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    title: "Neighborhoods that earn",
    body: "The Porch Partner program isn't a feature — it's a philosophical choice. We believe the safest neighborhoods are the ones where neighbors have economic incentives to watch out for each other.",
  },
];

export default function AboutPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "About", url: seo.canonical }]),
    buildOrganizationSchema(),
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
        <div className="max-w-3xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "About", href: "/about" }]} />
          <div className="mt-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary leading-tight mb-6">
              We built Porchivo because the data should be on your side.
            </h1>
            <p className="text-xl text-brand-text-secondary leading-relaxed">
              {seo.aiSummary}
            </p>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-6">The problem we're solving</h2>
          <div className="space-y-5 text-brand-text-secondary leading-relaxed">
            <p>
              <strong className="text-brand-text-primary">119 million packages are stolen from US porches every year.</strong> That number isn't static — it grows every year as e-commerce volume increases and delivery density in residential neighborhoods rises.
            </p>
            <p>
              Homeowners are left with two options: expensive lockboxes that sit empty most of the year, or apps that notify them <em>after</em> theft has already occurred. Neither solves the problem.
            </p>
            <p>
              The root issue is that the data to predict theft already exists — neighborhood crime patterns, delivery timing windows, block-level alert density, seasonal theft spikes — but no one had assembled it into a per-package risk signal that a homeowner could actually act on in real time.
            </p>
            <p>
              <strong className="text-brand-text-primary">That's what Porchivo is.</strong> A risk intelligence layer for your front door. A porch risk score you can see before the delivery lands. A set of actions — assign a Porch Partner, add drop instructions, activate Theft Shield — that you can execute in 30 seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 sm:px-6 bg-brand-navy-900/40 border-y border-brand-navy-500/40">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { value: "119M", label: "packages stolen in the US annually", source: "USPS/CargoNet data" },
              { value: "$19B", label: "annual consumer loss to porch theft", source: "Industry estimate" },
              { value: "1 in 5", label: "delivered packages stolen", source: "National survey data" },
            ].map((stat) => (
              <div key={stat.value}>
                <div className="text-4xl font-bold text-brand-orange mb-1">{stat.value}</div>
                <div className="text-sm text-brand-text-secondary mb-1">{stat.label}</div>
                <div className="text-xs text-brand-text-muted">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-10">What we believe</h2>
          <div className="space-y-8">
            {VALUES.map((v) => (
              <div key={v.title} className="flex gap-5">
                <div className={`w-10 h-10 rounded-xl ${v.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <v.icon className={`w-5 h-5 ${v.color}`} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-brand-text-primary mb-1.5">{v.title}</h3>
                  <p className="text-sm text-brand-text-secondary leading-relaxed">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product info */}
      <section className="py-16 px-4 sm:px-6 bg-brand-navy-900/40 border-y border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-6">Product details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { label: "Platform", value: "iOS + Android" },
              { label: "Founded", value: BRAND.founded },
              { label: "Carriers", value: "1,400+" },
              { label: "Country", value: "United States" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl bg-brand-navy-900 border border-brand-navy-500/40">
                <div className="text-xs text-brand-text-muted mb-1">{item.label}</div>
                <div className="text-sm font-semibold text-brand-text-primary">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-brand-text-secondary mb-3">Technology stack</h3>
            <div className="flex flex-wrap gap-2">
              {BRAND.integrations.map((integration) => (
                <span key={integration} className="px-3 py-1.5 rounded-lg bg-brand-navy-700 text-xs text-brand-text-secondary">
                  {integration}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact + download */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary mb-4">Contact</h2>
            <div className="space-y-3 text-sm text-brand-text-secondary">
              <div>
                <div className="text-xs text-brand-text-muted mb-0.5">Support</div>
                <a href={`mailto:${BRAND.supportEmail}`} className="text-brand-orange hover:text-brand-orange-light transition-colors">
                  {BRAND.supportEmail}
                </a>
              </div>
              <div>
                <div className="text-xs text-brand-text-muted mb-0.5">Press</div>
                <a href={`mailto:${BRAND.pressEmail}`} className="text-brand-orange hover:text-brand-orange-light transition-colors">
                  {BRAND.pressEmail}
                </a>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-brand-text-secondary mb-3">Download</h3>
              <AppStoreBadges orientation="stack" size="sm" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-text-primary mb-4">Quick links</h2>
            <div className="space-y-2">
              {[
                { label: "Features overview", href: "/features" },
                { label: "Pricing plans", href: "/pricing" },
                { label: "Porch Partner program", href: "/porch-partners" },
                { label: "FAQ", href: "/faq" },
                { label: "Changelog", href: "/changelog" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-brand-text-muted" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
