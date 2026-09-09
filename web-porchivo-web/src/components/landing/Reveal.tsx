import type { ReactNode } from "react";
import { useInView } from "@/hooks/useInView";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (used for card stagger-in). */
  delay?: number;
}

/**
 * Scroll-triggered fade/rise reveal via IntersectionObserver + CSS
 * transitions (no animation library — keeps the page light and jank-free).
 * Renders instantly when the user prefers reduced motion.
 */
export default function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.12 });
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className ?? ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
