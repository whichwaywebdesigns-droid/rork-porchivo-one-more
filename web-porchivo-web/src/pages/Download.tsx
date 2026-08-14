import { Link } from "react-router-dom";
import { Building2, ArrowRight, Check } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import AppStoreBadges from "@/components/AppStoreBadges";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("download");

const COMMUNITY_FEATURES = [
  "Unlimited package tracking — every carrier, no cap",
  "Theft Shield real-time porch risk alerts",
  "Porch Partner neighborhood network",
  "Community-wide theft alert feed",
  "HOA announcements and document portal",
  "Maintenance request management",
  "Resident directory and messaging",
];

export default function DownloadPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Download", url: seo.canonical }]),
    buildMobileAppSchema(),
  ];

  return (
    <PageLayout>
      <SEOHead
        title="Download Porchivo — Community Access on iOS & Android"
        description="Porchivo is available on iOS and Android. Access is provided by your homeowners association or property manager. Contact your community administrator for an invitation."
        canonical={seo.canonical}
        ogTitle="Download Porchivo — Community Access"
        ogDescription="Get Porchivo on iPhone or Android. Access is provided by your HOA or property manager."
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700 mb-6">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">HOA-Provided Access</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-100 mb-6 tracking-tight">
            Your community. <span className="text-amber-400">One app.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Download Porchivo on iOS or Android. Access is provided by your homeowners association
            or property manager — no subscriptions, no in-app purchases.
          </p>
          <AppStoreBadges />
        </div>
      </section>

      {/* Community Plan Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4">What's included</h2>
              <p className="text-slate-400 mb-6">
                Every resident gets full access through their community's plan:
              </p>
              <div className="space-y-3">
                {COMMUNITY_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
              <h3 className="text-lg font-bold text-slate-100 mb-3">Don't have access yet?</h3>
              <p className="text-sm text-slate-400 mb-6">
                Porchivo access is provided by your HOA board or property manager. If your community
                isn't on Porchivo yet, have them visit porchivo.com to get started.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
              >
                Learn how it works
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
