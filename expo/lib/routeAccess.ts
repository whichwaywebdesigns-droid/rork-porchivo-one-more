/**
 * Route Access Table — single source of truth for subscription gating.
 *
 * Access levels
 * ─────────────
 * free          — Always accessible. No paywall can fire on entry or from
 *                 tab switches, back presses, or screen mount effects.
 *
 * premium-entry — Screen is reachable but specific actions inside are gated.
 *                 Free users see the screen content; a paywall fires only
 *                 when they tap a premium action (via guardPremiumAccess).
 *                 Never redirect on entry alone.
 *
 * premium-only  — Full screen requires a subscription. Call guardPremiumAccess
 *                 before navigating (from the tap handler, not from a
 *                 useEffect or focus listener). If the user is not entitled,
 *                 the guard opens the paywall; the navigation never completes.
 *
 * Usage
 * ─────
 * import { ROUTE_ACCESS } from '@/lib/routeAccess';
 *
 * // In a tap handler (NOT in useEffect/useFocusEffect):
 * guardPremiumAccess({
 *   trigger: 'ups_amazon',
 *   feature: 'UPS & Amazon Hub',
 *   action: () => router.push('/ups-amazon/hub'),
 * });
 *
 * Rules
 * ─────
 * • NEVER redirect from useEffect, useFocusEffect, or onMount.
 * • NEVER check subscription state in tab switch handlers.
 * • The only exception is the Day-7 hard paywall, which is managed exclusively
 *   by PaywallContext (never from a screen-level effect).
 */

export type RouteAccess = 'free' | 'premium-entry' | 'premium-only';

/**
 * Maps Expo Router segment names to their access level.
 * Segment = the folder/file name without the leading slash.
 */
export const ROUTE_ACCESS: Record<string, RouteAccess> = {
  // ── Auth & onboarding — never gated ───────────────────────────────────
  welcome: 'free',
  intro: 'free',
  login: 'free',
  'role-selection': 'free',
  'post-signup': 'free',
  'onboarding-setup': 'free',
  'location-consent': 'free',
  'notifications-permission': 'free',
  'partner-onboarding': 'free',
  'partner-payout-setup': 'free',
  'partner-verify': 'free',

  // ── Core tabs — always free ────────────────────────────────────────────
  '(home)': 'free',
  packages: 'free',
  create: 'free',
  activity: 'free',
  profile: 'free',

  // ── Free utility screens ───────────────────────────────────────────────
  settings: 'free',
  notifications: 'free',
  alerts: 'free',
  'alert-detail': 'free',
  'add-package': 'free',
  'package-detail': 'free',
  'shipment-detail': 'free',
  'edit-profile': 'free',
  'partner-detail': 'free',
  partners: 'free',
  referral: 'free',
  'privacy-policy': 'free',
  'terms-of-service': 'free',
  'community-guidelines': 'free',
  'org-vendors': 'free',
  'org-branding': 'free',
  'org-documents': 'free',
  'amenity-reservations': 'free',
  'org-ledger': 'free',
  'contact-support': 'free',
  'support-ticket-detail': 'free',
  billing: 'free',
  'admin-funnel': 'free',
  'porch-risk': 'free', // viewable; Theft Shield toggle inside is gated
  'safe-dropoff': 'free',
  chat: 'free',
  map: 'free',

  // ── Premium-entry: screen reachable, actions inside are gated ─────────
  // Tap handlers inside these screens should call guardPremiumAccess()
  // for the specific premium action — never redirect on screen entry.
  neighborhood: 'premium-entry',
  'safety-score': 'premium-entry',
  'my-assignments': 'premium-entry',
  'partner-earnings': 'premium-entry',

  // ── Premium-only: guard before navigating (at the tap handler) ─────────
  // Do NOT navigate to these routes for free users.
  // Use: guardPremiumAccess({ trigger, action: () => router.push('/route') })
  'ups-amazon': 'premium-only',
  invoices: 'premium-only',
  'delivery-windows': 'premium-only',
  'network-map': 'premium-only',
  'partner-holds': 'premium-only',
  'create-assignment': 'premium-only',
  drivers: 'premium-only',
};

/**
 * Returns the access level for a given route segment.
 * Defaults to 'free' for any route not in the table.
 */
export function getRouteAccess(segment: string): RouteAccess {
  return ROUTE_ACCESS[segment] ?? 'free';
}

/**
 * Returns true if the route requires a premium subscription.
 */
export function isPremiumRoute(segment: string): boolean {
  const access = getRouteAccess(segment);
  return access === 'premium-only' || access === 'premium-entry';
}
