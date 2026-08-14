import { Link } from "react-router-dom";
import { Building2, Check, Users, Shield, ArrowRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import AppStoreBadges from "@/components/AppStoreBadges";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildMobileAppSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";

const seo = getPageSEO("pricing");

export default function PricingPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "How It Works", url: seo.canonical }]),
    buildMobileAppSchema(),
  ];

  const features = [
    "Unlimited package tracking across all carriers",
    "Theft Shield real-time porch risk alerts",
    "Porch Partner neighborhood network",
    "Community-wide theft alert feed",
    "HOA announcement and document portal",
    "Maintenance request management",
    "Resident directory and messaging",
    "HOA dues payment processing",
    "Dedicated community admin dashboard",
  ];

  return (
    <PageLayout>
      <SEOHead
        title="Porchivo — HOA & Community Management Platform"
        description="Porchivo is a community management platform for homeowners associations and property managers. Access is provisioned by your HOA — no individual subscriptions required."
        canonical={seo.canonical}
        ogTitle="Porchivo — Community Management for HOAs"
        ogDescription="Porchivo access is provided by your homeowners association or property manager. Contact your community administrator for an invitation."
        schemas={schemas}
      />

      <section className="pt-16 pb-20 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700 mb-6">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">HOA-Provided Access</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-100 mb-6 tracking-tight">
            One platform. <span className="text-amber-400">Your whole community.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Porchivo is provisioned by your homeowners association or property management company.
            Residents are invited by their community administrator — no individual subscriptions,
            no in-app purchases, no app store billing.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4">How access works</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">1</div>
                  <div>
                    <h3 className="text-slate-200 font-semibold mb-1">Your HOA subscribes</h3>
                    <p className="text-sm text-slate-400">The HOA board or property manager purchases Porchivo for the entire community.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">2</div>
                  <div>
                    <h3 className="text-slate-200 font-semibold mb-1">Residents are invited</h3>
                    <p className="text-sm text-slate-400">The community administrator sends invitations to all residents.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">3</div>
                  <div>
                    <h3 className="text-slate-200 font-semibold mb-1">Full access — no payment</h3>
                    <p className="text-sm text-slate-400">Residents download the app, sign in with their invite, and get full access. No subscription, no paywall.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Community Plan</h3>
                  <p className="text-sm text-slate-400">Provided by your HOA</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="pt-6 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-4">
                  Not yet connected to a community? Contact your HOA board or property manager.
                  If your community isn't on Porchivo yet, visit porchivo.com to get started.
                </p>
                <AppStoreBadges />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <Users className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-4">For HOA Boards & Property Managers</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Porchivo gives your community one organized platform for package security, communication,
            maintenance requests, and resident engagement. One subscription covers your entire community.
          </p>
          <Link
            to="/download"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors"
          >
            Get Your Community Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
