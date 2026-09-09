import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface Tier {
  name: string;
  price: string;
  tagline: string;
  features: readonly string[];
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Essential",
    price: "$99",
    tagline: "For single communities getting started",
    features: [
      "Real-time risk scoring for every package",
      "Instant alerts to residents & Porch Partners",
      "Porch Partner delivery network",
      "Full chain-of-custody for every handoff",
    ],
  },
  {
    name: "Professional",
    price: "$499",
    tagline: "For communities that want the full picture",
    highlighted: true,
    features: [
      "Everything in Essential",
      "Community insights — risk zones, theft hotspots, delivery congestion",
      "Manager dashboard with live community activity",
      "Priority support & guided onboarding",
    ],
  },
  {
    name: "Enterprise",
    price: "$1,499",
    tagline: "For portfolios and multi-property operators",
    features: [
      "Everything in Professional",
      "Multi-property portfolio management",
      "Custom reporting & data export",
      "Dedicated success manager",
    ],
  },
];

/**
 * Pricing: three community tiers ($99 / $499 highlighted / $1,499), each with
 * a "Register Your Community" CTA. Residents always join free (footnote).
 */
export default function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 border-y border-white/5 bg-pv-navy-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Residents join free. Communities subscribe from $99/mo.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            HOAs and property managers pay one simple subscription. Residents
            get full access at no cost — no in-app purchases, no upsells.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 130}>
              <div
                className={
                  tier.highlighted
                    ? "relative flex h-full flex-col rounded-3xl border border-pv-amber/40 bg-white/[0.05] p-7 shadow-[0_0_70px_-18px_rgba(245,158,11,0.45)] backdrop-blur-xl"
                    : "flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl"
                }
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-pv-amber px-4 py-1 font-display text-xs font-bold tracking-wide text-pv-navy">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Most popular
                  </div>
                )}
                <h3 className="font-display text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold text-white">{tier.price}</span>
                  <span className="text-white/50">/mo</span>
                </div>
                <p className="mt-2 text-sm text-white/50">{tier.tagline}</p>
                <ul className="mt-7 flex-1 space-y-3">
                  {tier.features.map((feature) => (
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
                      {feature}
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
                  Register Your Community
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-sm text-white/50">Residents always join free.</p>
        </Reveal>
      </div>
    </section>
  );
}
