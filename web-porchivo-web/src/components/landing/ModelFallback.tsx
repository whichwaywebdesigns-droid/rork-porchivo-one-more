import type { LucideIcon } from "lucide-react";

interface ModelFallbackProps {
  icon: LucideIcon;
  /** Visible to screen readers only — the art itself is decorative. */
  label: string;
  className?: string;
  /** Optional still render shown inside the tile instead of the glyph
   *  (used until the matching .glb asset exists). */
  image?: string;
}

/**
 * Static "hologram" art shown wherever a 3D model can't render
 * (mobile, no WebGL, or missing asset). Pure CSS — no JS, no WebGL.
 */
export default function ModelFallback({ icon: Icon, label, className, image }: ModelFallbackProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ""}`}
      role="img"
      aria-label={label}
    >
      {/* Ambient glow + expanding sonar rings */}
      <div
        aria-hidden
        className="absolute h-44 w-44 rounded-full bg-pv-electric/20 blur-3xl sm:h-64 sm:w-64"
      />
      <div
        aria-hidden
        className="absolute h-44 w-44 rounded-full border border-pv-electric/30 motion-safe:animate-ring-pulse sm:h-64 sm:w-64"
      />
      <div
        aria-hidden
        className="absolute h-44 w-44 rounded-full border border-pv-amber/20 motion-safe:animate-ring-pulse [animation-delay:1.3s] sm:h-64 sm:w-64"
      />
      {/* Core glass tile with the glyph */}
      <div
        aria-hidden
        className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-white/15 bg-gradient-to-br from-pv-electric/25 to-pv-amber/20 shadow-2xl shadow-pv-electric/20 backdrop-blur-xl motion-safe:animate-float sm:h-44 sm:w-44"
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full rounded-3xl object-cover"
          />
        ) : (
          <Icon
            className="h-14 w-14 text-pv-amber drop-shadow-[0_0_14px_rgba(245,158,11,0.7)] sm:h-20 sm:w-20"
            strokeWidth={1.5}
          />
        )}
      </div>
    </div>
  );
}
