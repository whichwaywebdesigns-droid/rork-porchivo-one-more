import { Link } from "react-router-dom";
import { ShieldAlert, Check, Smartphone, ChevronRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import AppStoreBadges from "@/components/AppStoreBadges";
import ShareButton from "@/components/ShareButton";
import ShippingLabelCard from "@/components/ShippingLabelCard";
import PackingListTable from "@/components/PackingListTable";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("download");

const FREE_INCLUDES = [
  "Package tracking with real-time porch risk score",
  "Neighborhood theft alerts (geo-filtered to your block)",
  "Porch Partner network — earn $3–$25 per hold",
  "Community features unlocked when your HOA joins",
  "No credit card required, no time limit",
];

export default function DownloadPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Download", url: seo.canonical }]),
    buildMobileAppSchema(),
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
      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-brand-navy-500/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Download", href: "/download" }]} />
          <div className="mt-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-brand-orange flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10 text-brand-text-primary" strokeWidth={2} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary mb-4">
              Download Porchivo
            </h1>
            <p className="text-lg font-medium text-brand-text-secondary max-w-xl mx-auto mb-3">
              From blocks to buildings — superior package and property tracking for homeowners and homeowner associations.
            </p>
            <p className="text-xl text-brand-text-secondary max-w-xl mx-auto mb-10">
              Free on iOS and Android. Start protecting your deliveries in under 2 minutes.
            </p>
            <AppStoreBadges orientation="row" size="lg" />
            <p className="text-sm text-brand-text-muted mt-5">Free download · No credit card required</p>
            <div className="mt-5">
              <ShareButton label="Invite Friends" />
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Community */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary text-center mb-12">
            Residents are always free. Communities subscribe.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="label-card bg-brand-navy-900 border-brand-navy-500/40 rounded-2xl p-7">
              <div className="text-sm font-medium text-brand-text-muted mb-1">Residents</div>
              <div className="text-3xl font-bold text-brand-text-primary mb-1">$0</div>
              <div className="text-sm text-brand-text-muted mb-6">Always free. No credit card, no time limit.</div>
              <ul className="space-y-3">
                {FREE_INCLUDES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                    <Check className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="barcode-strip mt-6" aria-hidden />
            </div>

            <div className="bg-gradient-to-b from-brand-orange/8 to-transparent border border-brand-orange/30 rounded-2xl p-7">
              <div className="inline-flex px-2.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-semibold mb-3">
                For HOAs & Property Managers
              </div>
              <div className="text-sm font-medium text-brand-text-secondary mb-1">Community Plans</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-brand-text-primary">$99</span>
                <span className="text-brand-text-muted text-sm">/mo starting</span>
              </div>
              <div className="text-sm text-brand-text-muted mb-6">From Starter (50 units) to Enterprise (2,000 units). Annual includes 2 months free.</div>
              <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-3">
                Your subscription unlocks:
              </div>
              <ul className="space-y-3">
                {[
                  "Full access for every resident — at no cost to them",
                  "Community announcements & maintenance requests",
                  "HOA dues collection & payments",
                  "Amenity reservations & board roles",
                  "White-label & API access (Enterprise)",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-brand-text-secondary">
                    <Check className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text-secondary transition-colors"
            >
              Compare all community plans
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* System requirements */}
      <section className="py-16 px-4 sm:px-6 bg-brand-navy-900/40 border-y border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-brand-text-primary mb-8 text-center">System requirements</h2>
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
              <div key={platform.platform} className="bg-brand-navy-900 border border-brand-navy-500/40 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <div className="text-base font-semibold text-brand-text-primary">{platform.platform}</div>
                    <div className="text-xs text-brand-text-muted font-mono">{platform.appId}</div>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {platform.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-sm text-brand-text-secondary">
                      <Smartphone className="w-3.5 h-3.5 text-brand-text-muted flex-shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
                <a
                  href={platform.storeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2.5 rounded-lg border border-brand-navy-500/50 hover:border-brand-navy-500 text-sm font-medium text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                >
                  Download on {platform.storeName}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview — sample screens wrapped in the shipping-label frame.
          Decorative showcase blocks; every link inside remains fully functional. */}
      <section className="py-20 px-4 sm:px-6 border-t border-brand-navy-500/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="label-header mb-3">Inside the app</div>
            <h2 className="text-2xl font-bold text-brand-text-primary mb-3">
              Every delivery arrives looking like this
            </h2>
            <p className="text-sm text-brand-text-secondary max-w-xl mx-auto leading-relaxed">
              Orders, live tracking, and receipts — stamped, sorted, and scored
              against your block's theft risk. Here's what a shipment looks like in Porchivo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 items-start">
            {/* ── Order details ── */}
            <ShippingLabelCard priority="STANDARD" showTape>
              <h3 className="text-[15px] font-bold text-brand-text-primary mb-4">Order #PKG-2026-0892</h3>
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ["Carrier", "UPS Ground"],
                  ["Delivered", "Today, 2:47 PM"],
                  ["Left at", "Front porch"],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-3">
                    <dt className="text-brand-text-muted">{term}</dt>
                    <dd className="font-medium text-right text-brand-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 inline-flex px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold uppercase tracking-wide">
                Risk score 12/100 — Low
              </p>
            </ShippingLabelCard>

            {/* ── Tracking info ── */}
            <ShippingLabelCard
              priority="PRIORITY"
              trackingNumber="7712 3456 8901"
              showTape
            >
              <h3 className="text-[15px] font-bold text-brand-text-primary mb-4">Out for delivery</h3>
              <ol className="space-y-3 text-[13px]">
                {["Origin scan — Memphis TN", "Arrived at local hub", "On vehicle · ETA 1–4 PM"].map((step, i) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${
                      i === 2 ? "bg-brand-orange text-white" : "bg-brand-navy-900/10 text-brand-text-muted"
                    }`}>
                      {i + 1}
                    </span>
                    <span className={i === 2 ? "font-semibold text-brand-text-primary" : "text-brand-text-muted"}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 inline-flex px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-[11px] font-semibold uppercase tracking-wide">
                High-risk hours · Partner nearby
              </p>
            </ShippingLabelCard>

            {/* ── Invoice summary ── */}
            <ShippingLabelCard>
              <h3 className="text-[15px] font-bold text-brand-text-primary mb-4">Invoice summary</h3>
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ["Plan", "Starter Community"],
                  ["Amount", "$99.00 / month"],
                  ["Next payment", "Sep 1, 2026"],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-3">
                    <dt className="text-brand-text-muted">{term}</dt>
                    <dd className="font-medium text-right text-brand-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 inline-flex px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold uppercase tracking-wide">
                Paid
              </p>
              <div className="mt-5 pt-4 border-t border-dashed border-brand-navy-500/30">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue-light hover:text-brand-blue transition-colors"
                >
                  Compare community plans
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </ShippingLabelCard>
          </div>

          {/* ── Packing-list / payout receipt ── */}
          <div className="mt-16 max-w-md mx-auto">
            <PackingListTable
              header={{
                company: "PORCHIVO, INC.",
                address: "800 Sycamore St, Evansville, IN 47708",
                orderNumber: "ORD-2026-0892",
                date: "Aug 20, 2026",
              }}
              columns={["Item", "Qty", "Rate", "Amount"]}
              footer={{
                message: "Thank you for your business!",
                contactEmail: BRAND.supportEmail,
              }}
              isPaid
              showTape
              totals={
                <tr>
                  <td colSpan={2}>Total paid</td>
                  <td>$26.00</td>
                  <td className="text-right">$26.00</td>
                </tr>
              }
            >
              <tr>
                <td>Package hold · 3 nights</td>
                <td>1</td>
                <td>$9.00</td>
                <td className="text-right">$9.00</td>
              </tr>
              <tr>
                <td>Weekend hold · Sat–Sun</td>
                <td>1</td>
                <td>$12.00</td>
                <td className="text-right">$12.00</td>
              </tr>
              <tr>
                <td>Referral bonus</td>
                <td>1</td>
                <td>$5.00</td>
                <td className="text-right">$5.00</td>
              </tr>
            </PackingListTable>
            <p className="mt-4 text-center text-xs text-brand-text-muted">
              Porch Partner payouts print a real paper trail — every hold,
              bonus, and total, stamped and dated.
            </p>
          </div>
        </div>
      </section>

      {/* Deep link section */}
      <section className="py-20 px-4 sm:px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-brand-text-primary mb-4">
            Get your first risk score in under 2 minutes
          </h2>
          <p className="text-brand-text-secondary text-sm mb-8 leading-relaxed">
            Download → Create account → Enter your address → Add a tracking number. Your porch risk score is live before the app finishes loading.
          </p>
          <AppStoreBadges orientation="row" size="lg" />
        </div>
      </section>
    </PageLayout>
  );
}
