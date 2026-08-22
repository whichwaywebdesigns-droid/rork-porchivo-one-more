/**
 * useSubscriptionGate — 3-stage billing grace period for lapsed PROPERTY
 * subscriptions (BILL-01..BILL-11).
 *
 * Porchivo bills the ORGANIZATION (HOA / property manager), not the individual
 * resident — but residents and staff are the ones who feel a cutoff. A payment
 * failure therefore does NOT immediately paywall the property. Instead it
 * starts a 3-stage timeline derived from `organizations.payment_failed_at`
 * (COMPUTED, never stored — there is no grace-period table or workflow):
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Stage 1 — Days 0-14 — status 'past_due' — "silent grace"               │
 * │   Residents: zero change. Staff: zero change.                          │
 * │   Manager: persistent non-blocking billing banner + dunning            │
 * │   notifications (day 0/7/14, manager ONLY — email + push).             │
 * │                                                                       │
 * │ Stage 2 — Days 14-30 — status 'grace_readonly'                        │
 * │   Residents: dashboard/package views stay live, but profile and        │
 * │   notification-preference writes are read-only (soft inline notice,    │
 * │   never a blocker, never alarming language).                          │
 * │   Manager: admin tools (property edits, role management) read-only;    │
 * │   billing screens (BILL-08/09/10) stay fully interactive.              │
 * │                                                                       │
 * │ Stage 3 — Day 30+ — status 'restricted' (BILL-07 behavior)            │
 * │   Full restriction for residents and manager; staff package intake     │
 * │   locks here — the ONLY point where staff FD and PKG intake stops.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ INTENTIONAL EXEMPTION — do not "fix" this as a bug:
 * Staff / front-desk package intake (log-package, package-ops-board — the
 * FD and PKG flows) is deliberately NOT gated on subscription status at any
 * point before day 30. Package intake is the feature driving Porchivo's core
 * value and residents' actual mail, so it stays live through the entire
 * 30-day window regardless of billing state.
 *
 * Resume behavior: the Stripe webhook is the source of truth (BILL-11). When
 * payment succeeds it sets subscription_status='active' and clears
 * payment_failed_at, instantly restoring full access from ANY stage — this
 * hook refetches on app foreground to pick that up. A later failure starts
 * the clock from zero (payment_failed_at is reset on a fresh lapse).
 *
 * Fail-open: if the billing state cannot be read (offline, missing column
 * before migration, RLS hiccup) the gate returns 'ok' — a read error must
 * never lock residents out of the app.
 */
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

/** Day count (from payment_failed_at) at which residents become read-only. */
export const GRACE_READONLY_AFTER_DAYS = 14;

/** Day count (from payment_failed_at) at which full restriction (BILL-07) begins. */
export const RESTRICTED_AFTER_DAYS = 30;

export type BillingStage = 'ok' | 'past_due' | 'grace_readonly' | 'restricted';

interface OrgBillingRow {
  subscription_status: string;
  payment_failed_at: string | null;
}

/** Statuses that mean "no active billing issue" for stage derivation. */
const CLEAR_STATUSES = new Set(['active', 'trialing', 'pending', 'none', 'canceled']);

/** Derive the grace stage from the payment-failure timestamp. */
function deriveStage(
  status: string | null,
  paymentFailedAt: string | null,
): { stage: BillingStage; daysSincePaymentFailure: number | null } {
  if (!paymentFailedAt) {
    // No failure clock running. A server-set 'restricted' (e.g. manual) still applies.
    return { stage: status === 'restricted' ? 'restricted' : 'ok', daysSincePaymentFailure: null };
  }
  // Resume wins: an active status with a lingering timestamp means the webhook
  // already processed payment success — full access is restored.
  if (!status || CLEAR_STATUSES.has(status)) {
    return { stage: 'ok', daysSincePaymentFailure: null };
  }

  const ms = Date.now() - new Date(paymentFailedAt).getTime();
  const days = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;

  if (days < GRACE_READONLY_AFTER_DAYS) {
    return { stage: 'past_due', daysSincePaymentFailure: days };
  }
  if (days < RESTRICTED_AFTER_DAYS) {
    return { stage: 'grace_readonly', daysSincePaymentFailure: days };
  }
  return { stage: 'restricted', daysSincePaymentFailure: days };
}

export interface SubscriptionGate {
  /** Derived billing stage — 'ok' when the property is in good standing. */
  stage: BillingStage;
  /** Whole days since the payment first failed; null when no failure is active. */
  daysSincePaymentFailure: number | null;
  /** True when any grace stage is active (stage 1, 2, or 3). */
  billingIssueActive: boolean;
  /** Stage 1 (day 0-14): silent grace — only the manager sees anything. */
  isSilentGrace: boolean;
  /** Stage 2 (day 14-30): read-only mode for residents and manager admin tools. */
  isGraceReadonly: boolean;
  /** Stage 3 (day 30+): full restriction (BILL-07 paywall behavior). */
  isRestricted: boolean;
  /** Residents cannot change profile / household / notification preferences (stage 2+). */
  isResidentSettingsReadOnly: boolean;
  /** Manager admin tools beyond billing are read-only (stage 2+). Billing stays interactive. */
  isManagerAdminReadOnly: boolean;
  /** Staff package intake lockout — stage 3 ONLY. Deliberately false before day 30. */
  isStaffIntakeLocked: boolean;
  /** Manager should see the persistent billing banner (any active stage). */
  showManagerBillingBanner: boolean;
}

/**
 * Shared subscription-stage gate. Reads the active org's billing state
 * (React Query, ~60s stale) and derives the 3-stage timeline locally.
 * Refetches when the app returns to the foreground so a webhook-confirmed
 * payment restores access instantly.
 */
export function useSubscriptionGate(): SubscriptionGate {
  const { activeOrg, isOrgAdmin } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = activeOrg?.id ?? null;

  const billingQuery = useQuery({
    queryKey: ['org-billing-state', orgId],
    queryFn: async (): Promise<OrgBillingRow | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('subscription_status, payment_failed_at')
        .eq('id', orgId)
        .maybeSingle();
      if (error) {
        // Fail-open: unreadable billing state must never lock members out.
        warn('[SubscriptionGate] billing state fetch error:', error.code);
        return null;
      }
      return (data as OrgBillingRow | null) ?? null;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  });

  // Refetch on foreground → webhook-confirmed resume is picked up immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && orgId) {
        void queryClient.invalidateQueries({ queryKey: ['org-billing-state', orgId] });
      }
    });
    return () => sub.remove();
  }, [orgId, queryClient]);

  // Opportunistic server-side sync of the derived status (keeps the stored
  // subscription_status fresh for non-client consumers). Errors are ignored —
  // the client-side derivation above is authoritative for gating.
  useEffect(() => {
    if (!orgId || !billingQuery.data) return;
    Promise.resolve(supabase.rpc('sync_org_billing_stage'))
      .then(() => log('[SubscriptionGate] stage synced'))
      .catch(() => { /* RPC not deployed yet — non-fatal, gate is client-derived */ });
  }, [orgId, billingQuery.data]);

  return useMemo<SubscriptionGate>(() => {
    const row = billingQuery.data;
    const { stage, daysSincePaymentFailure } = deriveStage(
      row?.subscription_status ?? null,
      row?.payment_failed_at ?? null,
    );

    const stage2Plus = stage === 'grace_readonly' || stage === 'restricted';

    return {
      stage,
      daysSincePaymentFailure,
      billingIssueActive: stage !== 'ok',
      isSilentGrace: stage === 'past_due',
      isGraceReadonly: stage === 'grace_readonly',
      isRestricted: stage === 'restricted',
      isResidentSettingsReadOnly: stage2Plus,
      isManagerAdminReadOnly: stage2Plus,
      // Stage 3 ONLY — staff intake stays open through the whole 30-day window.
      isStaffIntakeLocked: stage === 'restricted',
      showManagerBillingBanner: isOrgAdmin && stage !== 'ok',
    };
  }, [billingQuery.data, isOrgAdmin]);
}
