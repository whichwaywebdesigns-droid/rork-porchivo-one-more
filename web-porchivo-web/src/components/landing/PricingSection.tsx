import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

const FREE_FEATURES = [
  "Basic delivery alerts",
  "Set your home zone",
  "Join a neighbor circle",
] as const;

const PREMIUM_FEATURES = [
  "Smarter risk-aware alerts",
  "Full proof locker storage",
  "Trusted neighbor tools",
  "Everything in Free",
] as const;

/** Pricing: Free vs Premium ($4.99/mo) with the amber-glow highlighted card. */
export default function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 border-y border-white/5 bg-pv-navy-800/60 py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Simple pricing
          </h2>
          <p className="mt-4 text-lg text-white/60">Start free. Upgrade when your block does.</p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Free card */}
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
              <h3 className="font-display text-lg font-semibold text-white">Free</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold text-white">$0</span>
                <span className="text-white/50">/mo</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-pv-electric" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/download"
                className="mt-8 inline-flex justify-center rounded-xl border border-white/20 px-6 py-3.5 font-display font-semibold text-white transition-colors hover:border-pv-electric/50 hover:bg-pv-electric/10"
              >
                Start Free
              </Link>
            </div>
          </Reveal>

          {/* Premium card — amber glow highlight */}
          <Reveal delay={130}>
            <div className="relative flex h-full flex-col rounded-3xl border border-pv-amber/40 bg-white/[0.05] p-7 shadow-[0_0_70px_-18px_rgba(245,158,11,0.45)] backdrop-blur-xl">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-pv-amber px-4 py-1 font-display text-xs font-bold tracking-wide text-pv-navy">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                7 days free
              </div>
              <h3 className="font-display text-lg font-semibold text-white">Premium</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold text-white">$4.99</span>
                <span className="text-white/50">/mo</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-pv-amber" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/download"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-pv-amber px-6 py-3.5 font-display font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
              >
                Start Free — 7 Days Premium
              </Link>
              <p className="mt-3 text-center text-xs text-white/40">Cancel anytime.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
