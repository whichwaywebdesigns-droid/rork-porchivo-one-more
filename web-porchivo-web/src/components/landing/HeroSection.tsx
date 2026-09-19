import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Globe, UserPlus } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import HeroLanguageSwitch from "@/components/landing/HeroLanguageSwitch";
import { scrollToHash } from "@/components/landing/LandingNav";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useInView } from "@/hooks/useInView";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const HERO_VIDEO = "/assets/hero-loop.mp4";
const HERO_POSTER = "/images/hero-dusk-street.jpg";
// Owner-supplied shield showcase video — fills the hero's model column.
const SHIELD_VIDEO = "/assets/hero-shield-loop.mp4";
const SHIELD_VIDEO_POSTER = "/images/hero-shield-poster.jpg";

/** Hero trust-bar stats — count up when scrolled into view. */
interface Stat {
  end: number;
  suffix: string;
  labelKey: string;
  /** Alert red = threat data; emerald = Porchivo value (locked brand spec). */
  tone: "coral" | "amber";
}

const STATS: Stat[] = [
  { end: 21, suffix: "M", labelKey: "landing.hero.stat1", tone: "coral" },
  { end: 4, suffix: "%", labelKey: "landing.hero.stat2", tone: "coral" },
  { end: 1, suffix: " min", labelKey: "landing.hero.stat3", tone: "amber" },
];

/** Single count-up stat with a glowing coral/amber number. */
function HeroStat({ stat, index }: { stat: Stat; index: number }) {
  const { t } = useTranslation();
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
  const count = useAnimatedNumber(stat.end, { start: inView });
  const toneClass = stat.tone === "coral" ? "text-pv-coral" : "text-pv-amber";

  return (
    <div ref={ref} className="text-center lg:text-left">
      <div
        className={`font-display text-2xl font-bold tabular-nums sm:text-4xl ${toneClass}${
          inView ? " motion-safe:animate-stat-glow" : ""
        }`}
        style={inView ? { animationDelay: `${index * 120}ms` } : undefined}
      >
        {count.toLocaleString()}
        {stat.suffix}
      </div>
      <div className="mt-1.5 text-xs leading-snug text-white/60 sm:text-sm">{t(stat.labelKey)}</div>
    </div>
  );
}

/**
 * Fullscreen B2B hero: ambient community-dusk video under a 70% navy
 * overlay, the shield showcase video in a glass frame (pointer-parallax),
 * the enterprise headline + dual CTAs, the worldwide trust line, and the
 * animated stat bar.
 */
export default function HeroSection() {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [shieldVideoFailed, setShieldVideoFailed] = useState(false);

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
  const showShieldVideo = !reducedMotion && !shieldVideoFailed;

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
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_38%,rgba(56,189,248,0.16),transparent_70%)]" />
      </div>

      {/* ── Content: shield video left, copy right (stacked copy-first on mobile) ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-28 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Copy */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-pv-electric-light sm:text-sm">
                {t("landing.hero.tagline")}
              </p>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl xl:text-7xl">
                {t("landing.hero.title1")}{" "}
                <span className="bg-gradient-to-r from-pv-amber via-pv-amber-light to-pv-electric bg-clip-text text-transparent">
                  {t("landing.hero.title2")}
                </span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl lg:mx-0">
                {t("landing.hero.subtitle")}
              </p>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/55 lg:mx-0">
                {t("landing.hero.subline")}
              </p>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
                <Link
                  to="/download"
                  className="inline-flex items-center gap-2 rounded-xl bg-pv-amber px-8 py-4 font-display text-lg font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
                >
                  {t("landing.cta.register")}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/download"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-8 py-4 font-display text-lg font-semibold text-white transition-colors hover:border-pv-electric/60 hover:bg-pv-electric/10"
                >
                  <UserPlus className="h-5 w-5" aria-hidden />
                  {t("landing.hero.ctaJoin")}
                </Link>
              </div>
            </Reveal>

            {/* Prominent EN/ES swap control — US/Mexico launch */}
            <Reveal delay={300}>
              <div className="mt-8 flex justify-center lg:justify-start">
                <HeroLanguageSwitch />
              </div>
            </Reveal>

            <Reveal delay={330}>
              <div className="mt-9 flex items-center justify-center gap-3 text-sm text-white/60 lg:justify-start">
                <Globe className="h-4 w-4 text-pv-electric-light" aria-hidden />
                <span>{t("landing.hero.trust")}</span>
              </div>
            </Reveal>
          </div>

          {/* ── Shield showcase video in a glass frame (pointer-parallax wrapper) ── */}
          <div
            ref={modelWrapRef}
            className="order-2 mx-auto h-[320px] w-[320px] transition-transform duration-300 ease-out will-change-transform sm:h-[440px] sm:w-[440px] lg:order-1 lg:h-[560px] lg:w-[560px]"
          >
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/15 shadow-[0_0_90px_-20px_rgba(56,189,248,0.4)]">
              {showShieldVideo ? (
                <video
                  className="h-full w-full object-cover"
                  src={SHIELD_VIDEO}
                  poster={SHIELD_VIDEO_POSTER}
                  aria-label={t("landing.hero.modelAlt")}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => setShieldVideoFailed(true)}
                />
              ) : (
                <img
                  src={SHIELD_VIDEO_POSTER}
                  alt={t("landing.hero.modelAlt")}
                  className="h-full w-full object-cover"
                />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
            </div>
          </div>
        </div>

        {/* ── Animated stat bar ── */}
        <Reveal delay={200} className="w-full">
          <div className="mt-12 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:gap-4 sm:p-6 lg:mt-16 lg:p-8">
            {STATS.map((stat, index) => (
              <HeroStat key={stat.labelKey} stat={stat} index={index} />
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
