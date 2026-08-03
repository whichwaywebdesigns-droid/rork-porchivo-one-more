import { User, Shipment, DeliveryNotification } from '@/types';
import { DbProfile, DbShipment, DbNotification } from '@/types/database';

export function dbProfileToUser(p: DbProfile): User {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    avatarUrl: p.avatar_url,
    role: p.role,
    address: p.address,
    hasLocationConsent: p.has_location_consent,
    hasPreciseLocationConsent: p.has_precise_location_consent,
    expoPushToken: p.expo_push_token,
  };
}

export function dbShipmentToShipment(s: DbShipment): Shipment {
  return {
    id: s.id,
    homeownerId: s.homeowner_id,
    homeownerName: s.homeowner_name,
    partnerId: s.partner_id,
    partnerName: s.partner_name,
    status: s.status,
    carrier: s.carrier,
    packagesExpected: s.packages_expected,
    deliveryWindowStart: s.delivery_window_start,
    deliveryWindowEnd: s.delivery_window_end,
    trackingSubmittedAt: s.tracking_submitted_at,
    addressText: s.address_text,
    approximateLocation: s.approximate_lat != null && s.approximate_lng != null
      ? { lat: s.approximate_lat, lng: s.approximate_lng }
      : null,
    preciseLocation: s.precise_lat != null && s.precise_lng != null
      ? { lat: s.precise_lat, lng: s.precise_lng }
      : null,
    dropoffLocation: s.dropoff_lat != null && s.dropoff_lng != null
      ? { lat: s.dropoff_lat, lng: s.dropoff_lng }
      : null,
    homeLocationVisibleToPartner: s.home_location_visible_to_partner,
    notes: s.notes,
    preferredReturnTime: s.preferred_return_time,
    trackingNumber: s.tracking_number,
    carrierTrackingUrl: s.carrier_tracking_url,
    deliveryStatus: s.delivery_status,
    completionPhotoUrl: s.completion_photo_url ?? null,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

export function dbNotificationToNotification(n: DbNotification): DeliveryNotification {
  return {
    id: n.id,
    shipmentId: n.shipment_id,
    type: n.type,
    title: n.title,
    message: n.message,
    recipientId: n.recipient_id,
    recipientRole: n.recipient_role,
    read: n.read,
    createdAt: n.created_at,
  };
}

export function shipmentToDbInsert(s: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbShipment, 'id' | 'created_at' | 'updated_at'> {
  return {
    homeowner_id: s.homeownerId,
    homeowner_name: s.homeownerName,
    partner_id: s.partnerId,
    partner_name: s.partnerName,
    status: s.status,
    carrier: s.carrier,
    packages_expected: s.packagesExpected,
    delivery_window_start: s.deliveryWindowStart,
    delivery_window_end: s.deliveryWindowEnd,
    tracking_submitted_at: s.trackingSubmittedAt,
    address_text: s.addressText,
    approximate_lat: s.approximateLocation?.lat ?? null,
    approximate_lng: s.approximateLocation?.lng ?? null,
    precise_lat: s.preciseLocation?.lat ?? null,
    precise_lng: s.preciseLocation?.lng ?? null,
    dropoff_lat: s.dropoffLocation?.lat ?? null,
    dropoff_lng: s.dropoffLocation?.lng ?? null,
    home_location_visible_to_partner: s.homeLocationVisibleToPartner,
    notes: s.notes,
    preferred_return_time: s.preferredReturnTime,
    tracking_number: s.trackingNumber,
    carrier_tracking_url: s.carrierTrackingUrl,
    delivery_status: s.deliveryStatus,
    completion_photo_url: s.completionPhotoUrl ?? null,
  };
}
