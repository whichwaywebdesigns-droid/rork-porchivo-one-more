import { Link } from "react-router-dom";
import { Bell, MapPin, Package, ShieldCheck } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";
import { cities } from "@/data/cities";
import { buildBreadcrumbSchema, buildWebPageSchema } from "@/config/schema";

interface CityLandingProps {
  slug: string;
}

const STEPS = [
  {
    title: "Register your community",
    body: "About a five-minute setup, $0 hardware, no IT project.",
  },
  {
    title: "Residents join free",
    body: "One invite code and about a minute to join — always free, with no in-app purchases or upsells.",
  },
  {
    title: "Every package gets scored",
    body: "Each incoming package is scored 0–100 for theft risk from three factors: delivery timing pattern, neighborhood theft activity, and community delivery history. Scores keep updating until handoff.",
  },
  {
    title: "Alerts trigger action",
    body: "When a package crosses the risk threshold, residents and nearby Porch Partners are notified instantly. Every handoff gets a chain-of-custody log — timestamps, photos, identities — that managers can export.",
  },
] as const;

/**
 * Pre-rendered city landing page. All city-specific copy comes from
 * src/data/cities.ts; sections whose data field is empty are omitted so no
 * placeholder or invented local facts ever render.
 */
export default function CityLanding({ slug }: CityLandingProps) {
  const city = cities.find((entry) => entry.slug === slug);
  if (!city) return null;

  const canonical = `${BRAND.url}/${city.slug}`;
  const title = `Package Security in ${city.name}, ${city.state} — Porchivo`;
  const description = `${city.hook} Real-time theft-risk scoring, instant alerts, and Porch Partners who hold deliveries safely — no hardware required.`;

  return (
    <PageLayout>
      <SEOHead
        title={title}
        description={description}
        canonical={canonical}
        schemas={[
          buildWebPageSchema({ name: title, description, url: canonical }),
          buildBreadcrumbSchema([
            { name: "Home", url: `${BRAND.url}/` },
            { name: `${city.name}, ${city.state}`, url: canonical },
          ]),
        ]}
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            { label: `${city.name}, ${city.state}`, href: canonical },
          ]}
        />
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-brand-blue">
          Porchivo in {city.name}, {city.state}
        </p>
        <h1 className="mt-2 text-4xl font-bold text-brand-text-primary">{city.hook}</h1>
        <p className="mt-4 text-lg leading-relaxed text-brand-text-secondary">
          Porchivo scores every incoming package 0–100 for theft risk before it lands, alerts residents and nearby
          Porch Partners the moment a delivery looks risky, and keeps a chain-of-custody record for every handoff.
          No hardware to install — communities are up and running in about five minutes.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-brand-text-primary">
            How Porchivo protects {city.name} porches
          </h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="leading-relaxed">
                  <span className="font-semibold text-brand-text-primary">{step.title}. </span>
                  <span className="text-brand-text-secondary">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {city.neighborhoods.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-brand-text-primary">
              Neighborhoods we serve in {city.name}
            </h2>
            <p className="mt-3 leading-relaxed text-brand-text-secondary">
              Porchivo works for single-family streets, HOAs, and multi-family communities across the {city.name}{" "}
              area, including:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {city.neighborhoods.map((neighborhood) => (
                <li
                  key={neighborhood}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy-500/25 bg-white/85 px-3 py-1.5 text-sm text-brand-text-secondary dark:bg-brand-navy-800/60"
                >
                  <MapPin className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                  {neighborhood}
                </li>
              ))}
            </ul>
          </section>
        )}

        {city.theftNote && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-brand-text-primary">Package theft in {city.name}</h2>
            <p className="mt-3 leading-relaxed text-brand-text-secondary">{city.theftNote}</p>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-brand-navy-500/25 bg-white/85 p-6 shadow-sm dark:bg-brand-navy-800/60">
          <h2 className="flex items-center gap-2 text-xl font-bold text-brand-text-primary">
            <ShieldCheck className="h-5 w-5 text-brand-blue" aria-hidden />
            Porch Partners in {city.name}
          </h2>
          <p className="mt-3 leading-relaxed text-brand-text-secondary">
            A Porch Partner is a verified neighbor who holds your packages safely when you're not home — earning $5–$25
            per secure handoff while building a reputation score. Your HOA board controls whether the network is on.{" "}
            <Link to="/partners" className="font-medium text-brand-blue hover:underline">
              Learn about Porch Partners
            </Link>
            .
          </p>
        </section>

        {city.hoaHook && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-brand-text-primary">
              {city.name} HOAs and property managers
            </h2>
            <p className="mt-3 leading-relaxed text-brand-text-secondary">{city.hoaHook}</p>
          </section>
        )}

        <section className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/download"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-blue-light"
          >
            <Package className="h-4 w-4" aria-hidden />
            Register Your Community
          </Link>
          <Link
            to="/features"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-navy-500/30 px-6 py-3.5 font-semibold text-brand-text-primary transition-colors hover:border-brand-blue/50"
          >
            <Bell className="h-4 w-4" aria-hidden />
            See What's Included
          </Link>
        </section>
      </div>
    </PageLayout>
  );
}
