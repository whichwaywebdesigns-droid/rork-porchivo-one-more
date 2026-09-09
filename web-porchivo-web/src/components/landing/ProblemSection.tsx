import { useEffect, useRef } from "react";
import { Camera, ShieldCheck } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import { useInView } from "@/hooks/useInView";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Stat {
  end: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const STATS: Stat[] = [
  { end: 1.7, decimals: 1, suffix: "B", label: "packages stolen yearly" },
  { end: 12, prefix: "$", suffix: "B", label: "in losses" },
  { end: 78, suffix: "%", label: "happen in daylight" },
];

function StatCard({ stat }: { stat: Stat }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
  const count = useAnimatedNumber(stat.end, {
    decimals: stat.decimals ?? 0,
    start: inView,
  });

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl"
    >
      <div className="font-display text-4xl font-bold text-pv-amber sm:text-5xl">
        {stat.prefix}
        {count.toLocaleString(undefined, {
          minimumFractionDigits: stat.decimals ?? 0,
          maximumFractionDigits: stat.decimals ?? 0,
        })}
        {stat.suffix}
      </div>
      <div className="mt-2 text-sm leading-snug text-white/60">{stat.label}</div>
    </div>
  );
}

/**
 * Problem section: parallax ambient glow behind the headline and three
 * animated count-up stat cards, closing with the camera-vs-Porchivo line.
 */
export default function ProblemSection() {
  const reducedMotion = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Subtle vertical parallax on the ambient glow (skipped for reduced motion).
  useEffect(() => {
    if (reducedMotion) return;
    const onScroll = (): void => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const section = sectionRef.current;
        const glow = glowRef.current;
        if (!section || !glow) return;
        const rect = section.getBoundingClientRect();
        const progress =
          (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        glow.style.transform = `translateY(${(progress - 0.5) * 90}px)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  return (
    <section
      id="problem"
      ref={sectionRef}
      className="relative scroll-mt-24 overflow-hidden border-t border-white/5 bg-pv-navy-800 py-24"
    >
      {/* Parallax ambient glow */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-full bg-pv-electric/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Porch pirates are getting bolder.
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 120}>
              <StatCard stat={stat} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mx-auto mt-14 max-w-2xl text-center">
            <p className="text-xl leading-relaxed text-white/75 sm:text-2xl">
              <Camera className="mr-2 inline h-5 w-5 align-[-3px] text-white/50" aria-hidden />
              Your doorbell camera records the crime.{" "}
              <span className="font-semibold text-pv-amber">
                <ShieldCheck className="mr-1 inline h-5 w-5 align-[-3px]" aria-hidden />
                Porchivo prevents it.
              </span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
