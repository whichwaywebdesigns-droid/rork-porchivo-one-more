/**
 * TapeDispenserSpinner — DECORATIVE loading spinner styled as a packing-tape
 * dispenser: a kraft tape roll with a gold leading edge spins while a striped
 * tape strip pulls out and snaps back. Purely presentational — no click
 * events, no state logic.
 *
 * Pure CSS animations (`tape-roll-spin` / `tape-strip-pull` in index.css),
 * driven by CSS custom properties so `size` / `speed` stay JS-free. Under
 * `prefers-reduced-motion` both animations stop (static tape roll).
 *
 * All decorative layers are `aria-hidden`; the wrapper carries
 * `role="status"` (+ `aria-label`) so assistive tech still announces loading.
 *
 * Usage:
 *   <TapeDispenserSpinner size={48} label="Sealing your order..." speed={1.2} />
 */

interface TapeDispenserSpinnerProps {
  /** Pixel size of the spinner. Default 48. */
  size?: number;
  /** Optional text rendered below the spinner (e.g. "Sealing your order..."). */
  label?: string;
  /** Roll rotation duration in seconds. Default 1. The tape strip runs at 1.2×. */
  speed?: number;
}

export default function TapeDispenserSpinner({
  size = 48,
  label,
  speed = 1,
}: TapeDispenserSpinnerProps) {
  const cssVars = {
    "--spin-size": `${size}px`,
    "--spin-speed": `${speed}s`,
  } as React.CSSProperties;

  return (
    <div className="tape-spinner-wrap" role="status" aria-label={label ?? "Loading"}>
      <div className="tape-spinner" style={cssVars}>
        <span aria-hidden className="tape-spinner-strip" />
        <span aria-hidden className="tape-spinner-axle" />
      </div>
      {label && (
        <span aria-hidden className="tape-spinner-label">
          {label}
        </span>
      )}
    </div>
  );
}
