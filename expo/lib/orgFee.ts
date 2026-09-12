/**
 * orgFee.ts — shared helpers for the one-time onboarding-fee checkout (MXN MSI).
 *
 * The fee lives on its own Stripe payment-mode Checkout session whose success_url
 * redirects to porchivo://org-signup/success?session_id=…&org_id=…&fee=1.
 * Both the signup success screen (expo/app/org-signup.tsx) and the Billing screen
 * (expo/app/billing.tsx) resume the same persisted URL
 * (organizations.onboarding_checkout_url) and confirm through the same edge
 * function (confirm-org-signup, mode==='payment' branch).
 */

import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

export const FEE_SUCCESS_REDIRECT = 'porchivo://org-signup/success';
export const FEE_CANCEL_REDIRECT = 'porchivo://org-signup/cancelled';

export interface CheckoutRedirect {
  sessionId: string | null;
  orgId: string | null;
  isFee: boolean;
}

/** Parse session_id / org_id / fee from the Stripe redirect URL. */
export function parseCheckoutRedirect(url: string | undefined | null): CheckoutRedirect {
  if (!url) return { sessionId: null, orgId: null, isFee: false };
  try {
    const parsed = new URL(url);
    return {
      sessionId: parsed.searchParams.get('session_id'),
      orgId: parsed.searchParams.get('org_id'),
      isFee: parsed.searchParams.get('fee') === '1',
    };
  } catch {
    // URL constructor may fail on some platforms for custom schemes;
    // fall back to manual parsing.
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return { sessionId: null, orgId: null, isFee: false };
    const params = new URLSearchParams(url.slice(qIndex + 1));
    return {
      sessionId: params.get('session_id'),
      orgId: params.get('org_id'),
      isFee: params.get('fee') === '1',
    };
  }
}

export interface ConfirmFeeResult {
  feePaid: boolean;
  /** True when the confirmation itself failed (e.g. async OXXO/SPEI still processing). */
  isError: boolean;
  message: string | null;
}

/**
 * Confirm the onboarding-fee payment via the confirm-org-signup edge function
 * (payment-mode branch). Idempotent — double confirms just re-mark `paid`.
 */
export async function confirmOnboardingFee(sessionId: string, orgId: string): Promise<ConfirmFeeResult> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke('confirm-org-signup', {
      body: { sessionId, orgId },
    });
    if (fnError) {
      throw new Error(fnError.message ?? 'Failed to verify payment');
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    if (data?.success) {
      log('[OrgFee] Fee confirmed', { feePaid: !!data.feePaid });
      return { feePaid: !!data.feePaid, isError: false, message: null };
    }
    throw new Error(data?.error ?? 'Payment verification failed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not verify your payment.';
    warn('[OrgFee] Fee confirm error:', msg);
    return { feePaid: false, isError: true, message: msg };
  }
}
