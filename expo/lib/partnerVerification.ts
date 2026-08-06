import { supabase } from '@/lib/supabase';
import { log, error as logError } from '@/lib/logger';
import {
  PartnerVerification,
  PartnerAssignment,
  PartnerPayout,
  PartnerConnection,
} from '@/types';
import {
  DbPartnerVerification,
  DbPartnerAssignment,
  DbPartnerPayout,
  DbPartnerConnection,
} from '@/types/database';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapVerification(db: DbPartnerVerification): PartnerVerification {
  return {
    id: db.id,
    userId: db.user_id,
    idvStatus: db.idv_status,
    idvFailureReason: db.idv_failure_reason,
    idvVerifiedAt: db.idv_verified_at,
    legalFirstName: db.legal_first_name,
    legalLastName: db.legal_last_name,
    payoutStatus: db.payout_status,
    stripeAccountId: db.stripe_account_id,
    tier: db.tier,
    totalAssignments: db.total_assignments,
    completedAssignments: db.completed_assignments,
    lifetimeEarningsCents: db.lifetime_earnings_cents,
    averageRating: db.average_rating,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function mapAssignment(db: DbPartnerAssignment): PartnerAssignment {
  return {
    id: db.id,
    connectionId: db.connection_id,
    homeownerId: db.homeowner_id,
    partnerId: db.partner_id,
    shipmentId: db.shipment_id,
    status: db.status,
    expectedDeliveryDate: db.expected_delivery_date,
    pickupWindowStart: db.pickup_window_start,
    pickupWindowEnd: db.pickup_window_end,
    notes: db.notes,
    agreedRateCents: db.agreed_rate_cents,
    platformFeeCents: db.platform_fee_cents,
    partnerEarnCents: db.partner_earn_cents,
    paymentStatus: db.payment_status,
    pickupConfirmedAt: db.pickup_confirmed_at,
    completionConfirmedAt: db.completion_confirmed_at,
    homeownerRating: db.homeowner_rating,
    homeownerReview: db.homeowner_review,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function mapPayout(db: DbPartnerPayout): PartnerPayout {
  return {
    id: db.id,
    partnerId: db.partner_id,
    assignmentId: db.assignment_id,
    amountCents: db.amount_cents,
    stripeTransferId: db.stripe_transfer_id,
    status: db.status,
    initiatedAt: db.initiated_at,
    paidAt: db.paid_at,
    failureReason: db.failure_reason,
  };
}

function mapConnection(db: DbPartnerConnection): PartnerConnection {
  return {
    id: db.id,
    homeownerId: db.homeowner_id,
    partnerId: db.partner_id,
    status: db.status,
    compensationType: db.compensation_type,
    rateCents: db.rate_cents,
    homeownerNotes: db.homeowner_notes,
    requestedAt: db.requested_at,
    acceptedAt: db.accepted_at,
  };
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

// ─── Verification API ─────────────────────────────────────────────────────────

/** Fetch the current user's verification record. Returns null if not yet created. */
export async function fetchMyVerification(): Promise<PartnerVerification | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('partner_verifications')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    logError('[partnerVerification] fetchMyVerification error');
    return null;
  }
  return data ? mapVerification(data as DbPartnerVerification) : null;
}

/** Fetch verification record for any partner (public tier data only). */
export async function fetchPartnerVerification(
  partnerId: string,
): Promise<Pick<PartnerVerification, 'tier' | 'idvStatus' | 'completedAssignments' | 'averageRating' | 'payoutStatus'> | null> {
  // Reads the safe, non-PII view — the raw partner_verifications table is
  // owner-only, so cross-user trust signals come from partner_public_stats.
  const { data, error } = await supabase
    .from('partner_public_stats')
    .select('tier, idv_status, completed_assignments, average_rating, payout_status')
    .eq('user_id', partnerId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    tier: data.tier,
    idvStatus: data.idv_status,
    completedAssignments: data.completed_assignments,
    averageRating: data.average_rating,
    payoutStatus: data.payout_status,
  };
}

/**
 * Calls the initiate-verification edge function, which creates a Stripe Identity
 * session and returns the hosted verification URL.
 */
export async function initiateVerification(): Promise<{
  sessionId: string;
  verificationUrl: string;
  clientSecret?: string;
  alreadyVerified?: boolean;
} | null> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return null;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/initiate-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ returnUrl: 'porchivo://partner-verify/callback' }),
    });

    const json = await res.json();
    if (!res.ok) {
      logError('[partnerVerification] initiate error: ' + (json?.error ?? res.status));
      return null;
    }
    return json;
  } catch (err) {
    logError('[partnerVerification] initiateVerification fetch error');
    return null;
  }
}

/** Poll the verification status directly from DB (called after returning from Stripe). */
export async function pollVerificationStatus(): Promise<PartnerVerification | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Stripe webhooks may take a few seconds — retry up to 8 times, 1.5s apart
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase
      .from('partner_verifications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const v = mapVerification(data as DbPartnerVerification);
      if (v.idvStatus === 'verified' || v.idvStatus === 'requires_input' || v.idvStatus === 'cancelled') {
        return v;
      }
    }
    await new Promise<void>((r) => setTimeout(r, 1500));
  }

  return fetchMyVerification();
}

// ─── Stripe Connect (payout onboarding) ──────────────────────────────────────

/**
 * Calls the create-connect-account edge function.
 * Returns the hosted Stripe Express onboarding URL.
 */
export async function initiateConnectOnboarding(): Promise<{
  stripeAccountId: string;
  onboardingUrl: string;
  alreadyConnected?: boolean;
} | null> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return null;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/create-connect-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        returnUrl: 'porchivo://partner-verify/connect-return',
        refreshUrl: 'porchivo://partner-verify/connect-refresh',
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      logError('[partnerVerification] initiateConnectOnboarding error: ' + (json?.error ?? res.status));
      return null;
    }
    return json;
  } catch {
    logError('[partnerVerification] initiateConnectOnboarding fetch error');
    return null;
  }
}

/**
 * Poll DB until payout_status becomes 'active' (webhook fired) or timeout.
 * Used after returning from Stripe Connect onboarding.
 */
export async function pollConnectStatus(): Promise<PartnerVerification | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('partner_verifications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const v = mapVerification(data as DbPartnerVerification);
      if (v.payoutStatus === 'active') return v;
    }
    await new Promise<void>((r) => setTimeout(r, 2000));
  }

  return fetchMyVerification();
}

// ─── Assignments API ──────────────────────────────────────────────────────────

/** Fetch all assignments for the current user (as partner or homeowner). */
export async function fetchMyAssignments(role: 'partner' | 'homeowner'): Promise<PartnerAssignment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const column = role === 'partner' ? 'partner_id' : 'homeowner_id';
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('*')
    .eq(column, user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logError('[partnerVerification] fetchMyAssignments error');
    return [];
  }
  return (data as DbPartnerAssignment[]).map(mapAssignment);
}

/**
 * Calls the create-assignment edge function.
 * Homeowner creates a paid hold request for a connected partner.
 */
export async function createAssignment(params: {
  connectionId: string;
  partnerId: string;
  agreedRateCents: number;
  expectedDeliveryDate?: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  notes?: string;
  shipmentId?: string;
}): Promise<{ assignmentId: string; paymentIntentId: string | null } | null> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return null;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/create-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(params),
    });

    const json = await res.json();
    if (!res.ok) {
      logError('[partnerVerification] createAssignment error: ' + (json?.error ?? res.status));
      return null;
    }
    return { assignmentId: json.assignmentId, paymentIntentId: json.paymentIntentId };
  } catch {
    logError('[partnerVerification] createAssignment fetch error');
    return null;
  }
}

/** Partner accepts an incoming hold request. */
export async function acceptAssignment(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_assignments')
    .update({
      status: 'accepted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);

  if (error) { logError('[partnerVerification] acceptAssignment error'); return false; }
  return true;
}

/** Partner declines a hold request. */
export async function declineAssignment(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_assignments')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);

  if (error) { logError('[partnerVerification] declineAssignment error'); return false; }
  return true;
}

/** Partner confirms they picked up the package. */
export async function confirmPickup(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_assignments')
    .update({
      status: 'active',
      pickup_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);

  if (error) { logError('[partnerVerification] confirmPickup error'); return false; }
  return true;
}

/** Homeowner confirms assignment is complete + optional rating. */
export async function completeAssignment(
  assignmentId: string,
  rating?: number,
  review?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('partner_assignments')
    .update({
      status: 'completed',
      completion_confirmed_at: new Date().toISOString(),
      homeowner_rating: rating ?? null,
      homeowner_review: review ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId);

  if (error) { logError('[partnerVerification] completeAssignment error'); return false; }
  return true;
}

/**
 * Homeowner triggers payout for a completed assignment.
 * Calls the partner-payout edge function.
 */
export async function triggerPayout(assignmentId: string): Promise<{
  payoutId: string;
  transferId: string;
  partnerEarnCents: number;
} | null> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return null;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/partner-payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ assignmentId }),
    });

    const json = await res.json();
    if (!res.ok) {
      logError('[partnerVerification] triggerPayout error: ' + (json?.error ?? res.status));
      return null;
    }
    return { payoutId: json.payoutId, transferId: json.transferId, partnerEarnCents: json.partnerEarnCents };
  } catch {
    logError('[partnerVerification] triggerPayout fetch error');
    return null;
  }
}

// ─── Payouts API ──────────────────────────────────────────────────────────────

/** Fetch all payouts for the current partner. */
export async function fetchMyPayouts(): Promise<PartnerPayout[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('partner_payouts')
    .select('*')
    .eq('partner_id', user.id)
    .order('initiated_at', { ascending: false });

  if (error) { logError('[partnerVerification] fetchMyPayouts error'); return []; }
  return (data as DbPartnerPayout[]).map(mapPayout);
}

// ─── Connections API ──────────────────────────────────────────────────────────

/** Fetch all connections where the current user is homeowner. */
export async function fetchMyConnections(): Promise<PartnerConnection[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('partner_connections')
    .select('*')
    .eq('homeowner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { logError('[partnerVerification] fetchMyConnections error'); return []; }
  return (data as DbPartnerConnection[]).map(mapConnection);
}

/** Fetch all connections where the current user is the partner. */
export async function fetchMyPartnerConnections(): Promise<PartnerConnection[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('partner_connections')
    .select('*')
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { logError('[partnerVerification] fetchMyPartnerConnections error'); return []; }
  return (data as DbPartnerConnection[]).map(mapConnection);
}

/**
 * Create or update a connection between homeowner and partner.
 * Called when a homeowner invites a partner.
 */
export async function upsertConnection(params: {
  partnerId: string;
  compensationType: 'free' | 'per_hold' | 'monthly';
  rateCents: number;
  notes?: string;
}): Promise<PartnerConnection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('partner_connections')
    .upsert(
      {
        homeowner_id: user.id,
        partner_id: params.partnerId,
        status: 'pending',
        compensation_type: params.compensationType,
        rate_cents: params.rateCents,
        homeowner_notes: params.notes ?? null,
        requested_at: new Date().toISOString(),
      },
      { onConflict: 'homeowner_id,partner_id' },
    )
    .select()
    .single();

  if (error) { logError('[partnerVerification] upsertConnection error'); return null; }
  return mapConnection(data as DbPartnerConnection);
}

/** Partner accepts a pending connection. */
export async function acceptConnection(connectionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_connections')
    .update({
      status: 'active',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) { logError('[partnerVerification] acceptConnection error'); return false; }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sync the `is_volunteer` flag to the partner_verifications table.
 * Creates a row if one doesn't exist yet (partner hasn't started IDV).
 * RLS allows users to insert/update their own row.
 * Non-fatal — volunteer preference still works locally via ProfileExtension.
 */
export async function syncVolunteerStatus(isVolunteer: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('partner_verifications')
    .upsert(
      {
        user_id: user.id,
        is_volunteer: isVolunteer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    logError('[partnerVerification] syncVolunteerStatus error');
    return;
  }
  log('[partnerVerification] Volunteer status synced:', isVolunteer);
}

/** Format cents as a dollar amount string, e.g. 1250 → "$12.50" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Returns a short human label for an IDV status. */
export function idvStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: 'Not started',
    pending: 'In progress',
    requires_input: 'Action needed',
    verified: 'Verified',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };
  return map[status] ?? status;
}
