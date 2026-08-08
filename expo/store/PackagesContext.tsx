import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { AppState, AppStateStatus } from 'react-native';
import { TrackedPackage, PackageTrackingStatus, PackageStatusEvent, Carrier, AddressNickname, LiveTrackingEvent } from '@/types';
import { scheduleLocalNotification, scheduleDeliveryReminder, cancelDeliveryReminders } from '@/lib/notifications';
import { shouldSendNotification } from '@/lib/notificationPreferences';
import {
  trackShipment,
  isShip24Configured,
  milestoneToPackageStatus,
  Ship24TrackingResult,
} from '@/lib/ship24';
import { useApp } from '@/store/AppContext';
import { useBackgroundError } from '@/store/BackgroundErrorContext';
import { FREE_PACKAGE_LIMIT, FREE_POLL_INTERVAL_MS, PREMIUM_POLL_INTERVAL_MS } from '@/lib/tiers';
import { log } from "../lib/logger";

const STORAGE_KEY = 'porchivo_tracked_packages';

const STATUS_ORDER: PackageTrackingStatus[] = [
  'ordered',
  'shipped',
  'out_for_delivery',
  'delivered',
  'picked_up',
  'returned',
];

function getStatusIndex(status: PackageTrackingStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function createInitialStatusHistory(status: PackageTrackingStatus): PackageStatusEvent[] {
  const now = new Date().toISOString();
  return STATUS_ORDER.map((s) => ({
    status: s,
    timestamp: s === status ? now : null,
    completed: getStatusIndex(s) <= getStatusIndex(status),
  }));
}

function advanceStatusHistory(
  history: PackageStatusEvent[],
  newStatus: PackageTrackingStatus,
): PackageStatusEvent[] {
  const now = new Date().toISOString();
  const newIndex = getStatusIndex(newStatus);
  return history.map((event) => {
    const idx = getStatusIndex(event.status);
    if (idx <= newIndex) {
      return {
        ...event,
        completed: true,
        timestamp: event.timestamp ?? now,
      };
    }
    return { ...event, completed: false, timestamp: null };
  });
}

export interface AddPackageInput {
  name: string;
  carrier: Carrier;
  trackingNumber: string;
  expectedDeliveryDate: string;
  expectedDeliveryWindowStart: string | null;
  expectedDeliveryWindowEnd: string | null;
  addressNickname: AddressNickname;
  customAddressLabel: string | null;
  notesForPartner: string;
  porchPartnerId: string | null;
}

function sortByUrgency(a: TrackedPackage, b: TrackedPackage): number {
  const statusPriority: Record<PackageTrackingStatus, number> = {
    out_for_delivery: 0,
    shipped: 1,
    ordered: 2,
    delivered: 3,
    picked_up: 4,
    returned: 5,
  };
  const aPri = statusPriority[a.currentStatus] ?? 99;
  const bPri = statusPriority[b.currentStatus] ?? 99;
  if (aPri !== bPri) return aPri - bPri;
  return new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime();
}

function ship24EventsToLive(tracking: Ship24TrackingResult): LiveTrackingEvent[] {
  return (tracking.events ?? []).map((e) => ({
    id: e.eventId,
    status: e.status,
    occurrenceAt: e.occurrenceDatetime,
    location: e.location,
    milestone: e.statusMilestone ?? null,
    courierCode: e.courierCode,
  }));
}

export const [PackagesProvider, usePackages] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { capabilities } = useApp();
  const { reportError, resolveError } = useBackgroundError();
  const [packages, setPackages] = useState<TrackedPackage[]>([]);
  const packagesRef = useRef<TrackedPackage[]>([]);
  packagesRef.current = packages;
  const pollIntervalMs = capabilities.fastPolling ? PREMIUM_POLL_INTERVAL_MS : FREE_POLL_INTERVAL_MS;

  const packagesQuery = useQuery({
    queryKey: ['tracked_packages'],
    queryFn: async () => {
      log('[Packages] Loading packages from storage...');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TrackedPackage[];
        log('[Packages] Loaded', parsed.length, 'packages');
        return parsed.map((p) => ({
          ...p,
          trackerId: p.trackerId ?? null,
          liveMilestone: p.liveMilestone ?? null,
          liveEvents: p.liveEvents ?? [],
          lastPolledAt: p.lastPolledAt ?? null,
        }));
      }
      return [];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (data: TrackedPackage[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tracked_packages'], data);
    },
  });

  useEffect(() => {
    if (packagesQuery.data) {
      setPackages(packagesQuery.data);
    }
  }, [packagesQuery.data]);

  const sendStatusNotification = useCallback(async (pkg: TrackedPackage, newStatus: PackageTrackingStatus) => {
    log('[Packages] Sending notification for', pkg.name, '->', newStatus);

    // Respect user notification preferences before sending
    const notifType = newStatus === 'out_for_delivery'
      ? 'package_out_for_delivery'
      : newStatus === 'delivered'
        ? 'package_delivered'
        : newStatus === 'picked_up'
          ? 'package_picked_up'
          : null;
    if (notifType) {
      const shouldSend = await shouldSendNotification(notifType);
      if (!shouldSend) {
        log('[Packages] Notification muted by user pref:', notifType);
        return;
      }
    }

    let title = '';
    let body = '';

    switch (newStatus) {
      case 'out_for_delivery':
        title = 'Out for Delivery';
        body = `Your ${pkg.carrier} package "${pkg.name}" is out for delivery!`;
        break;
      case 'delivered':
        title = 'Delivered to Your Porch';
        body = `Your ${pkg.carrier} package "${pkg.name}" has been delivered.`;
        break;
      case 'picked_up':
        title = 'Picked Up by Porch Partner';
        body = `Your ${pkg.carrier} package "${pkg.name}" was picked up by your Porch Partner.`;
        break;
      default:
        return;
    }

    try {
      await scheduleLocalNotification(title, body, { packageId: pkg.id, status: newStatus }, 1);
    } catch (e) {
      log('[Packages] Notification error:', e);
    }
  }, []);

  const assignDriverToPackage = useCallback((packageId: string, driverId: string) => {
    log('[Packages] Assigning driver', driverId, 'to package', packageId);
    setPackages((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== packageId) return p;
        return { ...p, driverId, updatedAt: new Date().toISOString() };
      });
      syncMutation.mutate(updated);
      return updated;
    });
  }, [syncMutation]);

  const unassignDriverFromPackage = useCallback((packageId: string) => {
    log('[Packages] Unassigning driver from package', packageId);
    setPackages((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== packageId) return p;
        return { ...p, driverId: null, updatedAt: new Date().toISOString() };
      });
      syncMutation.mutate(updated);
      return updated;
    });
  }, [syncMutation]);

  const updatePackageStatus = useCallback((packageId: string, newStatus: PackageTrackingStatus) => {
    log('[Packages] Updating status for', packageId, 'to', newStatus);
    setPackages((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== packageId) return p;
        const newHistory = advanceStatusHistory(p.statusHistory, newStatus);
        return {
          ...p,
          currentStatus: newStatus,
          statusHistory: newHistory,
          deliveredTimestamp: newStatus === 'delivered' ? new Date().toISOString() : p.deliveredTimestamp,
          updatedAt: new Date().toISOString(),
        };
      });
      syncMutation.mutate(updated);

      const pkg = updated.find((p) => p.id === packageId);
      if (pkg) {
        sendStatusNotification(pkg, newStatus);
      }

      return updated;
    });
  }, [syncMutation, sendStatusNotification]);

  const applyTrackingResult = useCallback((packageId: string, tracking: Ship24TrackingResult) => {
    const liveEvents = ship24EventsToLive(tracking);
    const milestone = tracking.shipment?.statusMilestone ?? null;

    setPackages((prev) => {
      const pkg = prev.find((p) => p.id === packageId);
      if (!pkg) return prev;

      const nextStatus = milestoneToPackageStatus(milestone, pkg.currentStatus);
      const statusChanged = nextStatus !== pkg.currentStatus;
      const newHistory = statusChanged ? advanceStatusHistory(pkg.statusHistory, nextStatus) : pkg.statusHistory;

      const updated = prev.map((p) => {
        if (p.id !== packageId) return p;
        return {
          ...p,
          currentStatus: nextStatus,
          statusHistory: newHistory,
          trackerId: tracking.tracker?.trackerId ?? p.trackerId,
          liveMilestone: milestone,
          liveEvents,
          lastPolledAt: new Date().toISOString(),
          deliveredTimestamp: nextStatus === 'delivered' && !p.deliveredTimestamp
            ? (tracking.statistics?.timestamps?.deliveredDatetime ?? new Date().toISOString())
            : p.deliveredTimestamp,
          updatedAt: new Date().toISOString(),
        };
      });

      syncMutation.mutate(updated);

      if (statusChanged) {
        const nextPkg = updated.find((p) => p.id === packageId);
        if (nextPkg) {
          void sendStatusNotification(nextPkg, nextStatus);
        }
      }

      return updated;
    });
  }, [syncMutation, sendStatusNotification]);

  const pollingPromises = useRef<Map<string, Promise<void>>>(new Map());

  const pollPackage = useCallback(async (packageId: string): Promise<void> => {
    if (pollingPromises.current.has(packageId)) {
      return pollingPromises.current.get(packageId);
    }
    const pkg = packagesRef.current.find((p) => p.id === packageId);
    if (!pkg) return;
    if (pkg.currentStatus === 'picked_up' || pkg.currentStatus === 'returned') return;
    if (!isShip24Configured()) return;

    const promise = (async () => {
      try {
        const tracking = await trackShipment(pkg.trackingNumber, {
          carrier: pkg.carrier,
          clientTrackerId: pkg.id,
        });
        if (tracking) {
          applyTrackingResult(packageId, tracking);
        }
        resolveError('packages_poll');
      } catch (e) {
        log('[Packages] Poll error for', pkg.trackingNumber, e instanceof Error ? e.message : e);
        reportError('packages_poll', 'Tracking update unavailable', {
          onRetry: () => void pollPackage(packageId),
        });
      } finally {
        pollingPromises.current.delete(packageId);
      }
    })();

    pollingPromises.current.set(packageId, promise);
    return promise;
  }, [applyTrackingResult, reportError, resolveError]);

  const refreshAllPackages = useCallback(async () => {
    const list = packagesRef.current;
    const active = list.filter((p) => p.currentStatus !== 'picked_up' && p.currentStatus !== 'returned');
    log('[Packages] Refreshing', active.length, 'active packages');
    await Promise.all(active.map((p) => pollPackage(p.id)));
  }, [pollPackage]);

  useEffect(() => {
    if (!isShip24Configured()) {
      log('[Packages] Ship24 not configured, skipping polling');
      return;
    }
    const interval = setInterval(() => {
      void refreshAllPackages();
    }, pollIntervalMs);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        log('[Packages] App active — cancelling delivery reminders and refreshing tracking');
        void cancelDeliveryReminders();
        void refreshAllPackages();
      } else if (state === 'background' || state === 'inactive') {
        log('[Packages] App backgrounded — scheduling delivery reminders for active packages');
        const activeForReminder = packagesRef.current.filter(
          (p) =>
            p.currentStatus !== 'picked_up' &&
            p.currentStatus !== 'returned' &&
            p.currentStatus !== 'delivered',
        );
        for (const pkg of activeForReminder) {
          void scheduleDeliveryReminder({
            id: pkg.id,
            name: pkg.name,
            carrier: pkg.carrier,
            expectedDeliveryDate: pkg.expectedDeliveryDate,
            expectedDeliveryWindowEnd: pkg.expectedDeliveryWindowEnd ?? null,
          });
        }
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refreshAllPackages, pollIntervalMs]);

  const addPackage = useCallback((input: AddPackageInput, userId: string) => {
    log('[Packages] Adding package:', input.name);
    if (!capabilities.unlimitedPackages) {
      const activeCount = packagesRef.current.filter(
        (p) => p.currentStatus !== 'picked_up' && p.currentStatus !== 'returned' && p.currentStatus !== 'delivered',
      ).length;
      if (activeCount >= FREE_PACKAGE_LIMIT) {
        log('[Packages] Free package limit hit');
        throw new Error('FREE_LIMIT_REACHED');
      }
    }
    const now = new Date().toISOString();
    const id = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newPkg: TrackedPackage = {
      id,
      userId,
      name: input.name,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      expectedDeliveryDate: input.expectedDeliveryDate,
      expectedDeliveryWindowStart: input.expectedDeliveryWindowStart,
      expectedDeliveryWindowEnd: input.expectedDeliveryWindowEnd,
      currentStatus: 'ordered',
      addressNickname: input.addressNickname,
      customAddressLabel: input.customAddressLabel,
      notesForPartner: input.notesForPartner,
      statusHistory: createInitialStatusHistory('ordered'),
      driverId: null,
      porchPartnerId: input.porchPartnerId ?? null,
      deliveredTimestamp: null,
      trackerId: null,
      liveMilestone: null,
      liveEvents: [],
      lastPolledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    setPackages((prev) => {
      const updated = [...prev, newPkg];
      syncMutation.mutate(updated);
      return updated;
    });

    if (isShip24Configured()) {
      setTimeout(() => {
        void pollPackage(id);
      }, 500);
    }

    return newPkg;
  }, [syncMutation, pollPackage, capabilities.unlimitedPackages]);

  const deletePackage = useCallback((packageId: string) => {
    log('[Packages] Deleting package:', packageId);
    setPackages((prev) => {
      const updated = prev.filter((p) => p.id !== packageId);
      syncMutation.mutate(updated);
      return updated;
    });
  }, [syncMutation]);

  const sortedPackages = useMemo(() => {
    return [...packages].sort(sortByUrgency);
  }, [packages]);

  const activeCount = useMemo(() => packages.filter(
    (p) => p.currentStatus !== 'picked_up' && p.currentStatus !== 'returned' && p.currentStatus !== 'delivered',
  ).length, [packages]);
  const canAddMorePackages = capabilities.unlimitedPackages || activeCount < FREE_PACKAGE_LIMIT;
  const freeRemaining = capabilities.unlimitedPackages ? Infinity : Math.max(0, FREE_PACKAGE_LIMIT - activeCount);

  return {
    packages: sortedPackages,
    isLoading: packagesQuery.isLoading,
    addPackage,
    deletePackage,
    updatePackageStatus,
    assignDriverToPackage,
    unassignDriverFromPackage,
    refreshAllPackages,
    refreshPackage: pollPackage,
    ship24Enabled: isShip24Configured(),
    canAddMorePackages,
    freeRemaining,
    freeLimit: FREE_PACKAGE_LIMIT,
    assignPartnerToPackage: (packageId: string, partnerId: string | null) => {
      log('[Packages] Assigning porch partner', partnerId, 'to package', packageId);
      setPackages((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== packageId) return p;
          return { ...p, porchPartnerId: partnerId, updatedAt: new Date().toISOString() };
        });
        syncMutation.mutate(updated);
        return updated;
      });
    },
  };
});
