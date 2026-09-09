import { Building2, Gauge, BellRing, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface Step {
  n: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Register your community",
    body: "Sign up your HOA or property in five minutes. No hardware, no installation, no IT integration.",
    icon: Building2,
  },
  {
    n: "02",
    title: "Residents join free",
    body: "Residents download the app and join with your invite code — and can join the Porch Partner network for safer deliveries, extra income, and neighborhood reputation.",
    icon: UserPlus,
  },
  {
    n: "03",
    title: "Risk scores update continuously",
    body: "Every incoming package gets a real-time risk score based on timing, neighborhood activity, and theft history.",
    icon: Gauge,
  },
  {
    n: "04",
    title: "Alerts trigger action",
    body: "Residents and Porch Partners are notified instantly when risk thresholds are crossed, with a full chain-of-custody for every handoff.",
    icon: BellRing,
  },
];

/**
 * How-it-works: four floating glass cards (gentle staggered hover-float)
 * connected by a glowing connector line on desktop, scroll-staggered reveal.
 */
export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden py-24"
    >
      {/* Ambient blue wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[720px] max-w-full -translate-x-1/2 rounded-full bg-pv-electric/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How Porchivo works for your community
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            No hardware. No IT project. Protect every resident&apos;s deliveries
            in four simple steps.
          </p>
        </Reveal>

        {/* Glowing connector line (desktop) */}
        <div aria-hidden className="relative mt-14 hidden lg:block">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-pv-electric/50 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pv-amber shadow-[0_0_16px_4px_rgba(245,158,11,0.5)] motion-safe:animate-pulse" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:mt-0">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 130}>
              <div className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-pv-electric/40 hover:shadow-2xl hover:shadow-pv-electric/20 motion-safe:hover:animate-none motion-safe:animate-float [animation-delay:calc(var(--step-index)*0.7s)]"
                style={{ "--step-index": index } as React.CSSProperties}
              >
                {/* Corner glow on hover */}
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-pv-electric/15 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-display text-sm font-bold tracking-widest text-pv-electric-light">
                    {step.n}
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pv-amber/25 bg-pv-amber/10">
                    <step.icon className="h-5 w-5 text-pv-amber" aria-hidden />
                  </div>
                </div>
                <h3 className="font-display text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
