import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import Reveal from "@/components/landing/Reveal";

interface Tier {
  name: string;
  price: string;
  taglineKey: string;
  featureKeys: readonly string[];
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Essential",
    price: "$99",
    taglineKey: "landing.pricing.t1.tagline",
    featureKeys: [
      "landing.pricing.t1.f1",
      "landing.pricing.t1.f2",
      "landing.pricing.t1.f3",
      "landing.pricing.t1.f4",
    ],
  },
  {
    name: "Professional",
    price: "$499",
    taglineKey: "landing.pricing.t2.tagline",
    highlighted: true,
    featureKeys: [
      "landing.pricing.t2.f1",
      "landing.pricing.t2.f2",
      "landing.pricing.t2.f3",
      "landing.pricing.t2.f4",
    ],
  },
  {
    name: "Enterprise",
    price: "$1,499",
    taglineKey: "landing.pricing.t3.tagline",
    featureKeys: [
      "landing.pricing.t3.f1",
      "landing.pricing.t3.f2",
      "landing.pricing.t3.f3",
      "landing.pricing.t3.f4",
    ],
  },
];

/**
 * Pricing: three community tiers ($99 / $499 highlighted / $1,499), each with
 * a "Register Your Community" CTA. Residents always join free (footnote).
 */
export default function PricingSection() {
  const { t } = useTranslation();
  return (
    <section id="pricing" className="scroll-mt-24 border-y border-white/5 bg-pv-navy-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t("landing.pricing.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            {t("landing.pricing.sub")}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 130}>
              <div
                className={
                  tier.highlighted
                    ? "relative flex h-full flex-col rounded-3xl border border-pv-amber/40 bg-white/[0.05] p-7 shadow-[0_0_70px_-18px_rgba(52,211,153,0.45)] backdrop-blur-xl"
                    : "flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl"
                }
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-pv-amber px-4 py-1 font-display text-xs font-bold tracking-wide text-pv-navy">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    {t("landing.pricing.popular")}
                  </div>
                )}
                <h3 className="font-display text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold text-white">{tier.price}</span>
                  <span className="text-white/50">{t("landing.pricing.perMonth")}</span>
                </div>
                <p className="mt-2 text-sm text-white/50">{t(tier.taglineKey)}</p>
                <ul className="mt-7 flex-1 space-y-3">
                  {tier.featureKeys.map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-start gap-2.5 text-sm ${
                        tier.highlighted ? "text-white/80" : "text-white/70"
                      }`}
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tier.highlighted ? "text-pv-amber" : "text-pv-electric"
                        }`}
                        aria-hidden
                      />
                      {t(feature)}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/download"
                  className={
                    tier.highlighted
                      ? "mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-pv-amber px-6 py-3.5 font-display font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
                      : "mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 font-display font-semibold text-white transition-colors hover:border-pv-electric/50 hover:bg-pv-electric/10"
                  }
                >
                  {t("landing.cta.register")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-sm text-white/50">
            {t("landing.pricing.footnote")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
