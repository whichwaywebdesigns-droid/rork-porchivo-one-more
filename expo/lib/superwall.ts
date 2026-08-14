import { Platform } from 'react-native';
import { log, warn } from "./logger";

/**
 * Superwall is a native-only SDK. In Expo Go and on web the native module
 * `SuperwallExpo` doesn't exist, which would crash at import time. We
 * defensively try to load it and fall back to our in-app /upgrade
 * RevenueCat paywall when the module isn't available.
 *
 * ── C-1 FIX: RevenueCat as purchase controller ─────────────────────────────
 * Superwall is configured with a PurchaseController that delegates every
 * purchase/restore to react-native-purchases. This guarantees:
 *   • Every Superwall-initiated purchase flows through RevenueCat → the
 *     RevenueCat webhook fires → subscription_entitlements is written.
 *   • Superwall never makes an independent StoreKit/Play Billing purchase
 *     that RevenueCat never sees (the "paid but not entitled" bug).
 *   • Subscription status is pushed INTO Superwall via
 *     setSubscriptionStatus() whenever RC customer info changes, so
 *     Superwall's gating agrees with RevenueCat's entitlement source of truth.
 *
 * Fallback routing contract
 * ─────────────────────────────────────
 * openPaywall() never self-routes anymore. For ALL failure cases
 * (web, module unavailable, unconfigured, SDK throws) it calls the
 * caller-supplied onError callback. If no onError is supplied we fall
 * back to routeToInAppUpgrade() for backward-compatibility.
 *
 * This means PaywallContext (and any other caller that provides onError)
 * owns the routing decision — preventing double-pushes and allowing the
 * guard to set isPaywallOpen before the route is pushed.
 */

function routeToInAppUpgrade(_placement: string): void {
  // No-op: IAP/upgrade routes have been removed. PaywallContext always grants access.
  log('[Superwall] routeToInAppUpgrade is a no-op (IAP removed) for', _placement);
}

/**
 * Unified fallback handler.
 * Calls onError if the caller provided it; otherwise routes itself.
 * This prevents double-routing when callers supply their own onError.
 */
function handleFallback(
  placement: string,
  onError: ((e: unknown) => void) | undefined,
  error?: unknown,
): void {
  if (onError) {
    log('[Superwall] Calling caller onError for placement:', placement);
    onError(error ?? new Error('Superwall unavailable'));
  } else {
    routeToInAppUpgrade(placement);
  }
}

const IOS_API_KEY = process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY ?? '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY ?? '';

// ── Purchase controller / result types from the compat layer ───────────────
// These are populated when loadSuperwall() succeeds. Kept loose-typed because
// the compat module is only resolvable in native builds (not Expo Go / web).
type PurchaseResultLike = { type: 'cancelled' | 'purchased' | 'pending' | 'failed'; error?: string };
type PurchaseControllerCtor = new () => {
  purchaseFromAppStore(productId: string): Promise<PurchaseResultLike>;
  purchaseFromGooglePlay(productId: string, basePlanId?: string, offerId?: string): Promise<PurchaseResultLike>;
  restorePurchases(): Promise<{ toJson(): object }>;
};
type RestorationResultStatic = { restored: () => { toJson(): object }; failed: (error?: Error) => { toJson(): object } };
type PurchaseResultStatic = {
  Purchased: new () => PurchaseResultLike;
  Cancelled: new () => PurchaseResultLike;
  Failed: new (error: string) => PurchaseResultLike;
  Pending: new () => PurchaseResultLike;
};
type SubscriptionStatusStatic = {
  Active: (input: unknown[] | string[]) => { status: 'ACTIVE'; entitlements: unknown[] };
  Inactive: () => { status: 'INACTIVE' };
  Unknown: () => { status: 'UNKNOWN' };
};

type SuperwallModule = {
  default: {
    configure: (opts: {
      apiKey: string;
      purchaseController?: object;
      completion?: () => void;
    }) => Promise<unknown>;
    shared: {
      identify: (opts: { userId: string }) => Promise<unknown>;
      register: (opts: {
        placement: string;
        params?: Record<string, string | number | boolean>;
        handler?: unknown;
        feature?: () => void;
      }) => Promise<unknown>;
      setSubscriptionStatus: (status: unknown) => Promise<void>;
    };
  };
  PaywallPresentationHandler: new () => {
    onPresent: (cb: (info?: unknown) => void) => void;
    onDismiss: (cb: (info: unknown, result: unknown) => void) => void;
    onError: (cb: (error: unknown) => void) => void;
    onSkip: (cb: (reason: unknown) => void) => void;
  };
  PurchaseController: PurchaseControllerCtor;
  PurchaseResult: PurchaseResultStatic;
  RestorationResult: RestorationResultStatic;
  SubscriptionStatus: SubscriptionStatusStatic;
};

let superwallMod: SuperwallModule | null = null;
let configured = false;
let configuringPromise: Promise<void> | null = null;
let loadAttempted = false;

function loadSuperwall(): SuperwallModule | null {
  if (loadAttempted) return superwallMod;
  loadAttempted = true;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-superwall/compat') as SuperwallModule;
    superwallMod = mod;
    return mod;
  } catch (err) {
    log('[Superwall] Native module unavailable, using fallback:', String((err as Error)?.message ?? err));
    superwallMod = null;
    return null;
  }
}

// ── RevenueCat-backed purchase controller ──────────────────────────────────
// Delegates every Superwall purchase to react-native-purchases so RC remains
// the single source of truth for entitlements. Without this, Superwall would
// make independent StoreKit/Play Billing purchases that RC never sees — the
// "paid but not entitled" desync bug from audit finding C-1.

/**
 * Lazily create a PurchaseController backed by react-native-purchases.
 * Returns null if either SDK isn't available (Expo Go / web).
 */
function createRevenueCatPurchaseController(mod: SuperwallModule): object | null {
  try {
    const Purchased = new mod.PurchaseResult.Purchased();
    const Cancelled = new mod.PurchaseResult.Cancelled();
    const Failed = (msg: string) => new mod.PurchaseResult.Failed(msg);
    const Pending = new mod.PurchaseResult.Pending();
    const Restored = mod.RestorationResult.restored();
    const RestoreFailed = (err?: Error) => mod.RestorationResult.failed(err);

    class RevenueCatPurchaseController extends mod.PurchaseController {
      async purchaseFromAppStore(productId: string): Promise<PurchaseResultLike> {
        log('[Superwall] PurchaseController.purchaseFromAppStore:', productId);
        try {
          const Purchases = await loadRcPurchases();
          if (!Purchases) return Failed('RevenueCat not available');
          await Purchases.purchaseProduct(productId);
          log('[Superwall] RC purchase completed for:', productId);
          return Purchased;
        } catch (err: any) {
          if (err?.userCancelled) {
            log('[Superwall] User cancelled purchase');
            return Cancelled;
          }
          log('[Superwall] RC purchase failed:', String(err?.message ?? err));
          return Failed(String(err?.message ?? 'Purchase failed'));
        }
      }

      async purchaseFromGooglePlay(
        productId: string,
        basePlanId?: string,
        offerId?: string,
      ): Promise<PurchaseResultLike> {
        log('[Superwall] PurchaseController.purchaseFromGooglePlay:', productId, basePlanId, offerId);
        try {
          const Purchases = await loadRcPurchases();
          if (!Purchases) return Failed('RevenueCat not available');
          // react-native-purchases purchaseProduct handles Play Billing under
          // the hood; basePlanId/offerId are resolved by the RC SDK from the
          // product identifier when the offering is configured correctly.
          await Purchases.purchaseProduct(productId);
          log('[Superwall] RC purchase completed for:', productId);
          return Purchased;
        } catch (err: any) {
          if (err?.userCancelled) {
            log('[Superwall] User cancelled purchase');
            return Cancelled;
          }
          log('[Superwall] RC purchase failed:', String(err?.message ?? err));
          return Failed(String(err?.message ?? 'Purchase failed'));
        }
      }

      async restorePurchases(): Promise<{ toJson(): object }> {
        log('[Superwall] PurchaseController.restorePurchases');
        try {
          const Purchases = await loadRcPurchases();
          if (!Purchases) return RestoreFailed(new Error('RevenueCat not available'));
          await Purchases.restorePurchases();
          log('[Superwall] RC restore completed');
          return Restored;
        } catch (err: any) {
          log('[Superwall] RC restore failed:', String(err?.message ?? err));
          return RestoreFailed(err);
        }
      }
    }

    return new RevenueCatPurchaseController();
  } catch (err) {
    warn('[Superwall] Failed to build RevenueCat purchase controller:', String((err as Error)?.message ?? err));
    return null;
  }
}

/** Lazy-load react-native-purchases on first purchase call. */
async function loadRcPurchases(): Promise<any | null> {
  try {
    const rcMod = await import('react-native-purchases');
    return rcMod.default;
  } catch (err) {
    warn('[Superwall] react-native-purchases not available:', String((err as Error)?.message ?? err));
    return null;
  }
}

export async function initSuperwall(): Promise<void> {
  if (Platform.OS === 'web') {
    log('[Superwall] Skipped init on web');
    return;
  }
  if (configured) return;
  if (configuringPromise) return configuringPromise;

  const mod = loadSuperwall();
  if (!mod) {
    log('[Superwall] Skipped init - module unavailable in this build');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    warn('[Superwall] Missing API key for', Platform.OS);
    return;
  }

  // Build the RevenueCat-backed purchase controller so Superwall delegates
  // all purchases to RC instead of making independent store purchases.
  const purchaseController = createRevenueCatPurchaseController(mod);
  if (purchaseController) {
    log('[Superwall] Using RevenueCat purchase controller');
  } else {
    warn('[Superwall] No purchase controller — Superwall will handle its own purchases (C-1 risk)');
  }

  configuringPromise = (async () => {
    try {
      log('[Superwall] Configuring SDK for', Platform.OS);
      await mod.default.configure({ apiKey, purchaseController: purchaseController ?? undefined });
      configured = true;
      log('[Superwall] Configured with RevenueCat purchase controller');
    } catch (error) {
      log('[Superwall] Configure failed (non-fatal):', String((error as Error)?.message ?? error));
    } finally {
      configuringPromise = null;
    }
  })();

  return configuringPromise;
}

export async function identifySuperwallUser(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = loadSuperwall();
  if (!mod) return;
  try {
    if (!configured) await initSuperwall();
    if (!configured) return;
    await mod.default.shared.identify({ userId });
    log('[Superwall] Identified user', userId);
  } catch (error) {
    log('[Superwall] identify failed (non-fatal):', String((error as Error)?.message ?? error));
  }
}

/**
 * Push RevenueCat's entitlement state INTO Superwall so Superwall's gating
 * agrees with RC's source of truth. Call this whenever RC customer info
 * updates (from addCustomerInfoUpdateListener).
 *
 * This is the second half of the C-1 fix: the purchase controller routes
 * purchases INTO RC, and this function routes entitlement state OUT of RC
 * INTO Superwall. Without this, Superwall might show a paywall to a user
 * who already has an active RC entitlement.
 *
 * @param isEntitled  True if the user has any active paid entitlement in RC.
 * @param entitlementIds  The RC entitlement identifier keys (e.g. ['premium',
 *   'family_household', 'lifetime', 'remove_ads']). Pass [] when not entitled.
 */
export async function syncSuperwallSubscriptionStatus(
  isEntitled: boolean,
  entitlementIds: string[],
): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = loadSuperwall();
  if (!mod) return;
  if (!configured) return; // silent — init may not have run yet
  try {
    const status = isEntitled
      ? mod.SubscriptionStatus.Active(entitlementIds)
      : mod.SubscriptionStatus.Inactive();
    await mod.default.shared.setSubscriptionStatus(status);
    log('[Superwall] Subscription status synced:', isEntitled ? 'ACTIVE' : 'INACTIVE', entitlementIds.length, 'entitlements');
  } catch (error) {
    log('[Superwall] setSubscriptionStatus failed (non-fatal):', String((error as Error)?.message ?? error));
  }
}

export interface OpenPaywallOptions {
  placement: string;
  params?: Record<string, unknown>;
  onFeature?: () => void;
  onPresent?: () => void;
  onDismiss?: () => void;
  /**
   * Called for ALL failure cases: web, module unavailable, SDK unconfigured,
   * or any thrown error during register().
   *
   * If provided, openPaywall() will NOT self-route — the caller owns routing.
   * If omitted, openPaywall() falls back to routeToInAppUpgrade().
   */
  onError?: (error: unknown) => void;
}

export async function openPaywall(options: OpenPaywallOptions): Promise<void> {
  const { placement, params, onFeature, onPresent, onDismiss, onError } = options;

  // ── Web: always fall back ──────────────────────────────────────────────
  if (Platform.OS === 'web') {
    log('[Superwall] Web fallback for', placement);
    handleFallback(placement, onError);
    onPresent?.();
    return;
  }

  // ── Module unavailable (Expo Go / non-native build) ────────────────────
  const mod = loadSuperwall();
  if (!mod) {
    log('[Superwall] Module unavailable, using fallback for', placement);
    handleFallback(placement, onError);
    onPresent?.();
    return;
  }

  try {
    // ── Ensure SDK is configured ────────────────────────────────────────
    if (!configured) await initSuperwall();
    if (!configured) {
      log('[Superwall] Not configured, using fallback');
      handleFallback(placement, onError);
      onPresent?.();
      return;
    }

    log('[Superwall] Registering placement:', placement);
    const handler = new mod.PaywallPresentationHandler();
    handler.onPresent(() => {
      log('[Superwall] Paywall presented:', placement);
      onPresent?.();
    });
    handler.onDismiss((_info, result) => {
      log('[Superwall] Paywall dismissed:', placement, result);
      onDismiss?.();
    });
    handler.onError((error) => {
      log('[Superwall] Paywall error:', error);
      // SDK-level error during presentation — treat as fallback
      handleFallback(placement, onError, error);
    });
    handler.onSkip((reason) => {
      log('[Superwall] Paywall skipped:', reason);
    });

    await mod.default.shared.register({
      placement,
      params: params as Record<string, string | number | boolean> | undefined,
      handler,
      feature: () => {
        log('[Superwall] Feature granted for placement:', placement);
        onFeature?.();
      },
    });
  } catch (error) {
    log('[Superwall] register threw, using fallback:', String((error as Error)?.message ?? error));
    // Single call — no double-routing. handleFallback routes XOR calls onError.
    handleFallback(placement, onError, error);
  }
}

/**
 * Placements used by direct openPaywall() callers. These map to campaigns
 * configured in the Superwall dashboard. For feature-gated flows, prefer
 * guardPremiumAccess({ trigger: PAYWALL_TRIGGERS.* }) instead — it routes
 * through PaywallContext and handles dedup + pending-action resume.
 */
export const SUPERWALL_PLACEMENTS = {
  removeAdsUpgrade: 'remove_ads_upgrade',
} as const;
