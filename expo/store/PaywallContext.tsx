/**
 * PaywallContext — Centralized premium access guard for Porchivo.
 *
 * Architecture
 * ────────────
 * All premium gating flows through a single function: guardPremiumAccess().
 * No screen should call router.push('/upgrade') directly. No paywall should
 * open from a tab switch, back press, screen mount, or focus effect.
 *
 * Flow
 * ────
 * 1. Feature tap → guardPremiumAccess({ trigger, action })
 * 2a. Entitled → run action immediately, done.
 * 2b. Not entitled + paywall already open → deduplicate, done.
 * 2c. Not entitled → save pending action, open Superwall or fall back to
 *     /upgrade modal. Set isPaywallOpen = true.
 * 3. User dismisses → onPaywallDismiss() clears state, router.back().
 * 4. User purchases  → onPaywallSuccess() runs pending action, router.back().
 *
 * Day-7 hard paywall
 * ──────────────────
 * Owned entirely by this context. A module-level flag (day7SessionShown)
 * prevents re-firing across tab switches and screen re-mounts within a
 * session. The useEffect dependency on isEntitled means if the user
 * purchases on the paywall screen, the flag resets naturally for future
 * sessions.
 *
 * Debug logging
 * ─────────────
 * Every decision point emits a [Paywall] log with its outcome so that
 * redirect sources and duplicate-open bugs are immediately visible.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useRouter } from 'expo-router';
import { log } from '@/lib/logger';
import { useApp } from '@/store/AppContext';
import { PaywallTrigger } from '@/lib/tiers';
import { openPaywall } from '@/lib/superwall';
import { PAYWALL_TIMING } from '@/config/app';

// ── Public types ──────────────────────────────────────────────────────────

export interface GuardOptions {
  /** Which premium feature triggered the access request */
  trigger: PaywallTrigger;
  /**
   * Optional action to resume after a successful upgrade.
   * • If user is already entitled: called immediately.
   * • If user upgrades:           called after router.back() + 200 ms.
   * • If user dismisses:          discarded.
   *
   * Prefer navigation actions (router.push) here; the 200 ms delay lets
   * the back-transition finish before pushing the premium screen.
   */
  action?: () => void;
  /** Human-readable feature name — shown only in debug logs */
  feature?: string;
}

// ── Module-level session flags ─────────────────────────────────────────────
// Survive tab switches and component re-mounts within a single app session.

/** True once the Day-7 hard paywall has been presented this session. */
let day7SessionShown = false;

// ── Context ───────────────────────────────────────────────────────────────

export const [PaywallProvider, usePaywall] = createContextHook(() => {
  const router = useRouter();
  const { isEntitled, isEntitlementLoading, isDay7HardPaywall, session } = useApp();

  /** True while a paywall (Superwall or /upgrade screen) is open. Used for
   *  deduplication — no second paywall can open while one is already showing. */
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);

  /**
   * Ref (not state) so mutations don't trigger re-renders.
   * Cleared on success, dismiss, or feature-grant.
   */
  const pendingActionRef = useRef<(() => void) | null>(null);
  const day7TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Day-7 hard paywall ─────────────────────────────────────────────────
  useEffect(() => {
    // Wait for authoritative entitlement before deciding
    if (isEntitlementLoading) return;
    // No active session — never show paywall to logged-out users
    if (!session?.user?.id) return;
    // User is entitled — nothing to do
    if (isEntitled) return;
    // Day-7 threshold not yet reached
    if (!isDay7HardPaywall) return;
    // Already shown this session — no duplicates
    if (day7SessionShown) return;
    // Another paywall is already open — do not stack
    if (isPaywallOpen) return;

    day7SessionShown = true;
    log('[Paywall] Day-7 condition met — scheduling hard paywall in', PAYWALL_TIMING.day7DelayMs, 'ms');

    day7TimerRef.current = setTimeout(() => {
      log('[Paywall] Day-7 hard paywall OPENING');
      setIsPaywallOpen(true);
      router.push('/upgrade?trigger=day7_hard' as any);
    }, PAYWALL_TIMING.day7DelayMs);

    return () => {
      if (day7TimerRef.current) {
        clearTimeout(day7TimerRef.current);
        day7TimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntitlementLoading, isEntitled, isDay7HardPaywall, session?.user?.id]);

  // ── Core guard ────────────────────────────────────────────────────────

  /**
   * guardPremiumAccess — the single entry-point for all premium feature gates.
   *
   * Never call router.push('/upgrade') from a screen directly.
   * Always go through this function so that:
   *   • deduplication is enforced
   *   • the pending action is saved and resumed on purchase
   *   • debug logs capture every decision
   */
  const guardPremiumAccess = useCallback(
    (options: GuardOptions): void => {
      const { trigger, action, feature = trigger } = options;

      log(
        '[Paywall] guardPremiumAccess — feature:', feature,
        '| trigger:', trigger,
        '| entitled:', isEntitled,
        '| paywallOpen:', isPaywallOpen,
      );

      // ── Fast path: already entitled ─────────────────────────────────────
      if (isEntitled) {
        log('[Paywall] GRANTED — user is entitled, running action');
        action?.();
        return;
      }

      // ── Deduplication: paywall already showing ──────────────────────────
      if (isPaywallOpen) {
        log('[Paywall] DEDUPLICATED — paywall already open, ignoring request for:', feature);
        return;
      }

      // ── Block + open paywall ────────────────────────────────────────────
      log('[Paywall] BLOCKED — saving pending action, opening paywall for trigger:', trigger);
      pendingActionRef.current = action ?? null;
      setIsPaywallOpen(true);

      // Try Superwall first. On any failure (unavailable, unconfigured, throw),
      // openPaywall calls onError without self-routing, so we control routing here.
      void openPaywall({
        placement: trigger,
        onFeature: () => {
          // Superwall granted access without showing a paywall (e.g. user is
          // already entitled in Superwall's eyes).
          log('[Paywall] Feature granted by Superwall — running pending action');
          const pending = pendingActionRef.current;
          pendingActionRef.current = null;
          setIsPaywallOpen(false);
          pending?.();
        },
        onDismiss: () => {
          log('[Paywall] Superwall dismissed — clearing paywall state');
          pendingActionRef.current = null;
          setIsPaywallOpen(false);
        },
        onError: () => {
          // Superwall unavailable or threw — fall back to in-app /upgrade.
          // isPaywallOpen stays true; the upgrade screen will call
          // onPaywallDismiss() or onPaywallSuccess() when it resolves.
          log('[Paywall] Superwall fallback — routing to /upgrade, trigger:', trigger);
          router.push(`/upgrade?trigger=${encodeURIComponent(trigger)}` as any);
        },
      });
    },
    [isEntitled, isPaywallOpen, router],
  );

  // ── Upgrade screen callbacks ──────────────────────────────────────────

  /**
   * Called by the /upgrade screen after a successful purchase.
   * Returns the pending action (if any) so the caller can run it
   * after the back-transition animation completes.
   *
   * Usage in upgrade screen:
   *   const resume = onPaywallSuccess();
   *   router.back();
   *   if (resume) setTimeout(resume, 200);
   */
  const onPaywallSuccess = useCallback((): (() => void) | null => {
    log('[Paywall] onPaywallSuccess — clearing state, returning pending action');
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsPaywallOpen(false);
    return pending;
  }, []);

  /**
   * Called by the /upgrade screen when the user dismisses without purchasing.
   * Must be followed by router.back() in the calling screen.
   */
  const onPaywallDismiss = useCallback((): void => {
    log('[Paywall] onPaywallDismiss — clearing pending action and paywall state');
    pendingActionRef.current = null;
    setIsPaywallOpen(false);
  }, []);

  return useMemo(
    () => ({
      isPaywallOpen,
      guardPremiumAccess,
      onPaywallSuccess,
      onPaywallDismiss,
    }),
    [isPaywallOpen, guardPremiumAccess, onPaywallSuccess, onPaywallDismiss],
  );
});
