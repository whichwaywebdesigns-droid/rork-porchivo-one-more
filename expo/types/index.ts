export type UserRole = 'homeowner' | 'partner' | 'both';

export type ShipmentStatus = 'open' | 'accepted' | 'completed' | 'cancelled';

export type DeliveryStatus = 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delivered_to_homeowner';

export type Carrier = 'Amazon' | 'UPS' | 'USPS' | 'FedEx' | 'Other';

export type NotificationType = 'tracking_added' | 'package_delivered' | 'partner_pickup_alert' | 'partner_completed' | 'package_out_for_delivery' | 'package_picked_up';

export type PackageTrackingStatus = 'ordered' | 'shipped' | 'out_for_delivery' | 'delivered' | 'picked_up' | 'returned';

export type AddressNickname = 'Home' | 'Work' | 'Other';

export type SafeDropPreference =
  | 'front_porch'
  | 'back_door'
  | 'garage'
  | 'mailroom'
  | 'side_entrance'
  | 'leasing_office'
  | 'other';

export type PreferredDeliveryWindow = 'morning' | 'afternoon' | 'evening' | 'any';

/** Structured address with individual fields for precision */
export interface StructuredAddress {
  street: string;
  unit: string;       // apt / suite / unit — empty string if none
  city: string;
  state: string;
  zip: string;
  country: string;    // defaults to 'US'
}

/** Extended profile data stored locally (pending full DB migration) */
export interface ProfileExtension {
  // ── Shared ──────────────────────────────────────────────────────
  /** Structured shipping address — where packages are physically delivered */
  shippingAddress: StructuredAddress;
  /** Billing address for payment processing — may differ from shipping */
  billingAddress: StructuredAddress;
  billingAddressSameAsShipping: boolean;
  /** Emergency contact info */
  emergencyContactName: string;
  emergencyContactPhone: string;

  // ── Homeowner-specific ──────────────────────────────────────────
  /** Delivery instructions for drivers and Porch Partners */
  deliveryInstructions: string;
  /** Gate / building / lockbox access code — shared only with assigned partner */
  accessCode: string;
  /** Preferred location for safe package drop */
  safeDropPreference: SafeDropPreference;
  /** Free-form notes about the safe drop location */
  safeDropNotes: string;
  /** Preferred delivery time window */
  preferredDeliveryWindow: PreferredDeliveryWindow;

  // ── Partner-specific ────────────────────────────────────────────
  /** Legal first name as it appears on government ID (for payouts / 1099) */
  legalFirstName: string;
  /** Legal last name */
  legalLastName: string;
  /** Optional business / DBA name if operating as an LLC or sole proprietor */
  businessName: string;
  /** Short bio shown to homeowners on the partner marketplace */
  partnerBio: string;
  /** Maximum radius (miles) the partner will travel to pick up packages */
  serviceRadiusMiles: number;
  /** Package sizes the partner accepts */
  acceptedPackageSizes: PackageSize[];
  /** Maximum number of concurrent holds */
  maxDailyHolds: number;
  /** Last 4 digits of SSN or EIN — stored locally only, never transmitted */
  taxIdLast4: string;
  /** Free-form service hours / availability note */
  serviceHoursNotes: string;
  /** True if this partner holds packages for free — no charge to homeowners */
  isVolunteer: boolean;
}

export interface PackageStatusEvent {
  status: PackageTrackingStatus;
  timestamp: string | null;
  completed: boolean;
}

export interface LiveTrackingEvent {
  id: string;
  status: string;
  occurrenceAt: string;
  location: string | null;
  milestone: string | null;
  courierCode: string | null;
}

export interface TrackedPackage {
  id: string;
  userId: string;
  name: string;
  carrier: Carrier;
  trackingNumber: string;
  expectedDeliveryDate: string;
  expectedDeliveryWindowStart: string | null;
  expectedDeliveryWindowEnd: string | null;
  currentStatus: PackageTrackingStatus;
  addressNickname: AddressNickname;
  customAddressLabel: string | null;
  notesForPartner: string;
  personalNotes: string;
  statusHistory: PackageStatusEvent[];
  driverId: string | null;
  porchPartnerId: string | null;
  deliveredTimestamp: string | null;
  trackerId: string | null;
  liveMilestone: string | null;
  liveEvents: LiveTrackingEvent[];
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DriverStatus = 'available' | 'busy' | 'offline';

export type VehicleType = 'car' | 'van' | 'truck' | 'bike' | 'scooter';

export interface Driver {
  id: string;
  name: string;
  avatarUrl: string | null;
  phone: string;
  email: string;
  vehicleType: VehicleType;
  status: DriverStatus;
  activeStops: number;
  location: { lat: number; lng: number } | null;
  rating: number;
  completedDeliveries: number;
}

export interface DeliveryNotification {
  id: string;
  shipmentId: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  recipientRole: 'homeowner' | 'partner';
  read: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  address: string;
  hasLocationConsent: boolean;
  hasPreciseLocationConsent: boolean;
  expoPushToken: string | null;
}

export interface PorchPartner {
  id: string;
  name: string;
  avatarUrl: string | null;
  street: string;
  distance: number;
  completedHolds: number;
  rating: number;
  joinedAt: string;
  status: 'active' | 'inactive';
  /** Package sizes this partner accepts (defaults to all if omitted) */
  acceptedSizes?: PackageSize[];
  geoTier?: GeoTier;
  /** True if this partner holds packages for free — no charge to homeowners */
  isVolunteer?: boolean;
}

export interface PackageHold {
  packageId: string;
  partnerId: string;
  homeownerId: string;
  homeownerNickname: string;
  status: 'pending' | 'picked_up' | 'returned';
  pickedUpAt: string | null;
  returnedAt: string | null;
  assignedAt: string;
  /** Package size for rate calculation */
  packageSize?: PackageSize;
  /** Agreed rate in cents (what homeowner paid) */
  rateCents?: number;
}

export interface DriverAssignment {
  packageId: string;
  driverId: string;
  assignedAt: string;
  recipientName: string;
  address: string;
  etaWindow: string;
  status: PackageTrackingStatus;
}

export type SuspiciousActivityCategory = 'suspicious_person' | 'package_taken' | 'unknown_vehicle' | 'other';

export type AlertStatus = 'active' | 'resolved';

export interface SuspiciousAlert {
  id: string;
  userId: string;
  category: SuspiciousActivityCategory;
  description: string;
  photoUrl: string | null;
  approximateLocation: string;
  blockId: string;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  mutedByUsers: string[];
  reportedByUsers: string[];
}

export type NeighborhoodEventType = 
  | 'package_delivered'
  | 'partner_pickup'
  | 'package_returned'
  | 'new_partner_joined'
  | 'delivery_in_progress';

export interface NeighborhoodEvent {
  id: string;
  type: NeighborhoodEventType;
  title: string;
  description: string;
  relativeLocation: string;
  timestamp: string;
  blockId: string;
}

// ─── Partner Verification & Marketplace ─────────────────────────────────────

export type IdvStatus = 'not_started' | 'pending' | 'requires_input' | 'verified' | 'cancelled' | 'failed';
export type PayoutStatus = 'not_connected' | 'pending' | 'active' | 'disabled';
export type PackageSize = 'small' | 'medium' | 'large';
export type GeoTier = 'tier1' | 'tier2' | 'tier3';
export type PartnerTier = 'basic' | 'verified' | 'trusted' | 'elite';
export type ConnectionStatus = 'pending' | 'active' | 'paused' | 'removed';
export type CompensationType = 'free' | 'per_hold' | 'monthly';
export type AssignmentStatus = 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled' | 'disputed';
export type AssignmentPaymentStatus = 'unpaid' | 'authorized' | 'captured' | 'refunded' | 'failed';
export type PayoutRecordStatus = 'pending' | 'in_transit' | 'paid' | 'failed' | 'cancelled';

export interface PartnerVerification {
  id: string;
  userId: string;
  idvStatus: IdvStatus;
  idvFailureReason: string | null;
  idvVerifiedAt: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  payoutStatus: PayoutStatus;
  stripeAccountId: string | null;
  tier: PartnerTier;
  totalAssignments: number;
  completedAssignments: number;
  lifetimeEarningsCents: number;
  averageRating: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerConnection {
  id: string;
  homeownerId: string;
  partnerId: string;
  status: ConnectionStatus;
  compensationType: CompensationType;
  rateCents: number;
  homeownerNotes: string | null;
  requestedAt: string;
  acceptedAt: string | null;
}

export interface PartnerAssignment {
  id: string;
  connectionId: string;
  homeownerId: string;
  partnerId: string;
  shipmentId: string | null;
  status: AssignmentStatus;
  expectedDeliveryDate: string | null;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  notes: string | null;
  agreedRateCents: number;
  platformFeeCents: number;
  partnerEarnCents: number;
  paymentStatus: AssignmentPaymentStatus;
  pickupConfirmedAt: string | null;
  completionConfirmedAt: string | null;
  homeownerRating: number | null;
  homeownerReview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPayout {
  id: string;
  partnerId: string;
  assignmentId: string | null;
  amountCents: number;
  stripeTransferId: string | null;
  status: PayoutRecordStatus;
  initiatedAt: string;
  paidAt: string | null;
  failureReason: string | null;
}

export const TIER_LABELS: Record<PartnerTier, string> = {
  basic: 'Basic',
  verified: 'ID Verified',
  trusted: 'Trusted',
  elite: 'Elite',
};

export const TIER_COLORS: Record<PartnerTier, string> = {
  basic: '#6B7F99',
  verified: '#3A7BD5',
  trusted: '#1E9C6A',
  elite: '#C8941E',
};

// ─── Invoicing & Tax Records ─────────────────────────────────────────────────

export type InvoicePeriodType = 'monthly' | 'quarterly' | 'annual';
export type InvoiceRole = 'homeowner' | 'partner';
export type InvoiceStatus = 'draft' | 'issued' | 'void';

export interface TransactionInvoice {
  id: string;
  invoiceNumber: string;
  assignmentId: string;
  homeownerId: string;
  partnerId: string;
  serviceDate: string;
  grossAmountCents: number;
  platformFeeCents: number;
  partnerEarnCents: number;
  stripeReferenceId: string | null;
  status: InvoiceStatus;
  homeownerName: string | null;
  partnerName: string | null;
  notes: string | null;
  createdAt: string;
  issuedAt: string | null;
}

export interface InvoicePeriod {
  id: string;
  userId: string;
  role: InvoiceRole;
  periodType: InvoicePeriodType;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  totalCents: number;
  platformFeeTotalCents: number;
  notificationSentAt: string | null;
  compiledAt: string;
  createdAt: string;
}

export type WindowStatus = 'open' | 'booked' | 'completed' | 'cancelled';
export type WindowType = 'availability' | 'delivery_window';

export interface DeliveryWindow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: WindowType;
  status: WindowStatus;
  homeownerId: string;
  porchPartnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  shipmentId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  homeownerId: string;
  homeownerName: string;
  partnerId: string | null;
  partnerName: string | null;
  status: ShipmentStatus;
  carrier: Carrier;
  packagesExpected: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  trackingSubmittedAt: string | null;
  addressText: string;
  approximateLocation: { lat: number; lng: number } | null;
  preciseLocation: { lat: number; lng: number } | null;
  dropoffLocation: { lat: number; lng: number } | null;
  homeLocationVisibleToPartner: boolean;
  notes: string;
  preferredReturnTime: string;
  trackingNumber: string | null;
  carrierTrackingUrl: string | null;
  deliveryStatus: DeliveryStatus;
  /** Public CDN URL of the proof-of-delivery photo captured by the porch partner. Null if no photo was captured. */
  completionPhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
