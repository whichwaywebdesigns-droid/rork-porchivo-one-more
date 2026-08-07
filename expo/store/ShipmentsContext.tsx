import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { LiveTrackingEvent, Shipment } from '@/types';
import { DbShipment } from '@/types/database';
import { dbShipmentToShipment, shipmentToDbInsert } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { useBackgroundError } from '@/store/BackgroundErrorContext';
import { useNotifications } from '@/store/NotificationsContext';
import { playDeliveryChime, playPickupChime } from '@/lib/sounds';
import { maybeRequestReview } from '@/lib/storeReview';
import { shouldSendNotification } from '@/lib/notificationPreferences';
import { buildOFDAlert, buildDeliveredAlert } from '@/lib/personalizedPush';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  trackShipment,
  isShip24Configured,
  milestoneToDeliveryStatus,
  Ship24TrackingResult,
  Ship24Milestone,
} from '@/lib/ship24';

import { FREE_POLL_INTERVAL_MS, PREMIUM_POLL_INTERVAL_MS } from '@/lib/tiers';
import { log } from "../lib/logger";

export interface ShipmentTrackingInfo {
  milestone: Ship24Milestone | null;
  events: LiveTrackingEvent[];
  lastPolledAt: string | null;
  estimatedDelivery: string | null;
}

export const [ShipmentsProvider, useShipments] = createContextHook(() => {
  const { session, user, capabilities } = useApp();
  const { reportError, resolveError } = useBackgroundError();
  const { createNotification } = useNotifications();
  const shipmentPollIntervalMs = capabilities.fastPolling ? PREMIUM_POLL_INTERVAL_MS : FREE_POLL_INTERVAL_MS;
  const queryClient = useQueryClient();

  const shipmentsQuery = useQuery({
    queryKey: ['shipments', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      log('[ShipmentsContext] Fetching shipments from Supabase...');
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .or(`homeowner_id.eq.${session.user.id},partner_id.eq.${session.user.id},status.eq.open`)
        .order('created_at', { ascending: false });

      if (error) {
        log('[ShipmentsContext] Shipments fetch error:', error.message);
        throw error;
      }
      log('[ShipmentsContext] Fetched', data?.length ?? 0, 'shipments');
      return (data as DbShipment[]).map(dbShipmentToShipment);
    },
    enabled: !!session?.user?.id,
  });

  const shipments = useMemo(() => shipmentsQuery.data ?? [], [shipmentsQuery.data]);
  const shipmentsRef = useRef(shipments);
  shipmentsRef.current = shipments;

  // Surface Supabase fetch failures via the background error banner.
  useEffect(() => {
    if (shipmentsQuery.isError) {
      reportError('shipments_fetch', 'Could not load your shipments', {
        onRetry: () => void queryClient.invalidateQueries({ queryKey: ['shipments'] }),
      });
    } else if (shipmentsQuery.isSuccess) {
      resolveError('shipments_fetch');
    }
  }, [shipmentsQuery.isError, shipmentsQuery.isSuccess, reportError, resolveError, queryClient]);

  const [trackingByShipment, setTrackingByShipment] = useState<Record<string, ShipmentTrackingInfo>>({});
  const pollingSet = useRef<Set<string>>(new Set());

  const addShipmentMutation = useMutation({
    mutationFn: async (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
      log('[ShipmentsContext] Inserting shipment into Supabase...');
      const dbData = shipmentToDbInsert(shipment);
      const { data, error } = await supabase
        .from('shipments')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        log('[ShipmentsContext] Shipment insert error:', error.message);
        throw error;
      }
      log('[ShipmentsContext] Shipment created:', data.id);
      return dbShipmentToShipment(data as DbShipment);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  const updateShipmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbShipment> }) => {
      log('[ShipmentsContext] Updating shipment:', id);
      const { data, error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        log('[ShipmentsContext] Shipment update error:', error.message);
        throw error;
      }
      return dbShipmentToShipment(data as DbShipment);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  const addShipment = useCallback((shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    log('[ShipmentsContext] Adding shipment');
    addShipmentMutation.mutate(shipment);
  }, [addShipmentMutation]);

  const acceptShipment = useCallback(async (shipmentId: string) => {
    if (!user) return;
    log('[ShipmentsContext] Accepting shipment via RPC:', shipmentId);
    // Use the security-definer accept_shipment() RPC from hardened-rls.sql.
    // Direct UPDATE is blocked — the hardened policy only allows partners to
    // update shipments where partner_id = auth.uid(), but partner_id is null
    // until after accept, so a direct UPDATE would be rejected by RLS.
    const { error } = await supabase.rpc('accept_shipment', { p_shipment_id: shipmentId });
    if (error) {
      log('[ShipmentsContext] accept_shipment RPC error:', error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['shipments'] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryClient]);

  const completeShipment = useCallback(async (shipmentId: string, completionPhotoUrl?: string | null) => {
    log('[ShipmentsContext] Completing shipment:', shipmentId, completionPhotoUrl ? 'with photo' : 'no photo');
    const updates: Partial<DbShipment> = {
      status: 'completed',
      delivery_status: 'delivered_to_homeowner',
    };
    if (completionPhotoUrl) {
      updates.completion_photo_url = completionPhotoUrl;
    }

    try {
      const completed = await updateShipmentMutation.mutateAsync({
        id: shipmentId,
        updates,
      });

      // Notify the homeowner that their package is safely stored with the neighbor.
      const homeownerId = completed.homeownerId;
      if (homeownerId) {
        const ok = await shouldSendNotification('partner_completed');
        if (!ok) {
          log('[ShipmentsContext] Partner-completed alert muted by user pref');
        } else {
          const partnerName = completed.partnerName || 'Your Porch Partner';
          const carrier = completed.carrier || 'package';
          void createNotification(
            shipmentId,
            'partner_completed',
            'Package safely stored',
            `${partnerName} has your ${carrier} package safely stored. Tap to view details.`,
            homeownerId,
            'homeowner',
          );
        }
      }
    } catch (err) {
      log('[ShipmentsContext] Complete shipment error:', err instanceof Error ? err.message : err);
      throw err;
    }

    void playPickupChime().catch(e => log('[ShipmentsContext] Pickup chime error:', e));
    void maybeRequestReview();
  }, [updateShipmentMutation, createNotification]);

  const cancelShipment = useCallback((shipmentId: string) => {
    log('[ShipmentsContext] Cancelling shipment:', shipmentId);
    updateShipmentMutation.mutate({
      id: shipmentId,
      updates: {
        status: 'cancelled',
      },
    });
  }, [updateShipmentMutation]);

  const _simulateDelivery = useCallback((shipmentId: string) => {
    log('[ShipmentsContext] Simulating delivery for shipment:', shipmentId);
    const target = shipmentsRef.current.find(s => s.id === shipmentId);
    if (!target || target.deliveryStatus === 'delivered') return;

    updateShipmentMutation.mutate({
      id: shipmentId,
      updates: { delivery_status: 'delivered' },
    });

    void playDeliveryChime().catch(e => log('[ShipmentsContext] Delivery chime error:', e));

    // Personalized delivered alert to homeowner
    void shouldSendNotification('package_delivered').then((ok) => {
      if (!ok) { log('[ShipmentsContext] Delivered alert muted by user pref'); return; }
      const alert = buildDeliveredAlert({
        userName: target.homeownerName ?? 'there',
        carrier: target.carrier,
        shipmentId,
      });
      void createNotification(
        shipmentId,
        'package_delivered',
        alert.title,
        alert.body + (target.partnerName ? ` ${target.partnerName} has been notified to pick it up.` : ''),
        target.homeownerId,
        'homeowner',
      );
    });

    // Partner pickup alert
    if (target.partnerId) {
      const partnerId = target.partnerId;
      void shouldSendNotification('partner_pickup_alert').then((ok) => {
        if (!ok) { log('[ShipmentsContext] Partner pickup alert muted by user pref'); return; }
        void createNotification(
          shipmentId,
          'partner_pickup_alert',
          'Time to pick up!',
          `${target.homeownerName}'s ${target.carrier} package has been delivered to their porch. Head over to pick it up and keep it safe!`,
          partnerId,
          'partner',
        );
      });
    }
  }, [updateShipmentMutation, createNotification]);

  const applyShipmentTracking = useCallback((shipmentId: string, tracking: Ship24TrackingResult) => {
    const milestone = tracking.shipment?.statusMilestone ?? null;
    const events: LiveTrackingEvent[] = (tracking.events ?? []).map((e) => ({
      id: e.eventId,
      status: e.status,
      occurrenceAt: e.occurrenceDatetime,
      location: e.location,
      milestone: e.statusMilestone ?? null,
      courierCode: e.courierCode,
    }));

    setTrackingByShipment((prev) => ({
      ...prev,
      [shipmentId]: {
        milestone,
        events,
        lastPolledAt: new Date().toISOString(),
        estimatedDelivery: tracking.shipment?.delivery?.estimatedDeliveryDate ?? null,
      },
    }));

    const current = shipmentsRef.current.find((s) => s.id === shipmentId);
    if (!current) return;

    const nextDelivery = milestoneToDeliveryStatus(milestone, current.deliveryStatus);
    if (nextDelivery !== current.deliveryStatus) {
      log('[ShipmentsContext] Live tracking -> delivery status:', nextDelivery);
      updateShipmentMutation.mutate({
        id: shipmentId,
        updates: { delivery_status: nextDelivery },
      });

      if (nextDelivery === 'delivered' && current.deliveryStatus !== 'delivered' && current.deliveryStatus !== 'delivered_to_homeowner') {
        void playDeliveryChime().catch(e => log('[ShipmentsContext] Chime error:', e));
        void AsyncStorage.getItem('porchivo_first_delivery_tracked').then((v) => {
          if (!v) {
            void AsyncStorage.setItem('porchivo_first_delivery_tracked', String(Date.now()));
            log('[ShipmentsContext] First successful delivery tracked — paywall moment available');
          }
        });
        // Personalized delivered alert — respect notification preferences
        void shouldSendNotification('package_delivered').then((ok) => {
          if (!ok) { log('[ShipmentsContext] Delivered alert muted by user pref'); return; }
          const alert = buildDeliveredAlert({
            userName: current.homeownerName ?? 'there',
            carrier: current.carrier,
            shipmentId,
          });
          void createNotification(
            shipmentId,
            'package_delivered',
            alert.title,
            alert.body + (current.partnerName ? ` ${current.partnerName} has been notified to pick it up.` : ''),
            current.homeownerId,
            'homeowner',
          );
        });
        if (current.partnerId) {
          const partnerId = current.partnerId;
          void shouldSendNotification('partner_pickup_alert').then((ok) => {
            if (!ok) { log('[ShipmentsContext] Partner pickup alert muted by user pref'); return; }
            void createNotification(
              shipmentId,
              'partner_pickup_alert',
              'Time to pick up!',
              `${current.homeownerName}'s ${current.carrier} package has been delivered. Head over to pick it up.`,
              partnerId,
              'partner',
            );
          });
        }
      } else if (nextDelivery === 'out_for_delivery' && current.deliveryStatus !== 'out_for_delivery') {
        // OFD alerts: respect premium gate AND user preferences
        if (capabilities.outForDeliveryAlerts) {
          void shouldSendNotification('package_out_for_delivery').then((ok) => {
            if (!ok) { log('[ShipmentsContext] OFD alert muted by user pref'); return; }
            const alert = buildOFDAlert({
              userName: current.homeownerName ?? 'there',
              carrier: current.carrier,
              shipmentId,
            });
            void createNotification(
              shipmentId,
              'package_out_for_delivery',
              alert.title,
              alert.body,
              current.homeownerId,
              'homeowner',
            );
          });
        } else {
          log('[ShipmentsContext] Skipping OFD alert (premium feature)');
        }
      }
    }
  }, [updateShipmentMutation, createNotification]);

  const pollShipmentTracking = useCallback(async (shipmentId: string): Promise<void> => {
    if (!isShip24Configured()) return;
    if (pollingSet.current.has(shipmentId)) return;
    const sh = shipmentsRef.current.find((s) => s.id === shipmentId);
    if (!sh || !sh.trackingNumber) return;
    if (sh.deliveryStatus === 'delivered_to_homeowner') return;

    pollingSet.current.add(shipmentId);
    try {
      const tracking = await trackShipment(sh.trackingNumber, {
        carrier: sh.carrier,
        clientTrackerId: `shipment_${sh.id}`,
      });
      if (tracking) {
        applyShipmentTracking(shipmentId, tracking);
      }
      resolveError('shipments_poll');
    } catch (e) {
      log('[ShipmentsContext] Live poll error:', e instanceof Error ? e.message : e);
      reportError('shipments_poll', 'Live tracking update unavailable', {
        onRetry: () => void pollShipmentTracking(shipmentId),
      });
    } finally {
      pollingSet.current.delete(shipmentId);
    }
  }, [applyShipmentTracking, reportError, resolveError]);

  const refreshAllShipmentTracking = useCallback(async () => {
    const list = shipmentsRef.current.filter(
      (s) => s.trackingNumber && s.deliveryStatus !== 'delivered_to_homeowner',
    );
    if (list.length === 0) return;
    log('[ShipmentsContext] Refreshing tracking for', list.length, 'shipments');
    await Promise.all(list.map((s) => pollShipmentTracking(s.id)));
  }, [pollShipmentTracking]);

  useEffect(() => {
    if (!isShip24Configured()) return;
    const interval = setInterval(() => {
      void refreshAllShipmentTracking();
    }, shipmentPollIntervalMs);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshAllShipmentTracking();
      }
    });

    void refreshAllShipmentTracking();
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments.length, shipmentPollIntervalMs]);

  const updateShipmentTracking = useCallback((shipmentId: string, trackingNumber: string, shareLocation: boolean) => {
    log('[ShipmentsContext] Updating tracking for:', shipmentId);
    const targetShipment = shipmentsRef.current.find(s => s.id === shipmentId);

    const updates: Partial<DbShipment> = {
      tracking_number: trackingNumber,
      tracking_submitted_at: new Date().toISOString(),
      home_location_visible_to_partner: shareLocation,
    };

    if (shareLocation && targetShipment?.approximateLocation) {
      updates.dropoff_lat = targetShipment.approximateLocation.lat;
      updates.dropoff_lng = targetShipment.approximateLocation.lng;
    }

    updateShipmentMutation.mutate({ id: shipmentId, updates });

    if (targetShipment && targetShipment.partnerId && targetShipment.partnerName) {
      void createNotification(
        shipmentId,
        'tracking_added',
        'Tracking number added',
        `${targetShipment.homeownerName} added a tracking number for their ${targetShipment.carrier} package. You'll be notified when it's delivered.`,
        targetShipment.partnerId,
        'partner',
      );
    }

    setTimeout(() => {
      void pollShipmentTracking(shipmentId);
    }, 500);
  }, [updateShipmentMutation, createNotification, pollShipmentTracking]);

  const myShipments = useMemo(() =>
    shipmentsRef.current.filter(s => s.homeownerId === user?.id).sort((a, b) =>
      new Date(b.deliveryWindowStart).getTime() - new Date(a.deliveryWindowStart).getTime()
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shipments, user?.id]
  );

  const nearbyShipments = useMemo(() =>
    shipmentsRef.current.filter(s => s.status === 'open' && s.homeownerId !== user?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shipments, user?.id]
  );

  const activeShipments = useMemo(() =>
    shipmentsRef.current.filter(s =>
      (s.status === 'accepted' || s.status === 'open') &&
      (s.homeownerId === user?.id || s.partnerId === user?.id)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shipments, user?.id]
  );

  const completedShipments = useMemo(() =>
    shipmentsRef.current.filter(s =>
      s.status === 'completed' &&
      (s.homeownerId === user?.id || s.partnerId === user?.id)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shipments, user?.id]
  );

  return useMemo(() => ({
    shipments,
    myShipments,
    nearbyShipments,
    activeShipments,
    completedShipments,
    addShipment,
    acceptShipment,
    completeShipment,
    cancelShipment,
    updateShipmentTracking,
    trackingByShipment,
    refreshShipmentTracking: pollShipmentTracking,
    refreshAllShipmentTracking,
    ship24Enabled: isShip24Configured(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    shipmentsQuery.data,
    myShipments,
    nearbyShipments,
    activeShipments,
    completedShipments,
    addShipment,
    acceptShipment,
    completeShipment,
    cancelShipment,
    updateShipmentTracking,
    trackingByShipment,
    pollShipmentTracking,
    refreshAllShipmentTracking,
  ]);
});
