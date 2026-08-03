import { Driver, TrackedPackage } from '@/types';
import { log } from "./logger";

export function rankDriversForAssignment(
  drivers: Driver[],
  _targetPackage?: TrackedPackage,
): Driver[] {
  const available = drivers.filter((d) => d.status === 'available');

  const sorted = [...available].sort((a, b) => {
    if (a.activeStops !== b.activeStops) {
      return a.activeStops - b.activeStops;
    }
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }
    return b.completedDeliveries - a.completedDeliveries;
  });

  log('[DriverAssignment] Ranked', sorted.length, 'available drivers');
  return sorted;
}

export function calculateMockDistance(driverIndex: number): string {
  const distances = ['0.2', '0.4', '0.7', '1.1', '1.5', '2.3', '3.0'];
  return distances[driverIndex % distances.length] ?? '1.0';
}

export function canAssignDriver(
  pkg: TrackedPackage,
): boolean {
  const assignableStatuses = ['ordered', 'shipped', 'out_for_delivery'];
  return assignableStatuses.includes(pkg.currentStatus) && !pkg.driverId;
}
