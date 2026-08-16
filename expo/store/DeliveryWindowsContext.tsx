import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { DeliveryWindow, WindowStatus, WindowType } from '@/types';
import { mockDeliveryWindows } from '@/mocks/deliveryWindows';
import { log } from "../lib/logger";

const STORAGE_KEY = 'porchivo_delivery_windows';

export const [DeliveryWindowsProvider, useDeliveryWindows] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);

  const windowsQuery = useQuery({
    queryKey: ['delivery-windows'],
    queryFn: async () => {
      log('[DeliveryWindows] Loading delivery windows...');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        log('[DeliveryWindows] Loaded from storage');
        return JSON.parse(stored) as DeliveryWindow[];
      }
      if (__DEV__) {
        log('[DeliveryWindows] DEV: Using mock data');
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockDeliveryWindows));
        return mockDeliveryWindows;
      }
      log('[DeliveryWindows] No stored windows, returning empty list');
      return [];
    },
  });

  useEffect(() => {
    if (windowsQuery.data) {
      setWindows(windowsQuery.data);
    }
  }, [windowsQuery.data]);

  const persistMutation = useMutation({
    mutationFn: async (updated: DeliveryWindow[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['delivery-windows'], data);
    },
  });

  const addWindow = useCallback((window: Omit<DeliveryWindow, 'id' | 'createdAt' | 'updatedAt'>) => {
    log('[DeliveryWindows] Adding window:', window.date, window.startTime);
    const newWindow: DeliveryWindow = {
      ...window,
      id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...windows, newWindow];
    setWindows(updated);
    persistMutation.mutate(updated);
    return newWindow;
  }, [windows, persistMutation]);

  const updateWindowStatus = useCallback((windowId: string, status: WindowStatus) => {
    log('[DeliveryWindows] Updating window status:', windowId, status);
    const updated = windows.map(w =>
      w.id === windowId ? { ...w, status, updatedAt: new Date().toISOString() } : w
    );
    setWindows(updated);
    persistMutation.mutate(updated);
  }, [windows, persistMutation]);

  const bookWindow = useCallback((windowId: string, homeownerId: string) => {
    log('[DeliveryWindows] Booking window:', windowId, 'for homeowner:', homeownerId);
    const updated = windows.map(w =>
      w.id === windowId
        ? { ...w, status: 'booked' as WindowStatus, homeownerId, type: 'delivery_window' as WindowType, updatedAt: new Date().toISOString() }
        : w
    );
    setWindows(updated);
    persistMutation.mutate(updated);
  }, [windows, persistMutation]);

  const cancelWindow = useCallback((windowId: string) => {
    log('[DeliveryWindows] Cancelling window:', windowId);
    const updated = windows.map(w =>
      w.id === windowId ? { ...w, status: 'cancelled' as WindowStatus, updatedAt: new Date().toISOString() } : w
    );
    setWindows(updated);
    persistMutation.mutate(updated);
  }, [windows, persistMutation]);

  const deleteWindow = useCallback((windowId: string) => {
    log('[DeliveryWindows] Deleting window:', windowId);
    const updated = windows.filter(w => w.id !== windowId);
    setWindows(updated);
    persistMutation.mutate(updated);
  }, [windows, persistMutation]);

  const getWindowsByDate = useCallback((date: string) => {
    return windows.filter(w => w.date === date);
  }, [windows]);

  const openWindows = useMemo(() =>
    windows.filter(w => w.status === 'open').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [windows]
  );

  const bookedWindows = useMemo(() =>
    windows.filter(w => w.status === 'booked').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [windows]
  );

  const completedWindows = useMemo(() =>
    windows.filter(w => w.status === 'completed'),
    [windows]
  );

  return useMemo(() => ({
    windows,
    openWindows,
    bookedWindows,
    completedWindows,
    isLoading: windowsQuery.isLoading,
    addWindow,
    updateWindowStatus,
    bookWindow,
    cancelWindow,
    deleteWindow,
    getWindowsByDate,
  }), [
    windows,
    openWindows,
    bookedWindows,
    completedWindows,
    windowsQuery.isLoading,
    addWindow,
    updateWindowStatus,
    bookWindow,
    cancelWindow,
    deleteWindow,
    getWindowsByDate,
  ]);
});
