import { TrackedPackage } from '@/types';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFactor {
  id: string;
  label: string;
  detail: string;
  weight: number;
  positive?: boolean;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

function isAfter4pm(dateStr: string): boolean {
  const d = new Date(dateStr);
  const h = d.getHours();
  return h >= 16 || h < 7;
}

export interface RiskInput {
  pkg: TrackedPackage;
  activeAlertCount: number;
  weekEvents: number;
  hasPartner: boolean;
  hasDriver: boolean;
}

export function calculatePorchRisk(args: RiskInput): RiskResult {
  const { pkg, activeAlertCount, weekEvents, hasPartner, hasDriver } = args;
  const factors: RiskFactor[] = [];
  let score = 30;

  if (activeAlertCount >= 3) {
    score += 28;
    factors.push({
      id: 'alerts-high',
      label: `${activeAlertCount} active porch theft alerts on your block`,
      detail: 'Reported by neighbors in the last 7 days.',
      weight: 28,
    });
  } else if (activeAlertCount >= 1) {
    score += 14;
    factors.push({
      id: 'alerts-some',
      label: `${activeAlertCount} recent suspicious activity report${activeAlertCount > 1 ? 's' : ''}`,
      detail: 'Stay alert — keep an eye on your porch today.',
      weight: 14,
    });
  } else {
    score -= 6;
    factors.push({
      id: 'alerts-none',
      label: 'No active alerts on your block',
      detail: 'Your neighborhood is calm right now.',
      weight: -6,
      positive: true,
    });
  }

  if (weekEvents >= 6) {
    score += 12;
    factors.push({
      id: 'busy-block',
      label: 'High delivery traffic this week',
      detail: 'Busy blocks can attract opportunistic thieves.',
      weight: 12,
    });
  }

  if (isAfter4pm(pkg.expectedDeliveryDate)) {
    score += 14;
    factors.push({
      id: 'late-window',
      label: 'Late-day delivery window',
      detail: 'Packages dropped after 4pm are 2x more likely to be stolen.',
      weight: 14,
    });
  } else {
    factors.push({
      id: 'safe-window',
      label: 'Daytime delivery window',
      detail: 'Daylight drops carry the lowest theft risk.',
      weight: -4,
      positive: true,
    });
    score -= 4;
  }

  if (hasPartner) {
    score -= 22;
    factors.push({
      id: 'partner',
      label: 'Porch Partner is holding for you',
      detail: 'A trusted neighbor will secure this package.',
      weight: -22,
      positive: true,
    });
  } else {
    score += 8;
    factors.push({
      id: 'no-partner',
      label: 'No Porch Partner assigned',
      detail: 'Add a neighbor to hold this package while you’re out.',
      weight: 8,
    });
  }

  if (hasDriver) {
    score -= 8;
    factors.push({
      id: 'driver',
      label: 'Driver assigned for last-mile handoff',
      detail: 'A real human is responsible for this package.',
      weight: -8,
      positive: true,
    });
  }

  if (pkg.notesForPartner && pkg.notesForPartner.trim().length > 0) {
    score -= 4;
    factors.push({
      id: 'notes',
      label: 'Custom drop instructions saved',
      detail: 'Drivers will see your notes on arrival.',
      weight: -4,
      positive: true,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, level, factors };
}

/** Pick the most relevant inbound package to surface a "today's risk" for. */
export function pickNextInboundPackage(packages: TrackedPackage[]): TrackedPackage | null {
  if (!packages.length) return null;
  const ofd = packages.find((p) => p.currentStatus === 'out_for_delivery');
  if (ofd) return ofd;
  const shipped = packages
    .filter((p) => p.currentStatus === 'shipped')
    .sort((a, b) =>
      new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime(),
    );
  if (shipped[0]) return shipped[0];
  const ordered = packages
    .filter((p) => p.currentStatus === 'ordered')
    .sort((a, b) =>
      new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime(),
    );
  return ordered[0] ?? null;
}
