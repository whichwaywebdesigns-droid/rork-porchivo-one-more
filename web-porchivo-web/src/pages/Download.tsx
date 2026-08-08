import { Link } from "react-router-dom";
import { ShieldAlert, Check, Smartphone, ChevronRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import AppStoreBadges from "@/components/AppStoreBadges";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("download");

const FREE_INCLUDES = [
  "Track 1 package simultaneously",
  "Porch risk score for every delivery",
  "Neighborhood theft alerts",
  "10-minute live tracking refresh",
  "Porch Partner access",
];

const PREMIUM_ADDS = [
  "Unlimited package tracking",
  "90-second live refresh",
  "Theft Shield push alerts",
  "Priority risk scoring",
  "Full neighborhood alert history",
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
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Download", href: "/download" }]} />
          <div className="mt-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-500 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10 text-slate-950" strokeWidth={2} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4">
              Download Porchivo
            </h1>
            <p className="text-lg font-medium text-slate-300 max-w-xl mx-auto mb-3">
              From blocks to buildings — superior package and property tracking for homeowners and homeowner associations.
            </p>
            <p className="text-xl text-slate-400 max-w-xl mx-auto mb-10">
              Free on iOS and Android. Start protecting your deliveries in under 2 minutes.
            </p>
            <AppStoreBadges orientation="row" size="lg" />
            <p className="text-sm text-slate-600 mt-5">Free download · No credit card required</p>
          </div>
        </div>
      </section>

      {/* Free vs Premium */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-12">
            Start free. Upgrade when you need more.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
              <div className="text-sm font-medium text-slate-500 mb-1">Free tier</div>
              <div className="text-3xl font-bold text-slate-100 mb-1">$0</div>
              <div className="text-sm text-slate-500 mb-6">No time limit. Always free.</div>
              <ul className="space-y-3">
                {FREE_INCLUDES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <Check className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-b from-amber-500/8 to-transparent border border-amber-500/30 rounded-2xl p-7">
              <div className="inline-flex px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold mb-3">
                Best value — save 41%
              </div>
              <div className="text-sm font-medium text-slate-400 mb-1">Premium Annual</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-slate-100">$4.94</span>
                <span className="text-slate-500 text-sm">/mo, billed annually</span>
              </div>
              <div className="text-sm text-slate-500 mb-6">7-day free trial · Cancel anytime</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Everything in Free, plus:
              </div>
              <ul className="space-y-3">
                {PREMIUM_ADDS.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              View all plans including Family and HOA
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* System requirements */}
      <section className="py-16 px-4 sm:px-6 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-100 mb-8 text-center">System requirements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                platform: "iPhone (iOS)",
                icon: "🍎",
                requirements: [
                  "iOS 16.0 or later",
                  "iPhone 8 or newer recommended",
                  "~50 MB storage",
                  "Internet connection required",
                ],
                storeLink: BRAND.appStoreUrl,
                storeName: "App Store",
                appId: `ID: ${BRAND.appStoreId}`,
              },
              {
                platform: "Android",
                icon: "🤖",
                requirements: [
                  "Android 8.0 (Oreo) or later",
                  "~45 MB storage",
                  "Internet connection required",
                ],
                storeLink: BRAND.playStoreUrl,
                storeName: "Google Play",
                appId: "app.rork.porchivo_neighborhood_safety",
              },
            ].map((platform) => (
              <div key={platform.platform} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <div className="text-base font-semibold text-slate-200">{platform.platform}</div>
                    <div className="text-xs text-slate-600 font-mono">{platform.appId}</div>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {platform.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-sm text-slate-400">
                      <Smartphone className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
                <a
                  href={platform.storeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Download on {platform.storeName}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep link section */}
      <section className="py-20 px-4 sm:px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-100 mb-4">
            Get your first risk score in under 2 minutes
          </h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Download → Create account → Enter your address → Add a tracking number. Your porch risk score is live before the app finishes loading.
          </p>
          <AppStoreBadges orientation="row" size="lg" />
        </div>
      </section>
    </PageLayout>
  );
}
