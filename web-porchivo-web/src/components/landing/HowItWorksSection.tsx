import { useCallback, useEffect, useState } from "react";
import { BellRing, Gift, MapPin, Users, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import { useInView } from "@/hooks/useInView";

interface Step {
  n: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** Optional clay-render illustration (falls back to the icon on error). */
  image: string | null;
  imageAlt: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Set your home zone",
    body: "Mark the porch, entry, or delivery area Porchivo should watch.",
    icon: MapPin,
    image: null,
    imageAlt: "",
  },
  {
    n: "02",
    title: "Turn on delivery alerts",
    body: "Know when a package lands, lingers, or needs attention.",
    icon: BellRing,
    image: "/images/feature-alerts.png",
    imageAlt: "Illustration of a smarter package alert on a phone",
  },
  {
    n: "03",
    title: "Build your neighbor circle",
    body: "Invite trusted eyes so your block is not running on vibes alone.",
    icon: Users,
    image: "/images/feature-circle.png",
    imageAlt: "Illustration of neighbors forming a trusted circle",
  },
  {
    n: "04",
    title: "Create your proof locker",
    body: "Store photos, notes, and incidents in one clean timeline.",
    icon: Lock,
    image: "/images/feature-locker.png",
    imageAlt: "Illustration of a secure proof locker",
  },
];

/** Clay-render illustration with an icon-panel fallback if the asset is missing. */
function StepVisual({ step }: { step: Step }) {
  const [failed, setFailed] = useState(false);
  const Icon = step.icon;

  if (!step.image || failed) {
    return (
      <div
        className="flex h-36 items-center justify-center rounded-2xl border border-pv-electric/20 bg-gradient-to-br from-pv-electric/15 to-pv-amber/10"
        role="img"
        aria-label={step.title}
      >
        <Icon className="h-11 w-11 text-pv-amber drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={step.image}
      alt={step.imageAlt}
      loading="lazy"
      className="h-36 w-full rounded-2xl border border-white/10 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function StepCard({ step, index, onRevealed }: { step: Step; index: number; onRevealed: () => void }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.3 });

  useEffect(() => {
    if (inView) onRevealed();
  }, [inView, onRevealed]);

  return (
    <Reveal delay={index * 130}>
      <div
        ref={ref}
        className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-pv-electric/40 hover:shadow-2xl hover:shadow-pv-electric/20"
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
        <StepVisual step={step} />
        <h3 className="mt-5 font-display text-xl font-semibold text-white">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{step.body}</p>
      </div>
    </Reveal>
  );
}

/**
 * How-it-works: four floating glass cards connected by a glowing progress
 * line, with a live "n/4 complete" chip and the 7-days-free setup reward.
 */
export default function HowItWorksSection() {
  const [revealed, setRevealed] = useState(0);

  // Stable per-card callback so card reveal effects don't re-fire.
  const handleRevealed = useCallback(() => {
    setRevealed((count) => Math.min(count + 1, STEPS.length));
  }, []);

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How it works
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {/* Live progress chip */}
            <div
              className="inline-flex items-center gap-2 rounded-full border border-pv-electric/30 bg-pv-electric/10 px-4 py-1.5 text-sm font-medium text-pv-electric-light"
              aria-live="polite"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-pv-electric motion-safe:animate-pulse"
              />
              {revealed}/{STEPS.length} complete
            </div>
            {/* Setup reward badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-pv-amber/30 bg-pv-amber/10 px-4 py-1.5 text-sm font-semibold text-pv-amber">
              <Gift className="h-4 w-4" aria-hidden />
              7 DAYS FREE — Unlock Porchivo Premium after setup
            </div>
          </div>
        </Reveal>

        {/* Glowing connector line (desktop) */}
        <div aria-hidden className="relative mt-14 hidden lg:block">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-pv-electric/50 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pv-amber shadow-[0_0_16px_4px_rgba(245,158,11,0.5)] motion-safe:animate-pulse" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:mt-0">
          {STEPS.map((step, index) => (
            <StepCard key={step.n} step={step} index={index} onRevealed={handleRevealed} />
          ))}
        </div>
      </div>
    </section>
  );
}
