/**
 * Shared safety-score helpers — the single source of truth for score direction.
 *
 * Every risk-style score in the app (porch risk, ZIP theft risk, notification
 * risk payloads) is displayed as a SAFETY score where HIGHER = SAFER via
 * `getSafetyScore`. Never inline `100 - risk` anywhere else — import this.
 *
 * Bands (on a safety score):
 *   0–33  → High Risk   (red)
 *   34–66 → Medium Risk (orange)
 *   67–100 → Low Risk   (green)
 */

export interface SafetyBand {
  key: 'high' | 'medium' | 'low';
  label: string;
  /** Text/accent color for the band. */
  color: string;
  /** Soft background tint for chips and cards. */
  bg: string;
}

/** Colors for the needle gauge arc zones (red left → green right). Dark theme. */
export const SAFETY_GAUGE = {
  track: '#1B3A6B',
  red: '#EF4444',
  orange: '#E8611A',
  green: '#4ADE80',
} as const;

/** Full gauge color set for the active theme. */
export interface SafetyGaugeColors {
  track: string;
  red: string;
  orange: string;
  green: string;
  needle: string;
}

/**
 * Gauge colors for the active theme — dark keeps the vivid palette; light
 * deepens the zones/track and flips the needle navy so it stays visible.
 * Zone hues match the platform palettes (iOS PorchivoPalette / PorchivoColors).
 */
export function getSafetyGaugeColors(isDark: boolean): SafetyGaugeColors {
  return isDark
    ? { track: SAFETY_GAUGE.track, red: SAFETY_GAUGE.red, orange: SAFETY_GAUGE.orange, green: SAFETY_GAUGE.green, needle: '#FFFFFF' }
    : { track: '#C5D8EE', red: '#DC2626', orange: '#E8611A', green: '#16A34A', needle: '#1A2B4A' };
}

/** Flip a 0–100 risk score (higher = riskier) into a safety score (higher = safer). */
export function getSafetyScore(riskScore: number): number {
  if (!Number.isFinite(riskScore)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - riskScore)));
}

/**
 * Map a SAFETY score (0–100) onto the shared risk band. Pass `isDark` to get
 * theme-adjusted colors: dark mode uses the brighter palette hues with
 * translucent tints, light mode keeps the deep hues with soft solid tints.
 */
export function getSafetyBand(score: number, isDark = false): SafetyBand {
  if (score >= 67) {
    return isDark
      ? { key: 'low', label: 'Low Risk', color: '#44D882', bg: 'rgba(68, 216, 130, 0.14)' }
      : { key: 'low', label: 'Low Risk', color: '#16A34A', bg: '#ECFDF5' };
  }
  if (score >= 34) {
    return isDark
      ? { key: 'medium', label: 'Medium Risk', color: '#F07840', bg: 'rgba(240, 120, 64, 0.16)' }
      : { key: 'medium', label: 'Medium Risk', color: '#E8611A', bg: '#FFF4EC' };
  }
  return isDark
    ? { key: 'high', label: 'High Risk', color: '#FF5555', bg: 'rgba(255, 85, 85, 0.14)' }
    : { key: 'high', label: 'High Risk', color: '#EF4444', bg: '#FEF2F2' };
}
