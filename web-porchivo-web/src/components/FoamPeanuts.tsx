/**
 * FoamPeanuts — purely decorative loose-fill packing peanuts scattered around
 * the edge of a paper sheet (onboarding-style screens only).
 *
 * Visual-only: `pointer-events: none`, `aria-hidden`, zero interactivity.
 * Peanuts bob gently with staggered delays; roughly half are hidden on mobile
 * (`.peanut-desktop-only`) and travel distance shrinks via CSS media queries.
 */

interface Peanut {
  top?: string;
  left?: string;
  bottom?: string;
  right?: string;
  /** px size */
  size: number;
  /** decorative tone — maps to --peanut-1/2/3 */
  tone: 1 | 2 | 3;
  delay: string;
  dur: string;
  rot: string;
  /** hidden below 640px to reduce clutter + work */
  desktopOnly?: boolean;
}

const TONE_VAR: Record<Peanut["tone"], string> = {
  1: "var(--peanut-1)",
  2: "var(--peanut-2)",
  3: "var(--peanut-3)",
};

const PEANUTS: Peanut[] = [
  // Top edge (some nestled against the paper edge, some outside on the desk)
  { top: "-2px", left: "4%", size: 9, tone: 1, delay: "0.2s", dur: "4.2s", rot: "3deg" },
  { top: "-9px", left: "17%", size: 7, tone: 2, delay: "1.4s", dur: "5.1s", rot: "-4deg", desktopOnly: true },
  { top: "-1px", left: "31%", size: 10, tone: 3, delay: "0.8s", dur: "3.8s", rot: "2deg" },
  { top: "-11px", left: "54%", size: 8, tone: 1, delay: "2.1s", dur: "5.6s", rot: "-3deg", desktopOnly: true },
  { top: "-2px", left: "68%", size: 7, tone: 2, delay: "1.1s", dur: "4.6s", rot: "4deg" },
  { top: "-8px", left: "84%", size: 9, tone: 3, delay: "2.8s", dur: "6s", rot: "-5deg", desktopOnly: true },
  { top: "-1px", left: "95%", size: 6, tone: 1, delay: "0.5s", dur: "4.9s", rot: "3deg" },
  // Bottom edge
  { bottom: "-1px", left: "7%", size: 8, tone: 2, delay: "1.7s", dur: "4.4s", rot: "-3deg" },
  { bottom: "-10px", left: "24%", size: 9, tone: 3, delay: "0.9s", dur: "5.3s", rot: "4deg", desktopOnly: true },
  { bottom: "-2px", left: "46%", size: 7, tone: 1, delay: "2.4s", dur: "4.1s", rot: "-4deg" },
  { bottom: "-12px", left: "63%", size: 10, tone: 2, delay: "1.2s", dur: "5.8s", rot: "3deg", desktopOnly: true },
  { bottom: "-1px", left: "81%", size: 8, tone: 3, delay: "0.3s", dur: "4.7s", rot: "-2deg" },
  { bottom: "-9px", left: "93%", size: 6, tone: 1, delay: "1.9s", dur: "5.2s", rot: "5deg", desktopOnly: true },
  // Left edge
  { top: "16%", left: "-2px", size: 8, tone: 3, delay: "0.7s", dur: "4.8s", rot: "-3deg" },
  { top: "43%", left: "-10px", size: 7, tone: 2, delay: "2.6s", dur: "5.9s", rot: "4deg", desktopOnly: true },
  { top: "71%", left: "-1px", size: 9, tone: 1, delay: "1.0s", dur: "4.3s", rot: "3deg" },
  // Right edge
  { top: "23%", right: "-9px", size: 8, tone: 1, delay: "1.5s", dur: "5.4s", rot: "-4deg", desktopOnly: true },
  { top: "52%", right: "-1px", size: 7, tone: 3, delay: "0.4s", dur: "4.0s", rot: "2deg" },
  { top: "80%", right: "-11px", size: 9, tone: 2, delay: "2.2s", dur: "6.2s", rot: "-5deg", desktopOnly: true },
];

export default function FoamPeanuts() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-4 sm:-inset-7 z-0 select-none overflow-hidden">
      {PEANUTS.map((p, i) => (
        <span
          key={i}
          className={`peanut${p.desktopOnly ? " peanut-desktop-only" : ""}`}
          style={{
            top: p.top,
            left: p.left,
            bottom: p.bottom,
            right: p.right,
            width: `${p.size}px`,
            height: `${Math.round(p.size * 0.82)}px`,
            background: `radial-gradient(circle at 35% 30%, ${TONE_VAR[p.tone]}, var(--peanut-shade))`,
            "--delay": p.delay,
            "--dur": p.dur,
            "--rot": p.rot,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
