/**
 * PaywallContext — Neutralized for HOA-provisioned model.
 *
 * All users have full access provisioned by their HOA or property manager.
 * guardPremiumAccess() always grants — it runs the action immediately.
 * No paywall, no Superwall, no upgrade screen is ever shown.
 */
import React, { useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { log } from '@/lib/logger';

export interface GuardOptions {
  trigger: string;
  action?: () => void;
  feature?: string;
}

export const [PaywallProvider, usePaywall] = createContextHook(() => {
  /** Always grants access — HOA-provisioned model. */
  const guardPremiumAccess = useCallback(
    (options: GuardOptions): void => {
      log('[Paywall] guardPremiumAccess — GRANTED (HOA-provisioned model), feature:', options.feature ?? options.trigger);
      options.action?.();
    },
    [],
  );

  /** No-op — never called in HOA model, but kept for interface compatibility. */
  const onPaywallSuccess = useCallback((): (() => void) | null => {
    return null;
  }, []);

  /** No-op — never called in HOA model. */
  const onPaywallDismiss = useCallback((): void => {}, []);

  return useMemo(
    () => ({
      isPaywallOpen: false,
      guardPremiumAccess,
      onPaywallSuccess,
      onPaywallDismiss,
    }),
    [guardPremiumAccess, onPaywallSuccess, onPaywallDismiss],
  );
});
