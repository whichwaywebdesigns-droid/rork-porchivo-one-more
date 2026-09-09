import { useEffect, useRef, useState } from "react";

interface UseInViewOptions {
  rootMargin?: string;
  threshold?: number;
  /** Keep reporting enter/leave instead of firing once. Default: fire once. */
  continuous?: boolean;
}

/**
 * IntersectionObserver hook. Returns a ref plus whether the element is
 * (or has ever been) in the viewport. Degrades to always-visible when
 * IntersectionObserver is unavailable.
 */
export function useInView<T extends HTMLElement>(options: UseInViewOptions = {}) {
  const { rootMargin = "0px", threshold = 0.15, continuous = false } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          if (!continuous) observer.disconnect();
        } else if (continuous) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, continuous]);

  return { ref, inView };
}
