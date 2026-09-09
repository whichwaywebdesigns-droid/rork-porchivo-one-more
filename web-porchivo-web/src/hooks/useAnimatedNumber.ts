import { useEffect, useRef, useState } from "react";

interface UseAnimatedNumberOptions {
  decimals?: number;
  duration?: number;
  /** Start the animation (e.g. once the element enters the viewport). */
  start: boolean;
}

/**
 * Counts from 0 to `end` with an ease-out curve, supporting decimals
 * (e.g. 1.7). Honors prefers-reduced-motion by jumping straight to the
 * final value.
 */
export function useAnimatedNumber(end: number, options: UseAnimatedNumberOptions): number {
  const { decimals = 0, duration = 1600, start } = options;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return;
    }
    const startedAt = performance.now();
    const factor = Math.pow(10, decimals);
    const tick = (now: number): void => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end * factor) / factor);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [start, end, decimals, duration]);

  return value;
}
