import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Globe, ShieldCheck, UserPlus } from "lucide-react";
import LazyModelViewer from "@/components/landing/LazyModelViewer";
import ModelFallback from "@/components/landing/ModelFallback";
import Reveal from "@/components/landing/Reveal";
import { scrollToHash } from "@/components/landing/LandingNav";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useInView } from "@/hooks/useInView";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const HERO_VIDEO = "/assets/hero-loop.mp4";
const HERO_POSTER = "/images/hero-porchivo-clean.png";
const SHIELD_MODEL = "/assets/community-shield.glb";

/** Hero trust-bar stats — count up when scrolled into view. */
interface Stat {
  end: number;
  suffix: string;
  label: string;
  /** Coral = threat data; amber = Porchivo value. */
  tone: "coral" | "amber";
}

const STATS: Stat[] = [
  { end: 52, suffix: "M", label: "packages stolen in the US every year", tone: "coral" },
  { end: 9, suffix: "%", label: "of delivered packages are stolen from porches", tone: "coral" },
  { end: 2, suffix: " min", label: "to register a community and start protecting deliveries", tone: "amber" },
];

/** Single count-up stat with a glowing coral/amber number. */
function HeroStat({ stat }: { stat: Stat }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
  const count = useAnimatedNumber(stat.end, { start: inView });
  const toneClass = stat.tone === "coral" ? "text-pv-coral" : "text-pv-amber";

  return (
    <div ref={ref} className="text-center lg:text-left">
      <div className={`font-display text-3xl font-bold tabular-nums sm:text-4xl ${toneClass}`}>
        {count.toLocaleString()}
        {stat.suffix}
      </div>
      <div className="mt-1.5 text-xs leading-snug text-white/60 sm:text-sm">{stat.label}</div>
    </div>
  );
}

/**
 * Fullscreen B2B hero: ambient community-dusk video under a 70% navy
 * overlay, the community-shield 3D model (pointer-parallax, auto-rotate),
 * the enterprise headline + dual CTAs, the worldwide trust line, and the
 * animated stat bar.
 */
export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  // Subtle pointer parallax on the 3D model — mouse only, rAF-throttled.
  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reducedMotion || event.pointerType !== "mouse") return;
      if (rafRef.current !== null) return;
      const { clientX, clientY } = event;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = modelWrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = (clientX - (rect.left + rect.width / 2)) / rect.width;
        const dy = (clientY - (rect.top + rect.height / 2)) / rect.height;
        el.style.transform = `translate3d(${dx * 16}px, ${dy * 10}px, 0)`;
      });
    },
    [reducedMotion],
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const showVideo = !reducedMotion && !videoFailed;

  return (
    <section
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ minHeight: "100svh" }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        const el = modelWrapRef.current;
        if (el) el.style.transform = "translate3d(0,0,0)";
      }}
    >
      {/* ── Background: ambient video loop + 70% navy overlay + blue glow ── */}
      <div className="absolute inset-0" aria-hidden>
        {showVideo ? (
          <video
            className="h-full w-full object-cover"
            src={HERO_VIDEO}
            poster={HERO_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <img src={HERO_POSTER} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-pv-navy/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-pv-navy/80 via-transparent to-pv-navy" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_38%,rgba(59,130,246,0.18),transparent_70%)]" />
      </div>

      {/* ── Content: 3D model left, copy right (stacked copy-first on mobile) ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pt-28 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Copy */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-pv-electric-light sm:text-sm">
                Package Security &amp; Resident Retention for Communities
              </p>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl xl:text-7xl">
                Know before it&apos;s{" "}
                <span className="bg-gradient-to-r from-pv-amber via-pv-amber-light to-pv-electric bg-clip-text text-transparent">
                  too late.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl lg:mx-0">
                Real-time package risk scoring, instant alerts to residents and
                Porch Partners, and a neighbor-held delivery network — with no
                hardware or IT project required.
              </p>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/55 lg:mx-0">
                Porchivo reduces management workload, surfaces community
                insights, and keeps residents satisfied — so they renew.
              </p>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
                <Link
                  to="/download"
                  className="inline-flex items-center gap-2 rounded-xl bg-pv-amber px-8 py-4 font-display text-lg font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
                >
                  Register Your Community
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/download"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-8 py-4 font-display text-lg font-semibold text-white transition-colors hover:border-pv-electric/60 hover:bg-pv-electric/10"
                >
                  <UserPlus className="h-5 w-5" aria-hidden />
                  Residents Join Free
                </Link>
              </div>
            </Reveal>

            <Reveal delay={330}>
              <div className="mt-9 flex items-center justify-center gap-3 text-sm text-white/60 lg:justify-start">
                <Globe className="h-4 w-4 text-pv-electric-light" aria-hidden />
                <span>Built to work in 190+ countries worldwide</span>
              </div>
            </Reveal>
          </div>

          {/* ── 3D community-shield model (pointer-parallax wrapper) ── */}
          <div
            ref={modelWrapRef}
            className="order-2 mx-auto h-[320px] w-full max-w-md transition-transform duration-300 ease-out will-change-transform sm:h-[440px] lg:order-1 lg:h-[560px]"
          >
            <LazyModelViewer
              src={SHIELD_MODEL}
              alt="3D model of a neighborhood protected by a glowing shield"
              cameraOrbit="35deg 74deg auto"
              fallback={
                <ModelFallback
                  icon={ShieldCheck}
                  label="A glowing protective shield over a neighborhood"
                  className="h-full w-full"
                />
              }
              className="h-full w-full"
            />
          </div>
        </div>

        {/* ── Animated stat bar ── */}
        <Reveal delay={200}>
          <div className="mt-12 grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:grid-cols-3 sm:gap-4 lg:mt-16 lg:p-8">
            {STATS.map((stat) => (
              <HeroStat key={stat.label} stat={stat} />
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Scroll indicator ── */}
      <button
        type="button"
        onClick={() => scrollToHash("#how-it-works")}
        aria-label="Scroll to how Porchivo works"
        className="absolute bottom-6 left-1/2 z-10 flex h-12 w-8 -translate-x-1/2 items-start justify-center rounded-full border border-white/25 p-2 transition-colors hover:border-pv-amber/60"
      >
        <span
          className="h-2 w-2 rounded-full bg-pv-amber motion-safe:animate-scroll-dot"
          aria-hidden
        />
      </button>
    </section>
  );
}
