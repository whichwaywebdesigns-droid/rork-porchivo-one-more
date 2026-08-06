import { useEffect, useState, useCallback, useMemo } from 'react';
import { log, warn, error as logError } from '@/lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { User, UserRole } from '@/types';
import { DbProfile, DbUserEntitlement, SubscriptionStatus } from '@/types/database';
import { dbProfileToUser } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { recordConsent as recordConsentRow, fetchLatestConsentVersion } from '@/lib/consent';
import { LEGAL_VERSION } from '@/constants/legal';
import { Session } from '@supabase/supabase-js';
import { identifySuperwallUser, syncSuperwallSubscriptionStatus } from '@/lib/superwall';
import { Platform } from 'react-native';
import {
  configureRevenueCat,
  getCustomerInfo,
  checkRemoveAdsEntitlement,
  purchasePlan as rcPurchasePlan,
  restorePurchases as rcRestorePurchases,
  resolveTierFromCustomerInfo,
  redeemPromoCode,
  addCustomerInfoUpdateListener,
  loginRevenueCat,
  logoutRevenueCat,
} from '@/lib/revenueCat';
import {
  SubscriptionTier,
  Plan,
  capabilitiesForTier,
  TierCapabilities,
  PaywallTrigger,
  DAY7_HARD_PAYWALL_MS,
  REFERRAL_CREDIT_DAYS,
} from '@/lib/tiers';

const STORAGE_KEYS = {
  onboarded: 'porchivo_onboarded',
  tier: 'porchivo_tier',
  installedAt: 'porchivo_installed_at',
  firstDeliveryShown: 'porchivo_first_delivery_paywall_shown',
  referralCode: 'porchivo_referral_code',
  referralCreditUntil: 'porchivo_referral_credit_until',
  chimeId: 'porchivo_chime_id',
  theftShieldEnabled: 'porchivo_theft_shield',
} as const;

let rcConfigPromise: Promise<void> | null = null;
function ensureRevenueCatConfigured(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!rcConfigPromise) {
    rcConfigPromise = configureRevenueCat().catch((e) => {
      // Non-fatal — RC may not be configured in Expo Go or web builds
      void e;
    });
  }
  return rcConfigPromise;
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [installedAt, setInstalledAt] = useState<number | null>(null);
  const [referralCreditUntil, setReferralCreditUntil] = useState<number | null>(null);
  const [chimeId, setChimeId] = useState<string>('default');
  const [theftShieldEnabled, setTheftShieldEnabled] = useState<boolean>(false);

  useEffect(() => {
    log('[AppContext] Setting up Supabase auth listener...');
    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      log('[AppContext] Initial session:', currentSession ? 'found' : 'none');
      setSession(currentSession);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      log('[AppContext] Auth state changed:', _event, newSession ? 'session exists' : 'no session');
      setSession(newSession);
      if (_event === 'SIGNED_OUT') {
        log('[AppContext] User signed out, clearing state');
        setUser(null);
        setIsOnboarded(false);
        setIsPremium(false);
        queryClient.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // ── Backend-authoritative entitlement query ───────────────────────────
  // Reads from the user_entitlement view (profiles LEFT JOIN user_subscriptions).
  // This is the single trusted record the app uses for billing state.
  // RC SDK state is still used for real-time updates but is always overridden
  // by this query once it resolves.
  const entitlementQuery = useQuery({
    queryKey: ['user-entitlement', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('user_entitlement')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) {
        log('[AppContext] Entitlement query error:', error.code);
        throw error;
      }
      log('[AppContext] Entitlement loaded — is_entitled:', data?.is_entitled, 'tier:', data?.subscription_tier_detail ?? data?.subscription_tier);
      return data as DbUserEntitlement | null;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 2, // 2 min — short enough to catch webhook updates
  });

  // Sync backend-confirmed entitlement into local state.
  // Backend wins over RC SDK inference when it has an explicit value.
  useEffect(() => {
    const ent = entitlementQuery.data;
    if (!ent) return;
    // is_entitled is the derived server-side flag that already accounts for
    // cancelled-but-in-period, grace periods, and lifetime unlocks.
    if (ent.is_entitled !== null && ent.is_entitled !== undefined) {
      setIsPremium(ent.is_entitled);
    }
    const backendTier = (ent.subscription_tier_detail ?? ent.subscription_tier) as SubscriptionStatus | string | null;
    if (backendTier) {
      // Only push the tier into state if backend has an opinion
      setTier(backendTier as any);
      void AsyncStorage.setItem(STORAGE_KEYS.tier, backendTier);
    }
  }, [entitlementQuery.data]);

  // ── Versioned legal consent ───────────────────────────────────────────
  // The latest legal version this user has accepted. Drives the forced
  // re-acceptance gate when LEGAL_VERSION changes.
  const consentQuery = useQuery({
    queryKey: ['consent', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const version = await fetchLatestConsentVersion(session.user.id);
      log('[AppContext] Latest accepted legal version:', version ?? 'none');
      return { version } as { version: string | null };
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const recordConsentNow = useCallback(async (): Promise<boolean> => {
    if (!session?.user?.id) return false;
    const ok = await recordConsentRow(session.user.id);
    if (ok) {
      await queryClient.invalidateQueries({ queryKey: ['consent', session.user.id] });
    }
    return ok;
  }, [session?.user?.id, queryClient]);

  // True once we know the user's accepted version and it lags the current one.
  // Stays false while loading and for fresh signups (recorded inline at signup).
  const needsReconsent = useMemo(() => {
    if (!session?.user?.id) return false;
    if (consentQuery.isLoading || !consentQuery.data) return false;
    return consentQuery.data.version !== LEGAL_VERSION;
  }, [session?.user?.id, consentQuery.isLoading, consentQuery.data]);

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      log('[AppContext] Fetching profile from Supabase...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        log('[AppContext] Profile fetch error:', error.code);
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      log('[AppContext] Profile fetched, onboarded:', data?.is_onboarded);
      return data as DbProfile;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (profileQuery.data) {
      const dbProfile = profileQuery.data;
      setUser(dbProfileToUser(dbProfile));
      setIsOnboarded(dbProfile.is_onboarded);
      setIsPremium(dbProfile.is_premium);
    } else if (profileQuery.data === null && session?.user?.id) {
      setIsOnboarded(false);
    }
  }, [profileQuery.data, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      void AsyncStorage.getItem(STORAGE_KEYS.onboarded).then((val) => {
        if (val === 'true') setIsOnboarded(true);
        else setIsOnboarded(prev => prev === null ? false : prev);
      });
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    void identifySuperwallUser(userId);
    // Identify user to RevenueCat so webhook events carry the Supabase user ID
    void loginRevenueCat(userId);
  }, [session?.user?.id]);

  useEffect(() => {
    void (async () => {
      const [storedTier, storedInstalled, storedReferral, storedChime, storedTheft] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.tier),
        AsyncStorage.getItem(STORAGE_KEYS.installedAt),
        AsyncStorage.getItem(STORAGE_KEYS.referralCreditUntil),
        AsyncStorage.getItem(STORAGE_KEYS.chimeId),
        AsyncStorage.getItem(STORAGE_KEYS.theftShieldEnabled),
      ]);
      if (storedTier) setTier(storedTier as SubscriptionTier);
      if (storedInstalled) {
        setInstalledAt(Number(storedInstalled));
      } else {
        const now = Date.now();
        setInstalledAt(now);
        await AsyncStorage.setItem(STORAGE_KEYS.installedAt, String(now));
      }
      if (storedReferral) setReferralCreditUntil(Number(storedReferral));
      if (storedChime) setChimeId(storedChime);
      if (storedTheft === 'true') setTheftShieldEnabled(true);
    })();
  }, []);

  const saveProfileMutation = useMutation({
    mutationFn: async (updates: Partial<DbProfile>) => {
      if (!session?.user?.id) throw new Error('Not authenticated');
      log('[AppContext] Updating profile in Supabase...');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select()
        .single();

      if (error) {
        log('[AppContext] Profile update error:', error.code);
        throw error;
      }
      return data as DbProfile;
    },
    onSuccess: (data) => {
      setUser(dbProfileToUser(data));
      setIsPremium(data.is_premium);
      queryClient.setQueryData(['profile', session?.user?.id], data);
    },
  });

  const completeOnboarding = useCallback(async (
    userData: Partial<User>,
    explicitSession?: Session | null,
  ) => {
    log('[AppContext] Completing onboarding with role:', userData.role);
    // Use explicitSession if provided — after supabase.auth.signUp() the auth
    // state listener may not have propagated the new session into context yet,
    // causing a silent no-op. Callers that have the raw session should pass it.
    const activeSession = explicitSession ?? session;
    const supabaseUser = activeSession?.user;
    if (!supabaseUser?.id) {
      log('[AppContext] No authenticated user, cannot complete onboarding');
      return;
    }

    const profileUpdates: Partial<DbProfile> = {
      name: userData.name ?? supabaseUser.user_metadata?.name ?? supabaseUser.user_metadata?.full_name ?? '',
      email: supabaseUser.email ?? userData.email ?? '',
      phone: userData.phone ?? supabaseUser.phone ?? '',
      role: userData.role ?? 'homeowner',
      address: userData.address ?? '',
      has_location_consent: userData.hasLocationConsent ?? false,
      has_precise_location_consent: userData.hasPreciseLocationConsent ?? false,
      is_onboarded: true,
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', supabaseUser.id)
      .select()
      .single();

    if (error) {
      log('[AppContext] Onboarding profile update error:', error.code);
      throw error;
    }

    const dbProfile = data as DbProfile;
    setUser(dbProfileToUser(dbProfile));
    setIsOnboarded(true);
    setIsPremium(dbProfile.is_premium);
    await AsyncStorage.setItem(STORAGE_KEYS.onboarded, 'true');
    queryClient.setQueryData(['profile', supabaseUser.id], dbProfile);
    log('[AppContext] Onboarding complete');
  }, [session, queryClient]);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user) return;
    const dbUpdates: Partial<DbProfile> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.hasLocationConsent !== undefined) dbUpdates.has_location_consent = updates.hasLocationConsent;
    if (updates.hasPreciseLocationConsent !== undefined) dbUpdates.has_precise_location_consent = updates.hasPreciseLocationConsent;
    if (updates.expoPushToken !== undefined) dbUpdates.expo_push_token = updates.expoPushToken;

    setUser({ ...user, ...updates });
    saveProfileMutation.mutate(dbUpdates);
  }, [user, saveProfileMutation]);

  const updateRole = useCallback((role: UserRole) => {
    log('[AppContext] Updating role');
    if (!user) return;
    setUser({ ...user, role });
    saveProfileMutation.mutate({ role });
  }, [user, saveProfileMutation]);

  const setLocationConsent = useCallback((consent: boolean, precise?: boolean) => {
    if (!user) return;
    const updates: Partial<User> = { hasLocationConsent: consent };
    const dbUpdates: Partial<DbProfile> = { has_location_consent: consent };
    if (precise !== undefined) {
      updates.hasPreciseLocationConsent = precise;
      dbUpdates.has_precise_location_consent = precise;
    }
    setUser({ ...user, ...updates });
    saveProfileMutation.mutate(dbUpdates);
  }, [user, saveProfileMutation]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    log('[AppContext] Attaching RC customer info update listener');
    const unsubscribe = addCustomerInfoUpdateListener((info) => {
      log('[AppContext] RC entitlement update received');
      const hasAds = checkRemoveAdsEntitlement(info);
      const resolved = resolveTierFromCustomerInfo(info);
      setIsPremium(hasAds);
      setTier(resolved);
      void AsyncStorage.setItem(STORAGE_KEYS.tier, resolved);
      // C-1: push RC entitlement state INTO Superwall so Superwall's gating
      // agrees with RevenueCat. Pass the active entitlement identifier keys
      // so Superwall knows WHICH entitlements are live, not just that one is.
      const activeEntitlementIds = Object.keys(info?.entitlements?.active ?? {});
      void syncSuperwallSubscriptionStatus(hasAds, activeEntitlementIds);
      // is_premium is the server-authoritative column written only by the revenuecat-webhook
      // Edge Function. The client never writes it directly.
      if (session?.user?.id) {
        void queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
      }
      queryClient.setQueryData(['rc-customer-info'], info);
      // Refresh backend entitlement so UI reflects webhook-confirmed state
      void queryClient.invalidateQueries({ queryKey: ['user-entitlement', session?.user?.id] });
    });
    return () => {
      log('[AppContext] Detaching RC customer info update listener');
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, queryClient]);

  const _rcCustomerInfoQuery = useQuery({
    queryKey: ['rc-customer-info'],
    queryFn: async () => {
      if (Platform.OS === 'web') return null;
      log('[AppContext] Checking RevenueCat entitlements on launch...');
      try {
        await ensureRevenueCatConfigured();
        const info = await getCustomerInfo();
        const hasAds = checkRemoveAdsEntitlement(info);
        if (hasAds) {
          log('[AppContext] User has paid entitlement from RC');
          setIsPremium(true);
          // is_premium is written server-side by revenuecat-webhook — never write from client
        }
        const resolved = resolveTierFromCustomerInfo(info);
        if (resolved !== 'free') {
          setTier(resolved);
          void AsyncStorage.setItem(STORAGE_KEYS.tier, resolved);
        }
        return info;
      } catch (err) {
        log('[AppContext] RC customer info error (may not be configured)');
        return null;
      }
    },
    enabled: !!session?.user?.id && Platform.OS !== 'web',
    staleTime: 1000 * 60 * 5,
  });

  /** Re-fetch the backend entitlement record. Call after restore, resync, or
   *  when the app comes back to the foreground after a billing action. */
  const syncEntitlement = useCallback(async () => {
    log('[AppContext] Syncing entitlement from backend...');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-entitlement', session?.user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] }),
      queryClient.invalidateQueries({ queryKey: ['profile', session?.user?.id] }),
    ]);
  }, [session?.user?.id, queryClient]);

  const purchasePlan = useCallback(async (plan: Plan): Promise<boolean> => {
    log('[AppContext] Starting RevenueCat purchase...');
    try {
      const result = await rcPurchasePlan(plan);
      if (result.success) {
        log('[AppContext] Purchase successful, tier:', result.tier);
        setIsPremium(true);
        setTier(result.tier);
        await AsyncStorage.setItem(STORAGE_KEYS.tier, result.tier);
        // Refresh profile from Supabase; is_premium is written by revenuecat-webhook server-side.
        void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
        void queryClient.invalidateQueries({ queryKey: ['profile', session?.user?.id] });
        void queryClient.invalidateQueries({ queryKey: ['user-entitlement', session?.user?.id] });
        return true;
      }
      return false;
    } catch (err: any) {
      const message: string = String(err?.message ?? '');
      // SECURITY: Never simulate purchases in any build type.
      // The __DEV__ bypass was removed — it allowed free premium in debug builds.
      // For testing IAP use RevenueCat sandbox environment instead.
      const isUnavailable = message.includes('not available') || Platform.OS === 'web';
      if (isUnavailable) {
        log('[AppContext] RC not available in this build (Expo Go / web). Use a dev-client build to test IAP.');
        throw new Error('In-app purchases require a standalone build. Use eas build --profile development to test purchases.');
      }
      logError('[AppContext] Purchase error');
      throw err;
    }
  }, [session?.user?.id, queryClient]);

  const upgradeToPremium = useCallback(async () => {
    return purchasePlan({ id: 'premium_monthly' } as Plan);
  }, [purchasePlan]);

  const restorePurchase = useCallback(async () => {
    log('[AppContext] Restoring purchases via RevenueCat');
    try {
      const result = await rcRestorePurchases();
      if (result.success) {
        log('[AppContext] Restore successful, user has entitlement');
        setIsPremium(true);
        const resolved = resolveTierFromCustomerInfo(result.customerInfo);
        if (resolved !== 'free') {
          setTier(resolved);
          await AsyncStorage.setItem(STORAGE_KEYS.tier, resolved);
        }
        // Refresh profile from Supabase; is_premium is written by revenuecat-webhook server-side.
        void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
        void queryClient.invalidateQueries({ queryKey: ['profile', session?.user?.id] });
        void queryClient.invalidateQueries({ queryKey: ['user-entitlement', session?.user?.id] });
        return true;
      }
      log('[AppContext] Restore complete, no entitlement found');
      return false;
    } catch (err: any) {
      log('[AppContext] Restore error (may be unavailable in this build)');
      if (profileQuery.data?.is_premium) {
        setIsPremium(true);
        return true;
      }
      return false;
    }
  }, [session?.user?.id, queryClient, profileQuery.data?.is_premium]);

  const signOut = useCallback(async () => {
    log('[AppContext] Signing out...');
    try {
      void logoutRevenueCat();
      // scope: 'global' revokes all sessions across all devices, not just this one
      await supabase.auth.signOut({ scope: 'global' });
      await AsyncStorage.removeItem(STORAGE_KEYS.onboarded);
      setUser(null);
      setIsOnboarded(false);
      setIsPremium(false);
      queryClient.clear();
      log('[AppContext] Sign out complete');
    } catch (err) {
      log('[AppContext] Sign out error');
      throw err;
    }
  }, [queryClient]);

  const deleteAccount = useCallback(async () => {
    if (!session?.user?.id) throw new Error('Not authenticated');
    log('[AppContext] Deleting account...');
    try {
      // Single atomic RPC — deletes all user data + auth.users row in one transaction.
      // See supabase/delete-account-procedure.sql for the full cascade order.
      const { data, error } = await supabase.rpc('delete_account_cascade');
      if (error) {
        log('[AppContext] Account cascade delete error:', error.code);
        throw error;
      }
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'Account deletion failed');
      }
      void logoutRevenueCat();
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(STORAGE_KEYS.onboarded);
      setUser(null);
      setIsOnboarded(false);
      setIsPremium(false);
      queryClient.clear();
      log('[AppContext] Account deleted successfully');
    } catch (err) {
      log('[AppContext] Account deletion error');
      throw err;
    }
  }, [session?.user?.id, queryClient]);

  const isHomeowner = useMemo(() => user?.role === 'homeowner' || user?.role === 'both', [user?.role]);
  const isPartner = useMemo(() => user?.role === 'partner' || user?.role === 'both', [user?.role]);

  const capabilities: TierCapabilities = useMemo(() => {
    const baseTier = isPremium && tier === 'free' ? 'premium' : tier;
    if (referralCreditUntil && Date.now() < referralCreditUntil && baseTier === 'free') {
      return capabilitiesForTier('premium');
    }
    return capabilitiesForTier(baseTier);
  }, [tier, isPremium, referralCreditUntil]);

  const daysSinceInstall = useMemo(() => {
    if (!installedAt) return 0;
    return Math.floor((Date.now() - installedAt) / (24 * 60 * 60 * 1000));
  }, [installedAt]);

  const isDay7HardPaywall = useMemo(() => {
    if (!session?.user?.id) return false;
    if (isPremium || tier !== 'free') return false;
    if (!installedAt) return false;
    if (referralCreditUntil && Date.now() < referralCreditUntil) return false;
    return Date.now() - installedAt >= DAY7_HARD_PAYWALL_MS;
  }, [session?.user?.id, installedAt, isPremium, tier, referralCreditUntil]);

  const applyReferralCredit = useCallback(async (days: number = REFERRAL_CREDIT_DAYS) => {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    setReferralCreditUntil(until);
    await AsyncStorage.setItem(STORAGE_KEYS.referralCreditUntil, String(until));
    log('[AppContext] Referral credit applied');
  }, []);

  const setChime = useCallback(async (id: string) => {
    setChimeId(id);
    await AsyncStorage.setItem(STORAGE_KEYS.chimeId, id);
  }, []);

  const setTheftShield = useCallback(async (enabled: boolean) => {
    setTheftShieldEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.theftShieldEnabled, enabled ? 'true' : 'false');
  }, []);

  const redeemCode = useCallback(async (code: string) => {
    const ok = await redeemPromoCode(code);
    if (ok) {
      void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
    }
    return ok;
  }, [queryClient]);

  return useMemo(() => ({
    session,
    user,
    isOnboarded,
    isLoading: (!!session?.user?.id && profileQuery.isLoading) || authLoading,
    isHomeowner,
    isPartner,
    isPremium,
    tier,
    capabilities,
    // ── Backend-confirmed subscription detail ────────────────────────────
    /** Lifecycle status from user_subscriptions. null until webhook has fired. */
    subscriptionStatus: (entitlementQuery.data?.subscription_status ?? null) as SubscriptionStatus | null,
    /** ISO timestamp when current paid period ends. null for lifetime or no sub. */
    currentPeriodEnd: entitlementQuery.data?.current_period_end ?? null,
    /** ISO timestamp when user requested cancellation. null if not cancelled. */
    cancelledAt: entitlementQuery.data?.cancelled_at ?? null,
    /** True for porchivo_lifetime — these never expire. */
    isLifetime: entitlementQuery.data?.is_lifetime ?? false,
    /**
     * Backend-derived entitlement flag. Prefer this over isPremium for access
     * gating once the user has a subscription row. Falls back to isPremium
     * (RC SDK) when no backend row exists yet.
     */
    isEntitled: entitlementQuery.data?.is_entitled ?? isPremium,
    /** Loading state for the entitlement query specifically */
    isEntitlementLoading: entitlementQuery.isLoading,
    // ────────────────────────────────────────────────────────────────────
    installedAt,
    daysSinceInstall,
    isDay7HardPaywall,
    referralCreditUntil,
    chimeId,
    theftShieldEnabled,
    needsReconsent,
    recordConsentNow,
    completeOnboarding,
    updateUser,
    updateRole,
    setLocationConsent,
    upgradeToPremium,
    purchasePlan,
    restorePurchase,
    syncEntitlement,
    applyReferralCredit,
    setChime,
    setTheftShield,
    redeemCode,
    signOut,
    deleteAccount,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    session,
    user,
    isOnboarded,
    profileQuery.isLoading,
    authLoading,
    isHomeowner,
    isPartner,
    isPremium,
    tier,
    capabilities,
    entitlementQuery.data,
    entitlementQuery.isLoading,
    installedAt,
    daysSinceInstall,
    isDay7HardPaywall,
    referralCreditUntil,
    chimeId,
    theftShieldEnabled,
    needsReconsent,
    recordConsentNow,
    completeOnboarding,
    updateUser,
    updateRole,
    setLocationConsent,
    upgradeToPremium,
    purchasePlan,
    restorePurchase,
    syncEntitlement,
    applyReferralCredit,
    setChime,
    setTheftShield,
    redeemCode,
    signOut,
    deleteAccount,
  ]);
});
