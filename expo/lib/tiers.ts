/**
 * Subscription tiers, plan definitions, and capability gating.
 *
 * ── WHERE TO CHANGE PRICES ────────────────────────────────────────────────
 *  Edit config/app.ts → PRICING section.
 *  That file has plain-English comments explaining every value.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  PRICING,
  FREE_LIMITS,
  PAYWALL_TIMING,
  POLLING,
  FAMILY_PLAN,
  ENTERPRISE_PLAN,
  PAYWALL_ROUTING,
} from '@/config/app';
import type { PorchivoRole } from '@/store/OnboardingFlowContext';

export type SubscriptionTier = 'free' | 'premium' | 'family' | 'enterprise' | 'lifetime';
export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

export interface Plan {
  id: string;
  tier: SubscriptionTier;
  period: BillingPeriod;
  priceLabel: string;
  priceSubLabel: string;
  pricePerMonthLabel?: string;
  entitlementId: string;
  hasFreeTrial?: boolean;
  trialDays?: number;
  savingsLabel?: string;
}

export const ENTITLEMENTS = {
  premium: 'premium',
  family: 'family_household',
  enterprise: 'enterprise_hoa',
  lifetime: 'lifetime',
  removeAds: 'remove_ads',
} as const;

// Only real lifetime product id is `porchivo_lifetime` (config/app.ts PRICING.lifetime.productId).
// The bare 'lifetime' string previously listed here matched no real product in RevenueCat
// or the stores and was a trap if someone created a product literally named 'lifetime'.
export const LIFETIME_PRODUCT_IDS: string[] = ['porchivo_lifetime'];

export function isLifetimeProductId(productId: string | undefined | null): boolean {
  if (!productId) return false;
  return LIFETIME_PRODUCT_IDS.includes(productId);
}

// ── Limits & timing — sourced from config/app.ts ──────────────────────────
// To change these values, edit config/app.ts (Section 2 & 3).

/** Max packages a free user can track at once */
export const FREE_PACKAGE_LIMIT = FREE_LIMITS.maxPackages;

/** Max shared recipients on a package for free users */
export const FREE_SHARED_RECIPIENTS = FREE_LIMITS.sharedRecipients;

/** Max household members on a Family plan */
export const FAMILY_MAX_MEMBERS = FAMILY_PLAN.maxMembers;

/** Max households covered under an Enterprise/HOA plan */
export const ENTERPRISE_MAX_HOUSEHOLDS = ENTERPRISE_PLAN.maxHouseholds;

/** How often premium users' data refreshes (ms) */
export const PREMIUM_POLL_INTERVAL_MS = POLLING.premiumIntervalMs;

/** How often free users' data refreshes (ms) */
export const FREE_POLL_INTERVAL_MS = POLLING.freeIntervalMs;

/** After this many ms from install, free users see a hard paywall */
export const DAY7_HARD_PAYWALL_MS = PAYWALL_TIMING.day7HardPaywallDays * 24 * 60 * 60 * 1000;

/** Days of free premium granted to a referred user */
export const REFERRAL_CREDIT_DAYS = PAYWALL_TIMING.referralCreditDays;

/** Win-back offer display text */
export const DISCOUNT_WINBACK_LABEL = PRICING.winback.label;
export const DISCOUNT_WINBACK_PRICE = PRICING.winback.displayPrice;

// ── Plan definitions — prices sourced from config/app.ts ─────────────────

export const PLANS: Plan[] = [
  {
    id: PRICING.monthly.productId,
    tier: 'premium',
    period: 'monthly',
    priceLabel: PRICING.monthly.displayPrice,
    priceSubLabel: 'per month',
    pricePerMonthLabel: PRICING.monthly.perMonthLabel,
    entitlementId: ENTITLEMENTS.premium,
    hasFreeTrial: PRICING.monthly.trialDays > 0,
    trialDays: PRICING.monthly.trialDays,
  },
  {
    id: PRICING.annual.productId,
    tier: 'premium',
    period: 'annual',
    priceLabel: PRICING.annual.displayPrice,
    priceSubLabel: 'per year',
    pricePerMonthLabel: PRICING.annual.perMonthLabel,
    entitlementId: ENTITLEMENTS.premium,
    hasFreeTrial: PRICING.annual.trialDays > 0,
    trialDays: PRICING.annual.trialDays,
    savingsLabel: PRICING.annual.savingsLabel,
  },
  {
    id: FAMILY_PLAN.monthly.productId,
    tier: 'family',
    period: 'monthly',
    priceLabel: FAMILY_PLAN.monthly.displayPrice,
    priceSubLabel: 'per month',
    pricePerMonthLabel: FAMILY_PLAN.monthly.perMonthLabel,
    entitlementId: ENTITLEMENTS.family,
  },
  {
    id: FAMILY_PLAN.annual.productId,
    tier: 'family',
    period: 'annual',
    priceLabel: FAMILY_PLAN.annual.displayPrice,
    priceSubLabel: 'per year',
    pricePerMonthLabel: FAMILY_PLAN.annual.perMonthLabel,
    entitlementId: ENTITLEMENTS.family,
    hasFreeTrial: FAMILY_PLAN.annual.trialDays > 0,
    trialDays: FAMILY_PLAN.annual.trialDays,
    savingsLabel: FAMILY_PLAN.annual.savingsLabel,
  },
  {
    id: ENTERPRISE_PLAN.monthly.productId,
    tier: 'enterprise',
    period: 'monthly',
    priceLabel: ENTERPRISE_PLAN.monthly.displayPrice,
    priceSubLabel: 'per month · up to 250 homes',
    pricePerMonthLabel: ENTERPRISE_PLAN.monthly.perMonthLabel,
    entitlementId: ENTITLEMENTS.enterprise,
  },
  {
    id: ENTERPRISE_PLAN.annual.productId,
    tier: 'enterprise',
    period: 'annual',
    priceLabel: ENTERPRISE_PLAN.annual.displayPrice,
    priceSubLabel: 'per year · up to 250 homes',
    pricePerMonthLabel: ENTERPRISE_PLAN.annual.perMonthLabel,
    entitlementId: ENTITLEMENTS.enterprise,
    hasFreeTrial: ENTERPRISE_PLAN.annual.trialDays > 0,
    trialDays: ENTERPRISE_PLAN.annual.trialDays,
    savingsLabel: ENTERPRISE_PLAN.annual.savingsLabel,
  },
  {
    id: PRICING.lifetime.productId,
    tier: 'lifetime',
    period: 'lifetime',
    priceLabel: PRICING.lifetime.displayPrice,
    priceSubLabel: 'one-time',
    entitlementId: ENTITLEMENTS.lifetime,
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

// ── Role-based onboarding paywall routing ────────────────────────
// Maps the onboarding role to the tier whose plans we surface on the first
// paywall. Mapping lives in config/app.ts (Section 11) so the founder can tweak
// who sees what without touching screen code.

/** The set of plans shown on the onboarding paywall for a given role. */
export interface OnboardingPlanSet {
  tier: SubscriptionTier;
  annual: Plan;
  monthly: Plan;
  /** Which card reads as primary. Annual is always the push. */
  emphasized: 'annual' | 'monthly';
}

/** Resolve which tier a role should be routed to on the onboarding paywall. */
export function tierForRole(role: PorchivoRole | null): SubscriptionTier {
  if (!role) return 'premium';
  const mapped = PAYWALL_ROUTING[role] as SubscriptionTier | undefined;
  return mapped ?? 'premium';
}

/**
 * Returns the annual + monthly plan pair for the tier a role is routed to.
 * Falls back to individual Premium if the routed tier is missing a plan pair.
 */
export function onboardingPlansForRole(role: PorchivoRole | null): OnboardingPlanSet {
  const tier = tierForRole(role);
  const annual = PLANS.find((p) => p.tier === tier && p.period === 'annual');
  const monthly = PLANS.find((p) => p.tier === tier && p.period === 'monthly');
  if (annual && monthly) {
    return { tier, annual, monthly, emphasized: 'annual' };
  }
  // Defensive fallback — should never hit, but keeps the paywall renderable.
  const premiumAnnual = PLANS.find((p) => p.tier === 'premium' && p.period === 'annual')!;
  const premiumMonthly = PLANS.find((p) => p.tier === 'premium' && p.period === 'monthly')!;
  return { tier: 'premium', annual: premiumAnnual, monthly: premiumMonthly, emphasized: 'annual' };
}

// ── Tier capability matrix ────────────────────────────────────────────────
// Controls what each subscription tier can access.
// To add/remove a feature from premium, edit the 'premium' case below.

export interface TierCapabilities {
  isAdFree: boolean;
  unlimitedPackages: boolean;
  fastPolling: boolean;
  outForDeliveryAlerts: boolean;
  customChimes: boolean;
  liveActivities: boolean;
  theftShield: boolean;
  householdSharing: boolean;
  maxMembers: number;
  prioritySupport: boolean;
  porchPartnerAccess: boolean;
  taxInvoicing: boolean;
  communityDashboard: boolean;
  maxHouseholds: number;
  /** WhichWay Trust Engine — Enterprise only (Scenario B gating) */
  trustEngine: boolean;
}

export function capabilitiesForTier(tier: SubscriptionTier): TierCapabilities {
  switch (tier) {
    case 'enterprise':
      return {
        isAdFree: true,
        unlimitedPackages: true,
        fastPolling: true,
        outForDeliveryAlerts: true,
        customChimes: true,
        liveActivities: true,
        theftShield: true,
        householdSharing: true,
        maxMembers: ENTERPRISE_MAX_HOUSEHOLDS * 5,
        prioritySupport: true,
        porchPartnerAccess: true,
        taxInvoicing: true,
        communityDashboard: true,
        maxHouseholds: ENTERPRISE_MAX_HOUSEHOLDS,
        trustEngine: true,
      };
    case 'lifetime':
    case 'family':
      return {
        isAdFree: true,
        unlimitedPackages: true,
        fastPolling: true,
        outForDeliveryAlerts: true,
        customChimes: true,
        liveActivities: true,
        theftShield: true,
        householdSharing: tier === 'family',
        maxMembers: tier === 'family' ? FAMILY_MAX_MEMBERS : 1,
        prioritySupport: true,
        porchPartnerAccess: true,
        taxInvoicing: true,
        communityDashboard: false,
        maxHouseholds: 1,
        trustEngine: false,
      };
    case 'premium':
      return {
        isAdFree: true,
        unlimitedPackages: true,
        fastPolling: true,
        outForDeliveryAlerts: true,
        customChimes: true,
        liveActivities: true,
        theftShield: true,
        householdSharing: false,
        maxMembers: 1,
        prioritySupport: false,
        porchPartnerAccess: true,
        taxInvoicing: true,
        communityDashboard: false,
        maxHouseholds: 0,
        trustEngine: false,
      };
    default:
      return {
        isAdFree: false,
        unlimitedPackages: false,
        fastPolling: false,
        outForDeliveryAlerts: false,
        customChimes: false,
        liveActivities: false,
        theftShield: false,
        householdSharing: false,
        maxMembers: 1,
        prioritySupport: false,
        porchPartnerAccess: false,
        taxInvoicing: false,
        communityDashboard: false,
        maxHouseholds: 0,
        trustEngine: false,
      };
  }
}

export const PAYWALL_TRIGGERS = {
  firstDelivery: 'first_delivery',
  packageLimit: 'package_limit',
  day7Hard: 'day7_hard',
  theftShield: 'theft_shield',
  household: 'household',
  upsAmazon: 'ups_amazon',
  manual: 'manual',
} as const;

export type PaywallTrigger = typeof PAYWALL_TRIGGERS[keyof typeof PAYWALL_TRIGGERS];
