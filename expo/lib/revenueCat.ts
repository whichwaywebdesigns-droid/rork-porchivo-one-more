import { Platform } from 'react-native';
import { ENTITLEMENTS, LIFETIME_PRODUCT_IDS, Plan, SubscriptionTier, isLifetimeProductId } from '@/lib/tiers';
import { log, warn } from "./logger";

const ENTITLEMENT_ID = ENTITLEMENTS.removeAds;

export const TIER_ENTITLEMENTS: { tier: SubscriptionTier; id: string }[] = [
  { tier: 'lifetime', id: ENTITLEMENTS.lifetime },
  { tier: 'family', id: ENTITLEMENTS.family },
  { tier: 'premium', id: ENTITLEMENTS.premium },
  { tier: 'premium', id: ENTITLEMENTS.removeAds },
];

let Purchases: any = null;
let LOG_LEVEL: any = null;
let isConfigured = false;
let isAvailable = false;
let rcLoggedInUserId: string | null = null;

async function loadPurchasesModule(): Promise<boolean> {
  if (Purchases) return isAvailable;
  try {
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
    LOG_LEVEL = mod.LOG_LEVEL;
    isAvailable = true;
    log('[RevenueCat] Module loaded successfully');
    return true;
  } catch (error) {
    log('[RevenueCat] Module not available (expected in Expo Go):', error);
    isAvailable = false;
    return false;
  }
}

function getRCApiKey(): string {
  // Use test key in dev builds or any non-production EAS profile.
  // EXPO_PUBLIC_APP_ENV is set per EAS build profile in eas.json.
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (__DEV__ || appEnv !== 'production' || Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '';
  }
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '',
  }) as string;
}

export async function configureRevenueCat(): Promise<void> {
  if (isConfigured || Platform.OS === 'web') {
    return;
  }

  const loaded = await loadPurchasesModule();
  if (!loaded || !Purchases) {
    log('[RevenueCat] Skipping configuration — module not available');
    return;
  }

  const apiKey = getRCApiKey();
  if (!apiKey) {
    warn('[RevenueCat] No API key found, skipping configuration');
    return;
  }

  try {
    if (__DEV__ && LOG_LEVEL) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });
    isConfigured = true;
    log('[RevenueCat] Configured successfully with key:', apiKey.substring(0, 8) + '...');
    void attachRcListener();
  } catch (error) {
    log('[RevenueCat] Configuration error (non-fatal):', error);
  }
}

type CustomerInfoListener = (info: any) => void;
const listeners: Set<CustomerInfoListener> = new Set();
let rcListenerAttached = false;

export function addCustomerInfoUpdateListener(listener: CustomerInfoListener): () => void {
  listeners.add(listener);
  void attachRcListener();
  return () => {
    listeners.delete(listener);
  };
}

async function attachRcListener(): Promise<void> {
  if (rcListenerAttached) return;
  if (Platform.OS === 'web') return;
  const loaded = await loadPurchasesModule();
  if (!loaded || !Purchases) return;
  if (typeof Purchases.addCustomerInfoUpdateListener !== 'function') {
    log('[RevenueCat] addCustomerInfoUpdateListener not available');
    return;
  }
  try {
    Purchases.addCustomerInfoUpdateListener((info: any) => {
      log('[RevenueCat] CustomerInfo updated, active entitlements:', Object.keys(info?.entitlements?.active ?? {}));
      listeners.forEach((l) => {
        try { l(info); } catch (e) { log('[RevenueCat] Listener error:', e); }
      });
    });
    rcListenerAttached = true;
    log('[RevenueCat] CustomerInfo update listener attached');
  } catch (e) {
    log('[RevenueCat] Failed to attach listener:', e);
  }
}

export async function getCustomerInfo(): Promise<any> {
  if (!isAvailable || !Purchases) {
    log('[RevenueCat] Module not available, skipping getCustomerInfo');
    return null;
  }
  log('[RevenueCat] Fetching customer info...');
  const info = await Purchases.getCustomerInfo();
  log('[RevenueCat] Customer info fetched, entitlements:', Object.keys(info.entitlements.active));
  return info;
}

export function hasLifetimeUnlock(info: any): boolean {
  if (!info) return false;

  const nonSub = info.nonSubscriptionTransactions;
  if (Array.isArray(nonSub)) {
    const found = nonSub.some((t: any) => isLifetimeProductId(t?.productIdentifier));
    if (found) {
      log('[RevenueCat] Lifetime unlock detected via nonSubscriptionTransactions');
      return true;
    }
  }

  const allPurchased = info.allPurchasedProductIdentifiers;
  if (Array.isArray(allPurchased)) {
    const found = allPurchased.some((id: string) => isLifetimeProductId(id));
    if (found) {
      log('[RevenueCat] Lifetime unlock detected via allPurchasedProductIdentifiers');
      return true;
    }
  }

  const active = info.entitlements?.active ?? {};
  for (const key of Object.keys(active)) {
    const ent = active[key];
    if (ent && isLifetimeProductId(ent.productIdentifier)) {
      log('[RevenueCat] Lifetime unlock detected via entitlement productIdentifier:', key);
      return true;
    }
  }

  if (typeof active[ENTITLEMENTS.lifetime] !== 'undefined') {
    log('[RevenueCat] Lifetime unlock detected via lifetime entitlement key');
    return true;
  }

  return false;
}

export function checkRemoveAdsEntitlement(info: any): boolean {
  if (!info) return false;
  if (hasLifetimeUnlock(info)) return true;
  const active = info.entitlements?.active ?? {};
  const hasEntitlement =
    typeof active[ENTITLEMENTS.removeAds] !== 'undefined' ||
    typeof active[ENTITLEMENTS.premium] !== 'undefined' ||
    typeof active[ENTITLEMENTS.family] !== 'undefined' ||
    typeof active[ENTITLEMENTS.lifetime] !== 'undefined';
  log('[RevenueCat] Has any paid entitlement:', hasEntitlement);
  return hasEntitlement;
}

export function resolveTierFromCustomerInfo(info: any): SubscriptionTier {
  if (!info) return 'free';

  if (hasLifetimeUnlock(info)) {
    log('[RevenueCat] Resolved tier: lifetime (non-consumable)');
    return 'lifetime';
  }

  const active = info.entitlements?.active ?? {};
  for (const { tier, id } of TIER_ENTITLEMENTS) {
    if (tier === 'lifetime') continue;
    if (active[id]) {
      log('[RevenueCat] Resolved tier from subscription entitlement:', tier, id);
      return tier;
    }
  }
  return 'free';
}

export { LIFETIME_PRODUCT_IDS };

export async function getCurrentOffering(): Promise<any> {
  if (!isAvailable || !Purchases) {
    log('[RevenueCat] Module not available, skipping getCurrentOffering');
    return null;
  }
  log('[RevenueCat] Fetching offerings...');
  const offerings = await Purchases.getOfferings();
  log('[RevenueCat] Current offering:', offerings.current?.identifier ?? 'none');
  return offerings.current ?? null;
}

/**
 * The live, store-authoritative price for a single product, already localized
 * to the user's App Store / Play Store region and currency by the OS.
 */
export interface LivePrice {
  /** Localized total price string, e.g. "$99.99", "£89.99", "€109,99". */
  priceString: string;
  /** Numeric price in the store currency (for computing per-month, etc.). */
  price: number;
  /** ISO currency code, e.g. "USD", "GBP". */
  currencyCode: string;
  /** The store product identifier this price belongs to. */
  productIdentifier: string;
}

/**
 * Fetch the live, localized prices from the current RevenueCat offering and
 * return them keyed by BOTH the RevenueCat package identifier (e.g. "$rc_annual")
 * and the underlying store product identifier (e.g. "premium_annual"), so the
 * paywall can look up a price by whichever id our Plan model carries.
 *
 * Returns an empty map when the SDK is unavailable (Expo Go / web preview) —
 * callers should fall back to their static display labels in that case.
 *
 * WHY THIS EXISTS: the store is the single source of truth for price. Hardcoding
 * prices drifts out of sync across regions/currencies and risks App Store
 * rejection. Always display this value when present.
 */
export async function getLivePrices(): Promise<Record<string, LivePrice>> {
  const offering = await getCurrentOffering();
  if (!offering) return {};
  const map: Record<string, LivePrice> = {};
  const packages = offering.availablePackages ?? [];
  for (const pkg of packages) {
    const product = pkg?.product;
    if (!product) continue;
    const entry: LivePrice = {
      priceString: product.priceString ?? '',
      price: typeof product.price === 'number' ? product.price : 0,
      currencyCode: product.currencyCode ?? '',
      productIdentifier: product.identifier ?? '',
    };
    if (!entry.priceString) continue;
    if (pkg.identifier) map[pkg.identifier] = entry;
    if (product.identifier) map[product.identifier] = entry;
  }
  log('[RevenueCat] Live prices loaded for ids:', Object.keys(map).join(', ') || 'none');
  return map;
}

/**
 * Format a numeric price + ISO currency code as a localized string.
 * Used to derive a per-month equivalent from an annual store price so the
 * "$8.33/mo" line also tracks the real store price instead of a hardcoded label.
 * Falls back to a plain fixed-2 string if Intl currency formatting is unavailable.
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode || 'USD',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)}`;
  }
}

export async function purchaseNoAdsPackage(): Promise<{ success: boolean; customerInfo: any }> {
  return purchasePlan({ id: 'premium_monthly' } as Plan);
}

export async function purchasePlan(plan: Plan): Promise<{ success: boolean; customerInfo: any; tier: SubscriptionTier }> {
  if (!isAvailable || !Purchases) {
    log('[RevenueCat] Module not available, cannot purchase');
    throw new Error('In-app purchases are not available in this build. Please use a production build to purchase.');
  }
  const isLifetime = plan.period === 'lifetime' || plan.tier === 'lifetime';
  log('[RevenueCat] Starting purchase for plan:', plan.id, isLifetime ? '(non-consumable lifetime)' : '(subscription)');
  try {
    const offerings = await Purchases.getOfferings();
    const all = offerings.current?.availablePackages ?? [];
    const match = isLifetime
      ? (all.find((pkg: any) => pkg.packageType === 'LIFETIME')
        ?? all.find((pkg: any) => pkg.identifier === '$rc_lifetime')
        ?? all.find((pkg: any) => isLifetimeProductId(pkg.product?.identifier))
        ?? all.find((pkg: any) => pkg.identifier === plan.id))
      : (all.find((pkg: any) => pkg.identifier === plan.id)
        ?? all.find((pkg: any) => pkg.product?.identifier === plan.id));

    if (!match) {
      log('[RevenueCat] Plan package not found, falling back');
      const fallback = offerings.current?.monthly ?? all[0];
      if (!fallback) throw new Error('No suitable package found');
      const { customerInfo } = await Purchases.purchasePackage(fallback);
      return {
        success: checkRemoveAdsEntitlement(customerInfo),
        customerInfo,
        tier: resolveTierFromCustomerInfo(customerInfo),
      };
    }

    const { customerInfo } = await Purchases.purchasePackage(match);
    log('[RevenueCat] Purchase completed for plan:', plan.id);
    return {
      success: checkRemoveAdsEntitlement(customerInfo),
      customerInfo,
      tier: resolveTierFromCustomerInfo(customerInfo),
    };
  } catch (error: any) {
    if (error.userCancelled) {
      log('[RevenueCat] User cancelled purchase');
      return { success: false, customerInfo: null, tier: 'free' };
    }
    log('[RevenueCat] Purchase error:', error);
    throw error;
  }
}

export async function redeemPromoCode(code: string): Promise<boolean> {
  if (!isAvailable || !Purchases) {
    log('[RevenueCat] Module not available, cannot redeem');
    return false;
  }
  try {
    if (typeof Purchases.presentCodeRedemptionSheet === 'function') {
      await Purchases.presentCodeRedemptionSheet();
      return true;
    }
    log('[RevenueCat] presentCodeRedemptionSheet not available, code:', code);
    return false;
  } catch (e) {
    log('[RevenueCat] Redeem error:', e);
    return false;
  }
}

export async function restorePurchases(): Promise<{ success: boolean; customerInfo: any }> {
  if (!isAvailable || !Purchases) {
    log('[RevenueCat] Module not available, cannot restore');
    throw new Error('In-app purchases are not available in this build.');
  }
  log('[RevenueCat] Restoring purchases...');
  const customerInfo = await Purchases.restorePurchases();
  const hasEntitlement = checkRemoveAdsEntitlement(customerInfo);
  log('[RevenueCat] Restore complete, has entitlement:', hasEntitlement);
  return { success: hasEntitlement, customerInfo };
}

export { ENTITLEMENT_ID };

/**
 * Identify the current user to RevenueCat by their Supabase user ID.
 * Must be called after login so that RevenueCat webhook events carry the
 * Supabase user ID in app_user_id — enabling server-side subscription writes.
 * Safe to call multiple times; skips if the user is already logged in.
 */
export async function loginRevenueCat(userId: string): Promise<void> {
  if (!userId) return;
  if (Platform.OS === 'web') return;
  if (rcLoggedInUserId === userId) return; // already identified
  const loaded = await loadPurchasesModule();
  if (!loaded || !Purchases) return;
  try {
    if (typeof Purchases.logIn === 'function') {
      await Purchases.logIn(userId);
      rcLoggedInUserId = userId;
      log('[RevenueCat] Logged in with user ID:', userId.substring(0, 8) + '...');
    }
  } catch (e) {
    log('[RevenueCat] logIn error (non-fatal):', e);
  }
}

/**
 * Log out the current RevenueCat user (call on sign-out).
 */
export async function logoutRevenueCat(): Promise<void> {
  if (Platform.OS === 'web') return;
  const loaded = await loadPurchasesModule();
  if (!loaded || !Purchases) return;
  try {
    if (typeof Purchases.logOut === 'function') {
      await Purchases.logOut();
      rcLoggedInUserId = null;
      log('[RevenueCat] Logged out');
    }
  } catch (e) {
    log('[RevenueCat] logOut error (non-fatal):', e);
  }
}
