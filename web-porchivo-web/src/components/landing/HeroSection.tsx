import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import LazyModelViewer from "@/components/landing/LazyModelViewer";
import ModelFallback from "@/components/landing/ModelFallback";
import { scrollToHash } from "@/components/landing/LandingNav";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const HERO_VIDEO = "/assets/hero-loop.mp4";
const HERO_POSTER = "/images/hero-porchivo-clean.png";
const SHIELD_MODEL = "/assets/porch-shield.glb";

/**
 * Fullscreen hero: ambient dusk video under a navy overlay, the rotating
 * porch-shield 3D model (pointer-parallax), headline, glowing amber CTA,
 * trust bar, and an animated scroll indicator.
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
      {/* ── Background: ambient video loop + navy overlay + volumetric glow ── */}
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
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_72%_38%,rgba(59,130,246,0.20),transparent_70%)]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-8">
          <div className="text-center lg:text-left">
            {/* Theme chip */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pv-amber/30 bg-pv-amber/10 px-4 py-1.5 text-sm font-medium text-pv-amber">
              <ShieldCheck className="h-4 w-4" />
              Neighborhood Protection
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl xl:text-8xl">
              Secure your{" "}
              <span className="bg-gradient-to-r from-pv-amber via-pv-amber-light to-pv-electric bg-clip-text text-transparent">
                block.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl lg:mx-0">
              When porch pirates lurk, neighbors go to work. A cleaner setup for
              package protection, trusted neighbors, and proof when something
              goes sideways.
            </p>

            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
              <Link
                to="/download"
                className="inline-flex items-center gap-2 rounded-xl bg-pv-amber px-8 py-4 font-display text-lg font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
              >
                <Sparkles className="h-5 w-5" aria-hidden />
                Start Free — 7 Days Premium
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-9 flex items-center justify-center gap-3 text-sm text-white/60 lg:justify-start">
              <ShieldCheck className="h-4 w-4 text-pv-amber" aria-hidden />
              <span>
                Trusted on <span className="font-semibold text-white">12,000+</span> porches
                nationwide
              </span>
            </div>
          </div>

          {/* ── 3D porch-shield model (pointer-parallax wrapper) ── */}
          <div
            ref={modelWrapRef}
            className="mx-auto h-[340px] w-full max-w-md transition-transform duration-300 ease-out will-change-transform sm:h-[460px] lg:h-[580px]"
          >
            <LazyModelViewer
              src={SHIELD_MODEL}
              alt="3D model of a front porch protected by a glowing shield"
              cameraOrbit="35deg 74deg auto"
              fallback={
                <ModelFallback
                  icon={ShieldCheck}
                  label="A glowing protective shield over a porch"
                  className="h-full w-full"
                />
              }
              className="h-full w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <button
        type="button"
        onClick={() => scrollToHash("#problem")}
        aria-label="Scroll to see why it matters"
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
