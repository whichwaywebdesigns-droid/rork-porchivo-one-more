import { useEffect, useState, useCallback, useMemo } from 'react';
import { log, warn, error as logError } from '@/lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { User, UserRole } from '@/types';
import { DbProfile } from '@/types/database';
import { dbProfileToUser } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { recordConsent as recordConsentRow, fetchLatestConsentVersion } from '@/lib/consent';
import { LEGAL_VERSION } from '@/constants/legal';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import {
  SubscriptionTier,
  TierCapabilities,
} from '@/lib/tiers';

const STORAGE_KEYS = {
  onboarded: 'porchivo_onboarded',
  tier: 'porchivo_tier',
  installedAt: 'porchivo_installed_at',
  referralCode: 'porchivo_referral_code',
  referralCreditUntil: 'porchivo_referral_credit_until',
  chimeId: 'porchivo_chime_id',
  theftShieldEnabled: 'porchivo_theft_shield',
} as const;

// HOA-provisioned model: all users have full access.
// No IAP, no subscriptions, no paywall.
const FULL_ACCESS_CAPABILITIES: TierCapabilities = {
  isAdFree: true,
  unlimitedPackages: true,
  fastPolling: true,
  outForDeliveryAlerts: true,
  customChimes: true,
  liveActivities: true,
  theftShield: true,
  householdSharing: true,
  maxMembers: 5,
  prioritySupport: true,
  porchPartnerAccess: true,
  taxInvoicing: true,
  communityDashboard: true,
  maxHouseholds: 250,
  trustEngine: true,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  // HOA-provisioned model — all users have full access
  const isPremium = true;
  const tier: SubscriptionTier = 'premium';
  const isEntitled = true;
  const isEntitlementLoading = false;

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
        queryClient.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // ── Versioned legal consent ───────────────────────────────────────────
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
    void (async () => {
      const [storedInstalled, storedReferral, storedChime, storedTheft] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.installedAt),
        AsyncStorage.getItem(STORAGE_KEYS.referralCreditUntil),
        AsyncStorage.getItem(STORAGE_KEYS.chimeId),
        AsyncStorage.getItem(STORAGE_KEYS.theftShieldEnabled),
      ]);
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
      queryClient.setQueryData(['profile', session?.user?.id], data);
    },
  });

  const completeOnboarding = useCallback(async (
    userData: Partial<User>,
    explicitSession?: Session | null,
  ) => {
    log('[AppContext] Completing onboarding with role:', userData.role);
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

  const signOut = useCallback(async () => {
    log('[AppContext] Signing out...');
    try {
      await supabase.auth.signOut({ scope: 'global' });
      await AsyncStorage.removeItem(STORAGE_KEYS.onboarded);
      setUser(null);
      setIsOnboarded(false);
      queryClient.clear();
      log('[AppContext] Sign out complete');
    } catch (err) {
      log('[AppContext] Sign out error');
      throw err;
    }
  }, [queryClient]);

  const deleteAccount = useCallback(async () => {
    if (!session?.user?.id) throw new Error('Not authenticated');
    log('[AppContext] Requesting account deletion (graceful)...');
    try {
      const { data, error } = await supabase.rpc('request_account_deletion');
      if (error) {
        log('[AppContext] Account deletion request error:', error.code);
        throw error;
      }
      const result = data as { success: boolean; error?: string; email?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'Account deletion request failed');
      }
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(STORAGE_KEYS.onboarded);
      setUser(null);
      setIsOnboarded(false);
      queryClient.clear();
      log('[AppContext] Account deletion requested successfully');
    } catch (err) {
      log('[AppContext] Account deletion error');
      throw err;
    }
  }, [session?.user?.id, queryClient]);

  const isHomeowner = useMemo(() => user?.role === 'homeowner' || user?.role === 'both', [user?.role]);
  const isPartner = useMemo(() => user?.role === 'partner' || user?.role === 'both', [user?.role]);

  const capabilities: TierCapabilities = FULL_ACCESS_CAPABILITIES;

  const daysSinceInstall = useMemo(() => {
    if (!installedAt) return 0;
    return Math.floor((Date.now() - installedAt) / (24 * 60 * 60 * 1000));
  }, [installedAt]);

  // No day-7 hard paywall in HOA-provisioned model
  const isDay7HardPaywall = false;

  const applyReferralCredit = useCallback(async (days: number = 30) => {
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

  // No-op stubs — IAP removed in HOA-provisioned model
  const purchasePlan = useCallback(async (): Promise<boolean> => {
    log('[AppContext] purchasePlan called — IAP removed (HOA-provisioned model)');
    return false;
  }, []);

  const upgradeToPremium = useCallback(async (): Promise<boolean> => {
    log('[AppContext] upgradeToPremium called — IAP removed (HOA-provisioned model)');
    return false;
  }, []);

  const restorePurchase = useCallback(async (): Promise<boolean> => {
    log('[AppContext] restorePurchase called — IAP removed (HOA-provisioned model)');
    return false;
  }, []);

  const syncEntitlement = useCallback(async () => {
    log('[AppContext] syncEntitlement called — no-op (HOA-provisioned model)');
  }, []);

  const redeemCode = useCallback(async (_code: string): Promise<boolean> => {
    log('[AppContext] redeemCode called — IAP removed (HOA-provisioned model)');
    return false;
  }, []);

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
    // HOA-provisioned model — no subscription state
    subscriptionStatus: null,
    currentPeriodEnd: null,
    cancelledAt: null,
    isLifetime: false,
    isEntitled,
    isEntitlementLoading,
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
    capabilities,
    installedAt,
    daysSinceInstall,
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
