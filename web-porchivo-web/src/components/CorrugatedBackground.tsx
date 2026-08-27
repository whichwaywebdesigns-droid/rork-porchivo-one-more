/**
 * CorrugatedBackground — global DECORATIVE backdrop that gives the page a
 * corrugated-cardboard texture: faint vertical flute ridges, a whisper of
 * horizontal pressing, and soft "worn corner" shading at each viewport edge.
 *
 * Visual-only module:
 * - Fixed to the viewport, pinned to the very back of the stacking order
 *   (z-index: -1), so it only shows through around/beneath the opaque
 *   `.page-desk` / `.paper-sheet` surfaces.
 * - `pointer-events: none` + `aria-hidden` — never intercepts input, never
 *   announced to assistive tech.
 * - Pure CSS gradients (no images/SVG), zero animations, zero blur filters.
 *   Engines without gradient support simply fall back to the flat desk color.
 *
 * Styles live in index.css under the `corrugated-bg` class.
 */
export default function CorrugatedBackground() {
  return <div aria-hidden className="corrugated-bg" />;
}
