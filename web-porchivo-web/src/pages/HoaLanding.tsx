import { Link } from "react-router-dom";
import { Building, Check, ClipboardList, Gauge } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";
import { buildBreadcrumbSchema, buildWebPageSchema } from "@/config/schema";

const TITLE = "Package Security for HOAs & Property Managers — Porchivo";
const DESCRIPTION =
  "Real-time package risk scoring, instant alerts, a neighbor-held delivery network, and manager insights — no hardware, no IT project. Community plans from $99/mo.";

const CAPABILITIES = [
  {
    title: "Real-time risk scoring",
    body: "Every incoming package is scored 0–100 for theft risk from delivery timing patterns, neighborhood theft activity, and community delivery history — before it lands.",
  },
  {
    title: "Instant alerts",
    body: "When a package crosses the risk threshold, the resident and nearby Porch Partners are notified instantly — while the package is still on the porch.",
  },
  {
    title: "Porch Partner delivery network",
    body: "Verified neighbors hold packages safely and earn per secure handoff. Your board controls whether the network is on.",
  },
  {
    title: "Chain-of-custody records",
    body: "Every handoff gets a full log — timestamps, photos, identities — that managers can export when a claim or complaint comes in.",
  },
  {
    title: "Community insights",
    body: "Managers see active risk zones, theft hotspots, and delivery congestion across the community.",
  },
] as const;

/** Package security landing page for HOA boards and property managers. */
export default function HoaLanding() {
  const canonical = `${BRAND.url}/hoa`;

  return (
    <PageLayout>
      <SEOHead
        title={TITLE}
        description={DESCRIPTION}
        canonical={canonical}
        schemas={[
          buildWebPageSchema({ name: TITLE, description: DESCRIPTION, url: canonical }),
          buildBreadcrumbSchema([
            { name: "Home", url: `${BRAND.url}/` },
            { name: "For HOAs & Property Managers", url: canonical },
          ]),
        ]}
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: "For HOAs & Managers", href: canonical },
          ]}
        />
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-brand-blue">
          For HOAs & Property Managers
        </p>
        <h1 className="mt-2 text-4xl font-bold text-brand-text-primary">
          Package security your front desk doesn't have to run
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-brand-text-secondary">
          Package volume keeps climbing, and every missed or stolen delivery lands on your staff, your front desk, or
          your board's inbox. Porchivo watches every delivery instead: each package is scored for theft risk before it
          lands, residents and nearby Porch Partners are alerted the moment one looks risky, and every handoff leaves
          a chain-of-custody record you can export.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-brand-text-primary">What your community gets</h2>
          <ul className="mt-5 space-y-4">
            {CAPABILITIES.map((capability) => (
              <li
                key={capability.title}
                className="rounded-2xl border border-brand-navy-500/25 bg-white/85 p-5 shadow-sm dark:bg-brand-navy-800/60"
              >
                <h3 className="flex items-center gap-2 font-semibold text-brand-text-primary">
                  <Check className="h-4 w-4 text-brand-blue" aria-hidden />
                  {capability.title}
                </h3>
                <p className="mt-2 leading-relaxed text-brand-text-secondary">{capability.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-brand-navy-500/25 bg-white/85 p-6 shadow-sm dark:bg-brand-navy-800/60">
          <h2 className="flex items-center gap-2 text-xl font-bold text-brand-text-primary">
            <Building className="h-5 w-5 text-brand-blue" aria-hidden />
            Simple community plans
          </h2>
          <p className="mt-3 leading-relaxed text-brand-text-secondary">
            Communities subscribe from $99/mo (Essential) or $499/mo (Professional), scaling with community size.
            Residents always get full access free — no in-app purchases, no upsells. Setup takes about five minutes
            with zero hardware and no IT project.
          </p>
        </section>

        <section className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href={`mailto:${BRAND.supportEmail}?subject=Porchivo%20pilot%20request`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-blue-light"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Request a Pilot
          </a>
          <Link
            to="/download"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-navy-500/30 px-6 py-3.5 font-semibold text-brand-text-primary transition-colors hover:border-brand-blue/50"
          >
            <Gauge className="h-4 w-4" aria-hidden />
            Register Your Community
          </Link>
        </section>
      </div>
    </PageLayout>
  );
}
