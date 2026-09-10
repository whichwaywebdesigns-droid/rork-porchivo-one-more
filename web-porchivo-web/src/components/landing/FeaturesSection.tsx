import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Gauge, Lock, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import LazyModelViewer from "@/components/landing/LazyModelViewer";
import ModelFallback from "@/components/landing/ModelFallback";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Feature {
  title: string;
  copy: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
}

const FEATURES: Feature[] = [
  {
    title: "Real-Time Risk Scoring",
    copy: "Every incoming package is scored for theft risk before it lands.",
    image: "/images/feature-scoring.jpg",
    imageAlt: "Illustration of a package receiving a live theft-risk score",
    icon: Gauge,
  },
  {
    title: "Porch Partner Network",
    copy: "Join the Porch Partner network — safer deliveries, extra income, and community reputation.",
    image: "/images/feature-partners.jpg",
    imageAlt: "Illustration of Porch Partners handing off packages safely",
    icon: Users,
  },
  {
    title: "Community Insights",
    copy: "Managers see active risk zones, theft hotspots, and delivery congestion.",
    image: "/images/feature-insights.jpg",
    imageAlt: "Illustration of a manager's community risk map",
    icon: BarChart3,
  },
];

const VAULT_MODEL = "/assets/risk-vault.glb";

/** Feature illustration with an icon-panel fallback if the asset is missing. */
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

/**
 * Glass card with a subtle 3D tilt that follows the pointer.
 * rAF-throttled; disabled under prefers-reduced-motion; resets on leave.
 */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || reducedMotion || event.pointerType !== "mouse") return;
      if (rafRef.current !== null) return;
      const { clientX, clientY } = event;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width - 0.5;
        const py = (clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateZ(0)`;
      });
    },
    [reducedMotion],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="h-full will-change-transform [transform-style:preserve-3d] motion-reduce:transform-none!"
    >
      {children}
    </div>
  );
}

/**
 * Features: header per B2B spec, three tilt-on-hover glassmorphism cards
 * with the feature illustrations, plus a wide "Five-Minute Community Setup"
 * card with the risk-vault 3D model as a side visual (lazy-loaded).
 */
export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative scroll-mt-24 border-t border-white/5 bg-pv-navy-800/60 py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Everything your community needs to protect deliveries and retain residents
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Real-time scoring, alerts, Porch Partner handoffs, and manager
            insights — all in one app.
          </p>
        </Reveal>

        {/* Three tilt cards */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 130}>
              <TiltCard>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-colors duration-300 hover:border-pv-electric/40">
                  <FeatureImage feature={feature} />
                  <h3 className="mt-6 font-display text-xl font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{feature.copy}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>

        {/* Wide setup card with the risk-vault 3D side visual */}
        <Reveal delay={120}>
          <div className="mt-6 grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border border-pv-amber/25 bg-white/[0.05] p-8 shadow-[0_0_70px_-24px_rgba(245,158,11,0.4)] backdrop-blur-xl md:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-pv-amber/30 bg-pv-amber/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-pv-amber">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Zero-touch deployment
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
                Five-Minute Community Setup
              </h3>
              <p className="mt-3 max-w-md text-base leading-relaxed text-white/65">
                No hardware, no IT project, no installation.
              </p>
            </div>
            <div className="h-[260px] sm:h-[300px]">
              <LazyModelViewer
                src={VAULT_MODEL}
                alt="3D model of a secure package vault showing chain-of-custody"
                cameraOrbit="25deg 70deg auto"
                fallback={
                  <ModelFallback
                    icon={Lock}
                    label="A secure package vault with chain-of-custody"
                    image="/images/risk-vault.jpg"
                    className="h-full w-full"
                  />
                }
                className="h-full w-full"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
