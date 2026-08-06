import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { PorchPartner, PackageHold } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { scheduleLocalNotification } from '@/lib/notifications';
import { mockPorchPartners } from '@/mocks/porchPartners';
import { log } from "../lib/logger";

const HOLDS_KEY = 'porchivo_package_holds';

// ─── DB row shapes ─────────────────────────────────────────────────────────

interface DbPackageHold {
  id: string;
  package_id: string;
  partner_id: string;
  homeowner_id: string;
  homeowner_nickname: string;
  status: 'pending' | 'picked_up' | 'returned';
  picked_up_at: string | null;
  returned_at: string | null;
  assigned_at: string;
  package_size: string | null;
  rate_cents: number;
}

interface DbProfileRow {
  id: string;
  name: string;
  avatar_url: string | null;
  /** Street name only (house number stripped server-side by profile_public_view). */
  street: string | null;
  role: string;
  created_at: string;
}

interface DbPartnerPublicStats {
  user_id: string;
  completed_assignments: number;
  average_rating: number | null;
  tier: string;
  is_volunteer: boolean | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────

function dbProfileToPartner(
  row: DbProfileRow,
  v: DbPartnerPublicStats | undefined,
): PorchPartner {
  return {
    id: row.id,
    name: row.name || 'Porch Partner',
    avatarUrl: row.avatar_url,
    street: row.street ?? 'Nearby',
    distance: 0.1, // geolocation-based distance is a future enhancement
    completedHolds: v?.completed_assignments ?? 0,
    rating: v?.average_rating ? parseFloat(String(v.average_rating)) : 5.0,
    joinedAt: row.created_at,
    status: 'active',
    geoTier: 'tier3',
    isVolunteer: v?.is_volunteer ?? false,
  };
}

function dbHoldToHold(row: DbPackageHold): PackageHold {
  return {
    packageId: row.package_id,
    partnerId: row.partner_id,
    homeownerId: row.homeowner_id,
    homeownerNickname: row.homeowner_nickname,
    status: row.status,
    pickedUpAt: row.picked_up_at,
    returnedAt: row.returned_at,
    assignedAt: row.assigned_at,
    packageSize: (row.package_size as PackageHold['packageSize']) ?? undefined,
    rateCents: row.rate_cents,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────

export const [PorchPartnersProvider, usePorchPartners] = createContextHook(() => {
  const { session, user } = useApp();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // ── Partners list: real profiles from Supabase ────────────────────────

  const partnersQuery = useQuery({
    queryKey: ['porch_partners', userId],
    queryFn: async (): Promise<PorchPartner[]> => {
      if (!isSupabaseConfigured || !userId) {
        // Mock partners are DEV-ONLY. Real users must never see fake neighbors
        // offering to hold their packages — that is a trust/safety hazard.
        if (__DEV__ && !isSupabaseConfigured) {
          log('[PorchPartners] DEV: Supabase not configured, using mock data');
          return mockPorchPartners;
        }
        return [];
      }

      log('[PorchPartners] Fetching partners from Supabase...');
      // Cross-user reads go through the safe, non-PII view (profiles is
      // owner-only under hardened RLS). Street is house-number-stripped.
      const { data, error } = await supabase
        .from('profile_public_view')
        .select('id, name, avatar_url, street, role, created_at')
        .in('role', ['partner', 'both'])
        .neq('id', userId);

      if (error) {
        log('[PorchPartners] Partner fetch error:', error.message);
        // Never substitute fake partners on a failed fetch — throw so React
        // Query retries and the UI shows a real error/empty state.
        throw new Error('Failed to load partners');
      }

      const rows = (data ?? []) as DbProfileRow[];

      // Trust signals come from the safe, non-PII view (partner_verifications
      // itself is owner-only). One batched lookup keyed by user_id.
      const statsById = new Map<string, DbPartnerPublicStats>();
      if (rows.length > 0) {
        const { data: stats } = await supabase
          .from('partner_public_stats')
          .select('user_id, completed_assignments, average_rating, tier, is_volunteer')
          .in('user_id', rows.map((r) => r.id));
        for (const s of (stats ?? []) as DbPartnerPublicStats[]) {
          statsById.set(s.user_id, s);
        }
      }

      log('[PorchPartners] Fetched', rows.length, 'partners');
      return rows.map((r) => dbProfileToPartner(r, statsById.get(r.id)));
    },
    enabled: true,
    staleTime: 60_000,
  });

  // ── Package holds ─────────────────────────────────────────────────────

  const holdsQuery = useQuery({
    queryKey: ['package_holds', userId],
    queryFn: async (): Promise<PackageHold[]> => {
      if (!isSupabaseConfigured || !userId) {
        log('[PorchPartners] Loading holds from AsyncStorage (fallback)...');
        const stored = await AsyncStorage.getItem(HOLDS_KEY);
        return stored ? (JSON.parse(stored) as PackageHold[]) : [];
      }

      log('[PorchPartners] Fetching holds from Supabase...');
      const { data, error } = await supabase
        .from('package_holds')
        .select('*')
        .or(`homeowner_id.eq.${userId},partner_id.eq.${userId}`)
        .order('assigned_at', { ascending: false });

      if (error) {
        log('[PorchPartners] Holds fetch error:', error.message);
        const stored = await AsyncStorage.getItem(HOLDS_KEY);
        return stored ? (JSON.parse(stored) as PackageHold[]) : [];
      }

      log('[PorchPartners] Fetched', data?.length ?? 0, 'holds');
      return (data as DbPackageHold[]).map(dbHoldToHold);
    },
    enabled: true,
    refetchOnWindowFocus: true,
  });

  const partners = useMemo<PorchPartner[]>(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const holds = useMemo<PackageHold[]>(() => holdsQuery.data ?? [], [holdsQuery.data]);

  const activePartners = useMemo(() => partners.filter((p) => p.status === 'active'), [partners]);

  // ── Realtime subscription for holds ──────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`package_holds_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'package_holds' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['package_holds', userId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // ── Mutations ─────────────────────────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: async (hold: PackageHold) => {
      if (!isSupabaseConfigured) {
        const stored = await AsyncStorage.getItem(HOLDS_KEY);
        const existing: PackageHold[] = stored ? JSON.parse(stored) : [];
        const updated = [...existing.filter((h) => h.packageId !== hold.packageId), hold];
        await AsyncStorage.setItem(HOLDS_KEY, JSON.stringify(updated));
        return;
      }

      const { error } = await supabase.from('package_holds').upsert({
        package_id: hold.packageId,
        partner_id: hold.partnerId,
        homeowner_id: hold.homeownerId,
        homeowner_nickname: hold.homeownerNickname,
        status: hold.status,
        assigned_at: hold.assignedAt,
        package_size: hold.packageSize ?? null,
        rate_cents: hold.rateCents ?? 0,
      }, { onConflict: 'package_id,homeowner_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['package_holds', userId] });
    },
  });

  const updateHoldMutation = useMutation({
    mutationFn: async ({ packageId, updates }: { packageId: string; updates: Partial<DbPackageHold> }) => {
      if (!isSupabaseConfigured) {
        const stored = await AsyncStorage.getItem(HOLDS_KEY);
        const existing: PackageHold[] = stored ? JSON.parse(stored) : [];
        const updated = existing.map((h) =>
          h.packageId === packageId ? { ...h, ...updates } : h
        );
        await AsyncStorage.setItem(HOLDS_KEY, JSON.stringify(updated));
        return;
      }

      const { error } = await supabase
        .from('package_holds')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('package_id', packageId)
        .eq('homeowner_id', userId ?? '');

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['package_holds', userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (packageId: string) => {
      if (!isSupabaseConfigured) {
        const stored = await AsyncStorage.getItem(HOLDS_KEY);
        const existing: PackageHold[] = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(HOLDS_KEY, JSON.stringify(existing.filter((h) => h.packageId !== packageId)));
        return;
      }

      const { error } = await supabase
        .from('package_holds')
        .delete()
        .eq('package_id', packageId)
        .eq('homeowner_id', userId ?? '');

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['package_holds', userId] });
    },
  });

  // ── Public API ────────────────────────────────────────────────────────

  const getPartnerById = useCallback(
    (id: string): PorchPartner | undefined => partners.find((p) => p.id === id),
    [partners],
  );

  const assignPartnerToPackage = useCallback(
    (packageId: string, partnerId: string, homeownerId: string, homeownerNickname: string) => {
      log('[PorchPartners] Assigning partner', partnerId, 'to package', packageId);

      const newHold: PackageHold = {
        packageId,
        partnerId,
        homeownerId,
        homeownerNickname,
        status: 'pending',
        pickedUpAt: null,
        returnedAt: null,
        assignedAt: new Date().toISOString(),
      };

      assignMutation.mutate(newHold);

      const partner = partners.find((p) => p.id === partnerId);
      if (partner) {
        scheduleLocalNotification(
          'Porch Partner Assigned',
          `${partner.name} will hold your package when it arrives.`,
          { packageId, partnerId },
          1,
        ).catch((e) => log('[PorchPartners] Notification error:', e));
      }
    },
    [partners, assignMutation],
  );

  const unassignPartnerFromPackage = useCallback(
    (packageId: string) => {
      log('[PorchPartners] Unassigning partner from package', packageId);
      deleteMutation.mutate(packageId);
    },
    [deleteMutation],
  );

  const markPickedUp = useCallback(
    (packageId: string) => {
      log('[PorchPartners] Marking package picked up:', packageId);
      updateHoldMutation.mutate({
        packageId,
        updates: {
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
        },
      });

      scheduleLocalNotification(
        'Package Picked Up',
        'Your Porch Partner picked up your package from the porch.',
        { packageId, type: 'partner_pickup' },
        1,
      ).catch((e) => log('[PorchPartners] Notification error:', e));
    },
    [updateHoldMutation],
  );

  const markReturned = useCallback(
    (packageId: string) => {
      log('[PorchPartners] Marking package returned:', packageId);
      const hold = holds.find((h) => h.packageId === packageId);

      updateHoldMutation.mutate({
        packageId,
        updates: {
          status: 'returned',
          returned_at: new Date().toISOString(),
        },
      });

      // Increment partner's completed_assignments counter in Supabase
      if (hold?.partnerId && isSupabaseConfigured) {
        void supabase
          .rpc('increment_partner_completed_holds', { p_partner_id: hold.partnerId })
          .then(({ error }) => {
            if (error) log('[PorchPartners] increment_partner_completed_holds error:', error.message);
            else void queryClient.invalidateQueries({ queryKey: ['porch_partners', userId] });
          });
      }

      scheduleLocalNotification(
        'Package Returned',
        'Your package has been returned to you by your Porch Partner.',
        { packageId, type: 'partner_returned' },
        1,
      ).catch((e) => log('[PorchPartners] Notification error:', e));
    },
    [holds, updateHoldMutation, userId, queryClient],
  );

  const getHoldForPackage = useCallback(
    (packageId: string): PackageHold | undefined => holds.find((h) => h.packageId === packageId),
    [holds],
  );

  const getHoldsForPartner = useCallback(
    (partnerId: string): PackageHold[] => holds.filter((h) => h.partnerId === partnerId),
    [holds],
  );

  const activeHoldsForPartner = useCallback(
    (partnerId: string): PackageHold[] =>
      holds.filter((h) => h.partnerId === partnerId && (h.status === 'pending' || h.status === 'picked_up')),
    [holds],
  );

  const completedHoldsForPartner = useCallback(
    (partnerId: string): PackageHold[] =>
      holds.filter((h) => h.partnerId === partnerId && h.status === 'returned'),
    [holds],
  );

  return {
    partners,
    activePartners,
    holds,
    isLoading: partnersQuery.isLoading || holdsQuery.isLoading,
    getPartnerById,
    assignPartnerToPackage,
    unassignPartnerFromPackage,
    markPickedUp,
    markReturned,
    getHoldForPackage,
    getHoldsForPartner,
    activeHoldsForPartner,
    completedHoldsForPartner,
  };
});
