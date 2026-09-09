import { useState } from "react";
import { BellRing, Users, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface Feature {
  title: string;
  copy: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
}

const FEATURES: Feature[] = [
  {
    title: "Smarter Package Alerts",
    copy: "Know the moment a package lands, lingers, or needs attention. Risk-aware alerts mean you only hear about what matters.",
    image: "/images/feature-alerts.png",
    imageAlt: "Clay-render illustration of a smarter package alert",
    icon: BellRing,
  },
  {
    title: "Trusted Neighbor Tools",
    copy: "Build a circle of trusted eyes on your block. Hand off, hold, and pick up packages without leaving notes under the mat.",
    image: "/images/feature-circle.png",
    imageAlt: "Clay-render illustration of a trusted neighbor circle",
    icon: Users,
  },
  {
    title: "Proof Locker Storage",
    copy: "Photos, notes, and incidents in one clean timeline. When something goes sideways, your evidence is ready to share.",
    image: "/images/feature-locker.png",
    imageAlt: "Clay-render illustration of a secure proof locker",
    icon: Lock,
  },
];

function FeatureImage({ feature }: { feature: Feature }) {
  const [failed, setFailed] = useState(false);
  const Icon = feature.icon;

  if (failed) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-2xl border border-pv-electric/20 bg-gradient-to-br from-pv-electric/15 to-pv-amber/10"
        role="img"
        aria-label={feature.imageAlt}
      >
        <Icon className="h-12 w-12 text-pv-amber" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={feature.image}
      alt={feature.imageAlt}
      loading="lazy"
      className="h-40 w-full rounded-2xl border border-white/10 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Features: three glass columns with clay-render illustrations and hover lift. */
export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative scroll-mt-24 border-t border-white/5 bg-pv-navy-800/60 py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Everything your block needs
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Three tools that turn a vulnerable porch into a protected one.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 130}>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-pv-electric/40 hover:shadow-2xl hover:shadow-pv-electric/15">
                <FeatureImage feature={feature} />
                <h3 className="mt-6 font-display text-xl font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{feature.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
