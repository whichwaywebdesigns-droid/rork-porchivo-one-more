export interface DbProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  role: 'homeowner' | 'partner' | 'both';
  address: string;
  has_location_consent: boolean;
  has_precise_location_consent: boolean;
  expo_push_token: string | null;
  is_premium: boolean;
  /** Backend-confirmed subscription tier. Written only by revenuecat-webhook. */
  subscription_tier: 'free' | 'premium' | 'family' | 'enterprise' | 'lifetime';
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Append-only, versioned record of a user's acceptance of the Terms of
 * Service + Privacy Policy. Written by the client at signup and on forced
 * re-acceptance; never updated or deleted (immutable audit trail).
 */
export interface DbUserConsent {
  id: string;
  user_id: string;
  /** Legal version accepted — matches LEGAL_VERSION in constants/legal.ts. */
  version: string;
  documents: string[];
  platform: string | null;
  app_version: string | null;
  accepted_at: string;
}

export interface DbShipment {
  id: string;
  homeowner_id: string;
  homeowner_name: string;
  partner_id: string | null;
  partner_name: string | null;
  status: 'open' | 'accepted' | 'completed' | 'cancelled';
  carrier: 'Amazon' | 'UPS' | 'USPS' | 'FedEx' | 'Other';
  packages_expected: string;
  delivery_window_start: string;
  delivery_window_end: string;
  tracking_submitted_at: string | null;
  address_text: string;
  approximate_lat: number | null;
  approximate_lng: number | null;
  precise_lat: number | null;
  precise_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  home_location_visible_to_partner: boolean;
  notes: string;
  preferred_return_time: string;
  tracking_number: string | null;
  carrier_tracking_url: string | null;
  delivery_status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delivered_to_homeowner';
  completion_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  shipment_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  text: string;
  image_url: string | null;
  created_at: string;
}

export type IdvStatus = 'not_started' | 'pending' | 'requires_input' | 'verified' | 'cancelled' | 'failed';
export type PayoutStatus = 'not_connected' | 'pending' | 'active' | 'disabled';
export type PartnerTier = 'basic' | 'verified' | 'trusted' | 'elite';
export type ConnectionStatus = 'pending' | 'active' | 'paused' | 'removed';
export type CompensationType = 'free' | 'per_hold' | 'monthly';
export type AssignmentStatus = 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled' | 'disputed';
export type AssignmentPaymentStatus = 'unpaid' | 'authorized' | 'captured' | 'refunded' | 'failed';
export type PayoutRecordStatus = 'pending' | 'in_transit' | 'paid' | 'failed' | 'cancelled';

/** Lifecycle status of a RevenueCat-managed subscription. */
export type SubscriptionStatus =
  | 'active'          // entitled, renewing or promotional
  | 'cancelled'       // user cancelled; entitled until current_period_end
  | 'expired'         // period ended; access revoked
  | 'billing_issue'   // payment failed; in grace period
  | 'paused'          // Google Play paused subscription
  | 'grace_period';   // brief window after billing failure

/**
 * Single-row authoritative entitlement record per user.
 * Written only by the revenuecat-webhook Edge Function.
 * Clients SELECT their own row via RLS; no client writes.
 */
export interface DbUserSubscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  /** Resolved Porchivo tier — matches SubscriptionTier in lib/tiers.ts */
  tier: 'free' | 'premium' | 'family' | 'enterprise' | 'lifetime';
  product_id: string | null;
  store: string | null;
  environment: 'SANDBOX' | 'PRODUCTION' | string | null;
  /** ISO timestamp of when the current paid period ends. Null for lifetime. */
  current_period_end: string | null;
  /** ISO timestamp of when the user requested cancellation. Null if not cancelled. */
  cancelled_at: string | null;
  /** True for porchivo_lifetime — these never expire. */
  is_lifetime: boolean;
  /**
   * Derived entitlement flag.
   * True for: active, cancelled (in-period), billing_issue, grace_period.
   * False for: expired, paused.
   * Always prefer this over inferring from status + dates in the client.
   */
  is_entitled: boolean;
  /** The RC event type that last mutated this row (for debugging). */
  last_event_type: string | null;
  /** The RC event UUID that last mutated this row (for debugging). */
  last_rc_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Combined entitlement view joining profiles + user_subscriptions.
 * Query public.user_entitlement for the complete billing picture in one read.
 */
export interface DbUserEntitlement {
  user_id: string;
  is_premium: boolean;
  subscription_tier: 'free' | 'premium' | 'family' | 'enterprise' | 'lifetime';
  subscription_status: SubscriptionStatus | null;
  subscription_tier_detail: 'free' | 'premium' | 'family' | 'enterprise' | 'lifetime' | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  is_lifetime: boolean | null;
  is_entitled: boolean | null;
  environment: string | null;
  store: string | null;
  last_event_type: string | null;
  subscription_updated_at: string | null;
}

export interface DbPartnerVerification {
  id: string;
  user_id: string;
  idv_provider: 'stripe' | 'persona';
  idv_session_id: string | null;
  idv_report_id: string | null;
  idv_status: IdvStatus;
  idv_failure_reason: string | null;
  idv_verified_at: string | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  dob: string | null;
  id_country: string | null;
  id_type: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_url: string | null;
  payout_status: PayoutStatus;
  tier: PartnerTier;
  total_assignments: number;
  completed_assignments: number;
  lifetime_earnings_cents: number;
  average_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbPartnerConnection {
  id: string;
  homeowner_id: string;
  partner_id: string;
  status: ConnectionStatus;
  compensation_type: CompensationType;
  rate_cents: number;
  homeowner_notes: string | null;
  requested_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPartnerAssignment {
  id: string;
  connection_id: string;
  homeowner_id: string;
  partner_id: string;
  shipment_id: string | null;
  status: AssignmentStatus;
  expected_delivery_date: string | null;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  notes: string | null;
  agreed_rate_cents: number;
  platform_fee_cents: number;
  partner_earn_cents: number;
  payment_intent_id: string | null;
  payment_status: AssignmentPaymentStatus;
  pickup_confirmed_at: string | null;
  completion_confirmed_at: string | null;
  homeowner_rating: number | null;
  homeowner_review: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPartnerPayout {
  id: string;
  partner_id: string;
  assignment_id: string | null;
  amount_cents: number;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  status: PayoutRecordStatus;
  initiated_at: string;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

/**
 * Append-only audit log of every RevenueCat lifecycle event received by the
 * revenuecat-webhook Edge Function. Used for idempotent deduplication via a
 * unique index on rc_event_id. Only the service role can read/write this
 * table; clients have zero access (RLS enabled with no permissive policies).
 */
export interface DbRevenueCatEvent {
  id: string;
  /** Stable RevenueCat event UUID — drives ON CONFLICT DO NOTHING dedup. */
  rc_event_id: string;
  /** event.app_user_id (the Supabase user UUID, or an RC anonymous id pre-signup). */
  user_id: string;
  /** Lifecycle event type: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc. */
  event_type: string;
  /** event.product_id, or null for events that don't carry a product. */
  product_id: string | null;
  /** Originating store: APP_STORE, PLAY_STORE, STRIPE, etc. */
  store: string | null;
  /** SANDBOX | PRODUCTION. */
  environment: string | null;
  /** event.expiration_at_ms (unix milliseconds), or null. */
  expiration_at_ms: number | null;
  /** Full event object, kept for post-incident debugging. JSONB column. */
  raw_payload: Record<string, unknown> | null;
  processed_at: string;
  created_at: string;
}

export interface DbNotification {
  id: string;
  shipment_id: string;
  type: 'tracking_added' | 'package_delivered' | 'partner_pickup_alert' | 'partner_completed' | 'package_out_for_delivery' | 'package_picked_up';
  title: string;
  message: string;
  recipient_id: string;
  recipient_role: 'homeowner' | 'partner';
  read: boolean;
  created_at: string;
}

/** Lifecycle status of a support ticket. */
export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_user'
  | 'resolved'
  | 'closed';

/** Coarse priority used by staff to triage the support queue. */
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Support ticket categories matching lib/supportTickets.ts. */
export type SupportTicketCategory =
  | 'delivery_issue'
  | 'payment_billing'
  | 'account_access'
  | 'partner_dispute'
  | 'app_bug'
  | 'feature_request'
  | 'safety_alert'
  | 'other';

/**
 * A support ticket row from `public.support_tickets`.
 *
 * RLS: users can SELECT/UPDATE only their own rows; staff with
 * `app_metadata.role = 'support_staff'` can read all tickets and update
 * any ticket. The `ai_draft_*` columns are STAFF-ONLY — column-level
 * grants revoke SELECT on them from `authenticated`, so a user's `select *`
 * never sees the draft. They are typed here for completeness and for use by
 * staff tooling that authenticates with the service role.
 */
export interface DbSupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  staff_reply: string | null;
  staff_replied_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  attachment_url: string | null;
  app_version: string | null;
  platform: string | null;
  device_model: string | null;
  /**
   * AI-drafted staff reply generated by the support-ticket-ai-draft Edge
   * Function. STAFF-ONLY — never sent to the client via RLS column grants.
   * Staff review/edit, then promote to `staff_reply`.
   */
  ai_draft_reply: string | null;
  ai_draft_generated_at: string | null;
  ai_draft_model: string | null;
  /** 'accepted' | 'edited' | 'rejected' — staff feedback on the draft. */
  ai_draft_feedback: 'accepted' | 'edited' | 'rejected' | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row shape returned by the `get_staff_support_queue` RPC. Identical to
 * DbSupportTicket but every column is a plain primitive (no enum literal
 * narrowing) because the RPC returns TEXT casts of the enum columns. Cast
 * back to the union types in the client mapper.
 */
export interface StaffSupportQueueRow {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  staff_reply: string | null;
  staff_replied_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  attachment_url: string | null;
  app_version: string | null;
  platform: string | null;
  device_model: string | null;
  ai_draft_reply: string | null;
  ai_draft_generated_at: string | null;
  ai_draft_model: string | null;
  ai_draft_feedback: 'accepted' | 'edited' | 'rejected' | null;
  created_at: string;
  updated_at: string;
}

/** Per-status counts returned by `get_staff_support_queue_counts`. */
export interface StaffSupportQueueCountRow {
  status: SupportTicketStatus;
  status_count: number;
  with_draft: number;
  awaiting_review: number;
}

/**
 * Row shape for `public.support_reply_templates` — staff-only shared library
 * of pre-written replies for common property-management queries. RLS gates
 * all access to support_staff / super_admin.
 */
export interface DbSupportReplyTemplate {
  id: string;
  label: string;
  body: string;
  category: SupportTicketCategory | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
