import { Carrier, PackageTrackingStatus, DeliveryStatus } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { log } from "./logger";

export type Ship24Milestone =
  | 'info_received'
  | 'in_transit'
  | 'out_for_delivery'
  | 'failed_attempt'
  | 'available_for_pickup'
  | 'exception'
  | 'delivered'
  | 'pending'
  | 'unknown';

export interface Ship24Event {
  eventId: string;
  trackingNumber: string;
  status: string;
  occurrenceDatetime: string;
  location: string | null;
  courierCode: string | null;
  statusCode: string | null;
  statusCategory: string | null;
  statusMilestone: Ship24Milestone | null;
}

export interface Ship24Statistics {
  timestamps: {
    infoReceivedDatetime: string | null;
    inTransitDatetime: string | null;
    outForDeliveryDatetime: string | null;
    failedAttemptDatetime: string | null;
    availableForPickupDatetime: string | null;
    exceptionDatetime: string | null;
    deliveredDatetime: string | null;
  };
}

export interface Ship24Shipment {
  shipmentId?: string;
  statusCode?: string | null;
  statusCategory?: string | null;
  statusMilestone?: Ship24Milestone | null;
  originCountryCode?: string | null;
  destinationCountryCode?: string | null;
  delivery?: {
    estimatedDeliveryDate?: string | null;
    service?: string | null;
    signedBy?: string | null;
  };
  recipient?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    subdivision?: string | null;
    postCode?: string | null;
  };
}

export interface Ship24Tracker {
  trackerId: string;
  trackingNumber: string;
  isSubscribed: boolean;
  isTracked: boolean;
  createdAt: string;
}

export interface Ship24TrackingResult {
  tracker: Ship24Tracker;
  shipment: Ship24Shipment;
  events: Ship24Event[];
  statistics: Ship24Statistics;
}

export interface Ship24TrackResponse {
  data?: { trackings?: Ship24TrackingResult[] };
  errors?: { code: string; message: string }[];
}

/**
 * Tracking is available as long as Supabase is configured.
 * The Ship24 API key lives exclusively in the `track-shipment` Edge Function
 * and is never sent to the client.
 */
export function isShip24Configured(): boolean {
  return isSupabaseConfigured;
}

/**
 * Track a shipment via the `track-shipment` Supabase Edge Function.
 * The Ship24 API key is read server-side only — it never touches the client bundle.
 */
export async function trackShipment(
  trackingNumber: string,
  opts?: { carrier?: Carrier; clientTrackerId?: string; signal?: AbortSignal },
): Promise<Ship24TrackingResult | null> {
  if (!isShip24Configured()) {
    log('[Ship24] Supabase not configured, skipping live tracking');
    return null;
  }
  if (!trackingNumber.trim()) return null;

  // Bail early if the caller already aborted before we start
  if (opts?.signal?.aborted) return null;

  log('[Ship24] Invoking track-shipment Edge Function for', trackingNumber);

  try {
    const { data, error } = await supabase.functions.invoke<{ data: Ship24TrackingResult | null }>('track-shipment', {
      body: {
        trackingNumber: trackingNumber.trim(),
        carrier: opts?.carrier,
        clientTrackerId: opts?.clientTrackerId,
      },
    });

    if (error) {
      log('[Ship24] Edge Function error:', error.message);
      throw new Error(error.message);
    }

    const tracking = (data as unknown as { data: Ship24TrackingResult | null } | null)?.data ?? null;
    if (!tracking) {
      log('[Ship24] No tracking result returned');
      return null;
    }

    log('[Ship24] Got', tracking.events?.length ?? 0, 'events; milestone:', tracking.shipment?.statusMilestone);
    return tracking;
  } catch (e) {
    if (opts?.signal?.aborted) return null;
    log('[Ship24] Error:', e instanceof Error ? e.message : e);
    throw e;
  }
}

export function milestoneToPackageStatus(
  milestone: Ship24Milestone | null | undefined,
  current: PackageTrackingStatus,
): PackageTrackingStatus {
  switch (milestone) {
    case 'delivered':
      return current === 'picked_up' || current === 'returned' ? current : 'delivered';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'in_transit':
    case 'available_for_pickup':
    case 'failed_attempt':
    case 'exception':
      return current === 'ordered' ? 'shipped' : current;
    case 'info_received':
      return current === 'ordered' ? 'shipped' : current;
    default:
      return current;
  }
}

export function milestoneToDeliveryStatus(
  milestone: Ship24Milestone | null | undefined,
  current: DeliveryStatus,
): DeliveryStatus {
  switch (milestone) {
    case 'delivered':
      return current === 'delivered_to_homeowner' ? current : 'delivered';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'in_transit':
    case 'info_received':
    case 'available_for_pickup':
    case 'exception':
    case 'failed_attempt':
      return current === 'pending' ? 'in_transit' : current;
    default:
      return current;
  }
}

export function friendlyMilestoneLabel(m: Ship24Milestone | null | undefined): string {
  switch (m) {
    case 'delivered': return 'Delivered';
    case 'out_for_delivery': return 'Out for delivery';
    case 'in_transit': return 'In transit';
    case 'info_received': return 'Label created';
    case 'available_for_pickup': return 'Ready for pickup';
    case 'failed_attempt': return 'Delivery attempted';
    case 'exception': return 'Exception';
    case 'pending': return 'Pending';
    default: return 'Tracking';
  }
}
