import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface LazyModelViewerProps {
  /** Path to the .glb asset under public/. */
  src: string;
  /** Accessible description of the model. */
  alt: string;
  /** Rendered when 3D can't run: mobile <768px, no WebGL, missing asset, or lib failure. */
  fallback: React.ReactNode;
  className?: string;
  /** Initial camera orbit, e.g. "35deg 72deg auto". */
  cameraOrbit?: string;
  /** Slow idle spin (disabled under prefers-reduced-motion). Default true. */
  autoRotate?: boolean;
}

// The model-viewer bundle (~1 module chunk) registers a custom element as a
// side effect. Imported at most once, and only when a model is near viewport.
let libPromise: Promise<unknown> | null = null;
function loadModelViewer(): Promise<unknown> {
  if (!libPromise) libPromise = import("@google/model-viewer");
  return libPromise;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Lazily-rendered <model-viewer> with graceful degradation:
 * 1. The library loads only when the container approaches the viewport.
 * 2. Under 768px width the static fallback is shown (per landing spec).
 * 3. WebGL-unavailable browsers and failed/missing assets get the fallback.
 * 4. Auto-rotation respects prefers-reduced-motion.
 */
export default function LazyModelViewer({
  src,
  alt,
  fallback,
  className,
  cameraOrbit = "35deg 72deg auto",
  autoRotate = true,
}: LazyModelViewerProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "300px" });
  const reducedMotion = usePrefersReducedMotion();
  const [libReady, setLibReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const modelRef = useRef<HTMLElement | null>(null);
  const webglAvailable = useMemo(() => hasWebGL(), []);

  // Track small screens so 3D swaps to static art per spec.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!inView || isMobile || !webglAvailable || libReady || failed) return;
    let cancelled = false;
    loadModelViewer()
      .then(() => {
        if (!cancelled) setLibReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inView, isMobile, webglAvailable, libReady, failed]);

  // model-viewer fires an `error` event for missing/invalid GLB assets.
  useEffect(() => {
    const el = modelRef.current;
    if (!el || !libReady) return;
    const onError = (): void => setFailed(true);
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [libReady, src]);

  const showModel = inView && libReady && !failed && !isMobile && webglAvailable;

  return (
    <div ref={ref} className={className} role="img" aria-label={showModel ? undefined : alt}>
      {showModel ? (
        <model-viewer
          ref={modelRef}
          src={src}
          alt={alt}
          camera-orbit={cameraOrbit}
          camera-controls=""
          auto-rotate={autoRotate && !reducedMotion ? "" : undefined}
          rotation-per-second="14"
          shadow-intensity="1.1"
          exposure="1.05"
          environment-image="neutral"
          interaction-prompt="none"
          disable-zoom=""
          disable-pan=""
          touch-action="pan-y"
          loading="eager"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
