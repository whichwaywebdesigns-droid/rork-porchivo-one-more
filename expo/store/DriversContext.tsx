import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Driver, DriverStatus, TrackedPackage } from '@/types';
import { mockDrivers } from '@/mocks/drivers';
import { rankDriversForAssignment } from '@/lib/driverAssignment';
import { log } from "../lib/logger";

const DRIVERS_STORAGE_KEY = 'porchivo_drivers';
const ASSIGNMENTS_STORAGE_KEY = 'porchivo_driver_assignments';

interface DriverPackageAssignment {
  packageId: string;
  driverId: string;
  assignedAt: string;
}

export const [DriversProvider, useDrivers] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<DriverPackageAssignment[]>([]);

  const driversQuery = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      log('[Drivers] Loading drivers from storage...');
      const stored = await AsyncStorage.getItem(DRIVERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Driver[];
        log('[Drivers] Loaded', parsed.length, 'drivers');
        return parsed;
      }
      log('[Drivers] No stored drivers, using mock data');
      if (__DEV__) {
        await AsyncStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(mockDrivers));
        return mockDrivers;
      }
      log('[Drivers] No stored drivers, returning empty list');
      return [];
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ['driver_assignments'],
    queryFn: async () => {
      log('[Drivers] Loading assignments from storage...');
      const stored = await AsyncStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DriverPackageAssignment[];
        log('[Drivers] Loaded', parsed.length, 'assignments');
        return parsed;
      }
      return [];
    },
  });

  const syncDriversMutation = useMutation({
    mutationFn: async (data: Driver[]) => {
      await AsyncStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(data));
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['drivers'], data);
    },
  });

  const syncAssignmentsMutation = useMutation({
    mutationFn: async (data: DriverPackageAssignment[]) => {
      await AsyncStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(data));
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['driver_assignments'], data);
    },
  });

  useEffect(() => {
    if (driversQuery.data) {
      setDrivers(driversQuery.data);
    }
  }, [driversQuery.data]);

  useEffect(() => {
    if (assignmentsQuery.data) {
      setAssignments(assignmentsQuery.data);
    }
  }, [assignmentsQuery.data]);

  const assignDriverToPackage = useCallback((driverId: string, packageId: string) => {
    log('[Drivers] Assigning driver', driverId, 'to package', packageId);

    const newAssignment: DriverPackageAssignment = {
      packageId,
      driverId,
      assignedAt: new Date().toISOString(),
    };

    setAssignments((prev) => {
      const filtered = prev.filter((a) => a.packageId !== packageId);
      const updated = [...filtered, newAssignment];
      syncAssignmentsMutation.mutate(updated);
      return updated;
    });

    setDrivers((prev) => {
      const updated = prev.map((d) => {
        if (d.id === driverId) {
          return {
            ...d,
            activeStops: d.activeStops + 1,
            status: (d.activeStops + 1 >= 5 ? 'busy' : d.status) as DriverStatus,
          };
        }
        return d;
      });
      syncDriversMutation.mutate(updated);
      return updated;
    });

    return newAssignment;
  }, [syncAssignmentsMutation, syncDriversMutation]);

  const unassignDriverFromPackage = useCallback((packageId: string) => {
    log('[Drivers] Unassigning driver from package', packageId);
    const existing = assignments.find((a) => a.packageId === packageId);

    setAssignments((prev) => {
      const updated = prev.filter((a) => a.packageId !== packageId);
      syncAssignmentsMutation.mutate(updated);
      return updated;
    });

    if (existing) {
      setDrivers((prev) => {
        const updated = prev.map((d) => {
          if (d.id === existing.driverId) {
            const newStops = Math.max(0, d.activeStops - 1);
            return {
              ...d,
              activeStops: newStops,
              status: (newStops < 5 && d.status === 'busy' ? 'available' : d.status) as DriverStatus,
            };
          }
          return d;
        });
        syncDriversMutation.mutate(updated);
        return updated;
      });
    }
  }, [assignments, syncAssignmentsMutation, syncDriversMutation]);

  const updateDriverStatus = useCallback((driverId: string, status: DriverStatus) => {
    log('[Drivers] Updating driver status:', driverId, '->', status);
    setDrivers((prev) => {
      const updated = prev.map((d) =>
        d.id === driverId ? { ...d, status } : d
      );
      syncDriversMutation.mutate(updated);
      return updated;
    });
  }, [syncDriversMutation]);

  const getDriverById = useCallback((driverId: string): Driver | undefined => {
    return drivers.find((d) => d.id === driverId);
  }, [drivers]);

  const getDriverForPackage = useCallback((packageId: string): Driver | undefined => {
    const assignment = assignments.find((a) => a.packageId === packageId);
    if (!assignment) return undefined;
    return drivers.find((d) => d.id === assignment.driverId);
  }, [assignments, drivers]);

  const getPackagesForDriver = useCallback((driverId: string): string[] => {
    return assignments
      .filter((a) => a.driverId === driverId)
      .map((a) => a.packageId);
  }, [assignments]);

  const getRankedDrivers = useCallback((pkg?: TrackedPackage) => {
    return rankDriversForAssignment(drivers, pkg);
  }, [drivers]);

  const sortedDrivers = useMemo(() => {
    const statusOrder: Record<DriverStatus, number> = {
      available: 0,
      busy: 1,
      offline: 2,
    };
    return [...drivers].sort((a, b) => {
      const aOrder = statusOrder[a.status] ?? 2;
      const bOrder = statusOrder[b.status] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.activeStops - b.activeStops;
    });
  }, [drivers]);

  return {
    drivers: sortedDrivers,
    assignments,
    isLoading: driversQuery.isLoading || assignmentsQuery.isLoading,
    assignDriverToPackage,
    unassignDriverFromPackage,
    updateDriverStatus,
    getDriverById,
    getDriverForPackage,
    getPackagesForDriver,
    getRankedDrivers,
  };
});
