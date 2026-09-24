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

/** Colors for the needle gauge arc zones (red left → green right). */
export const SAFETY_GAUGE = {
  track: '#1B3A6B',
  red: '#EF4444',
  orange: '#E8611A',
  green: '#4ADE80',
} as const;

/** Flip a 0–100 risk score (higher = riskier) into a safety score (higher = safer). */
export function getSafetyScore(riskScore: number): number {
  if (!Number.isFinite(riskScore)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - riskScore)));
}

/** Map a SAFETY score (0–100) onto the shared risk band. */
export function getSafetyBand(score: number): SafetyBand {
  if (score >= 67) return { key: 'low', label: 'Low Risk', color: '#16A34A', bg: '#ECFDF5' };
  if (score >= 34) return { key: 'medium', label: 'Medium Risk', color: '#E8611A', bg: '#FFF4EC' };
  return { key: 'high', label: 'High Risk', color: '#EF4444', bg: '#FEF2F2' };
}
