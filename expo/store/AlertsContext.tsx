import { useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { SuspiciousAlert, SuspiciousActivityCategory } from '@/types';
import { mockSuspiciousAlerts } from '@/mocks/suspiciousAlerts';
import { useApp } from '@/store/AppContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { scheduleLocalNotification } from '@/lib/notifications';
import { log } from "../lib/logger";

const BLOCKED_USERS_KEY = 'porchivo_blocked_users';

// ─── DB row shape ─────────────────────────────────────────────────────────

interface DbSuspiciousAlert {
  id: string;
  user_id: string;
  category: SuspiciousActivityCategory;
  description: string;
  photo_url: string | null;
  approximate_location: string;
  block_id: string;
  status: 'active' | 'resolved';
  resolved_at: string | null;
  muted_by_users: string[];
  reported_by_users: string[];
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function dbAlertToAlert(row: DbSuspiciousAlert): SuspiciousAlert {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    description: row.description,
    photoUrl: row.photo_url,
    approximateLocation: row.approximate_location,
    blockId: row.block_id,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    mutedByUsers: row.muted_by_users ?? [],
    reportedByUsers: row.reported_by_users ?? [],
  };
}

/**
 * Derive a neighbourhood block ID from a user's address string.
 * Uses zip code for grouping — neighbours in the same zip share the same feed.
 * Falls back to 'beta-1' so all beta testers without a saved address share one feed.
 */
function deriveBlockId(address: string): string {
  if (!address) return 'beta-1';
  const zipMatch = address.match(/\b(\d{5})\b/);
  return zipMatch ? `zip-${zipMatch[1]}` : 'beta-1';
}

// ─── Filter type ─────────────────────────────────────────────────────────

export type AlertFeedFilter = 'all' | 'active' | 'resolved';

// ─── Context ──────────────────────────────────────────────────────────────

export const [AlertsProvider, useAlerts] = createContextHook(() => {
  const { user, session } = useApp();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const [filter, setFilter] = useState<AlertFeedFilter>('all');
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  // Load blocked users from local storage (device-local privacy setting)
  useEffect(() => {
    void AsyncStorage.getItem(BLOCKED_USERS_KEY)
      .then((val) => {
        if (val) {
          try { setBlockedUserIds(JSON.parse(val)); }
          catch { /* ignore malformed data */ }
        }
      })
      .catch((e) => log('[AlertsContext] Error loading blocked users:', e));
  }, []);

  // Derive user's block ID from their saved address
  const blockId = useMemo(() => deriveBlockId(user?.address ?? ''), [user?.address]);

  // ── Fetch alerts from Supabase ────────────────────────────────────────

  const alertsQuery = useQuery({
    queryKey: ['suspicious_alerts', blockId, userId],
    queryFn: async (): Promise<SuspiciousAlert[]> => {
      if (!isSupabaseConfigured || !userId) {
        // Mock alerts are a DEV-ONLY convenience. Showing fake safety alerts to
        // real users would be a trust catastrophe for a neighborhood-safety app.
        if (__DEV__ && !isSupabaseConfigured) {
          log('[AlertsContext] DEV: Supabase not configured, using mock alerts');
          return mockSuspiciousAlerts;
        }
        return [];
      }

      log('[AlertsContext] Fetching alerts from Supabase...');
      const { data, error } = await supabase
        .from('suspicious_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        log('[AlertsContext] Alerts fetch error:', error.message);
        // Never substitute fake alerts for a failed fetch — throw so React Query
        // retries and the UI can show a real error/empty state.
        throw new Error('Failed to load alerts');
      }

      log('[AlertsContext] Fetched', data?.length ?? 0, 'alerts');
      return (data as DbSuspiciousAlert[]).map(dbAlertToAlert);
    },
    enabled: true,
    staleTime: 30_000,
  });

  const allAlerts = useMemo<SuspiciousAlert[]>(() => alertsQuery.data ?? [], [alertsQuery.data]);

  // ── Realtime subscription — live neighbourhood feed ───────────────────

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel('suspicious_alerts_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suspicious_alerts' },
        (payload) => {
          log('[AlertsContext] Realtime event:', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['suspicious_alerts'] });
        },
      )
      .subscribe((status) => {
        log('[AlertsContext] Realtime channel status:', status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // ── Filtered + sorted view ────────────────────────────────────────────

  const filteredAlerts = useMemo<SuspiciousAlert[]>(() => {
    const visible = allAlerts.filter((a) => !blockedUserIds.includes(a.userId));
    let filtered: SuspiciousAlert[];
    if (filter === 'active') {
      filtered = visible.filter((a) => a.status === 'active');
    } else if (filter === 'resolved') {
      filtered = visible.filter((a) => a.status === 'resolved');
    } else {
      filtered = visible;
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allAlerts, filter, blockedUserIds]);

  const activeCount = useMemo(
    () => allAlerts.filter((a) => a.status === 'active').length,
    [allAlerts],
  );

  // ── Mutations ─────────────────────────────────────────────────────────

  const changeFilter = useCallback((f: AlertFeedFilter) => {
    log('[AlertsContext] Filter changed to:', f);
    setFilter(f);
  }, []);

  const submitAlert = useCallback(async (
    category: SuspiciousActivityCategory,
    description: string,
    photoUrl: string | null,
  ): Promise<SuspiciousAlert | undefined> => {
    if (!user) return;
    log('[AlertsContext] Submitting new alert:', category);

    const approximateLocation = user.address
      ? `${user.address.split(' ').slice(0, 2).join(' ')} block`
      : '200 block';

    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase
        .from('suspicious_alerts')
        .insert({
          user_id: userId,
          category,
          description,
          photo_url: photoUrl,
          approximate_location: approximateLocation,
          block_id: blockId,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        log('[AlertsContext] Alert insert error:', error.message);
        // In production a failed safety report must NOT silently pretend to
        // succeed — the neighborhood would never actually see it.
        if (!__DEV__) return undefined;
        // DEV only: fall through to local optimistic update
      } else {
        log('[AlertsContext] Alert saved to Supabase:', data.id);
        void queryClient.invalidateQueries({ queryKey: ['suspicious_alerts'] });

        const alert = dbAlertToAlert(data as DbSuspiciousAlert);
        await scheduleLocalNotification(
          'Suspicious activity reported near your porch',
          `${getCategoryLabel(category)} — open Porchivo for details.`,
          { alertId: alert.id, type: 'suspicious_alert' },
          2,
        ).catch((e) => log('[AlertsContext] Notification error:', e));

        return alert;
      }
    }

    // DEV-only fallback: local optimistic alert (Supabase not configured or insert failed)
    if (!__DEV__) {
      log('[AlertsContext] Alert not saved — Supabase unavailable');
      return undefined;
    }
    const localAlert: SuspiciousAlert = {
      id: `alert-${Date.now()}`,
      userId: user.id,
      category,
      description,
      photoUrl,
      approximateLocation,
      blockId,
      status: 'active',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      mutedByUsers: [],
      reportedByUsers: [],
    };

    void queryClient.setQueryData(
      ['suspicious_alerts', blockId, userId],
      (prev: SuspiciousAlert[] | undefined) => [localAlert, ...(prev ?? [])],
    );

    await scheduleLocalNotification(
      'Suspicious activity reported near your porch',
      `${getCategoryLabel(category)} — open Porchivo for details.`,
      { alertId: localAlert.id, type: 'suspicious_alert' },
      2,
    ).catch((e) => log('[AlertsContext] Notification error:', e));

    return localAlert;
  }, [user, userId, blockId, queryClient]);

  const resolveAlert = useCallback(async (alertId: string) => {
    log('[AlertsContext] Resolving alert:', alertId);
    const resolvedAt = new Date().toISOString();

    // Optimistic update
    queryClient.setQueryData(
      ['suspicious_alerts', blockId, userId],
      (prev: SuspiciousAlert[] | undefined) =>
        (prev ?? []).map((a) =>
          a.id === alertId ? { ...a, status: 'resolved' as const, resolvedAt } : a,
        ),
    );

    if (isSupabaseConfigured && userId) {
      const { error } = await supabase
        .from('suspicious_alerts')
        .update({ status: 'resolved', resolved_at: resolvedAt })
        .eq('id', alertId)
        .eq('user_id', userId);

      if (error) {
        log('[AlertsContext] Resolve error:', error.message);
        void queryClient.invalidateQueries({ queryKey: ['suspicious_alerts'] });
      }
    }
  }, [blockId, userId, queryClient]);

  const muteAlert = useCallback(async (alertId: string) => {
    if (!user) return;
    log('[AlertsContext] Muting alert:', alertId);

    // Optimistic update
    queryClient.setQueryData(
      ['suspicious_alerts', blockId, userId],
      (prev: SuspiciousAlert[] | undefined) =>
        (prev ?? []).map((a) =>
          a.id === alertId
            ? { ...a, mutedByUsers: [...a.mutedByUsers, user.id] }
            : a,
        ),
    );

    if (isSupabaseConfigured && userId) {
      const { error } = await supabase.rpc('mute_alert', { p_alert_id: alertId });
      if (error) {
        log('[AlertsContext] Mute RPC error:', error.message);
        void queryClient.invalidateQueries({ queryKey: ['suspicious_alerts'] });
      }
    }
  }, [user, blockId, userId, queryClient]);

  const reportAbuse = useCallback(async (alertId: string) => {
    if (!user) return;
    log('[AlertsContext] Reporting abuse for alert:', alertId);

    // Optimistic update
    queryClient.setQueryData(
      ['suspicious_alerts', blockId, userId],
      (prev: SuspiciousAlert[] | undefined) =>
        (prev ?? []).map((a) =>
          a.id === alertId
            ? { ...a, reportedByUsers: [...a.reportedByUsers, user.id] }
            : a,
        ),
    );

    if (isSupabaseConfigured && userId) {
      const { error } = await supabase.rpc('report_alert_abuse', { p_alert_id: alertId });
      if (error) {
        log('[AlertsContext] Report RPC error:', error.message);
        void queryClient.invalidateQueries({ queryKey: ['suspicious_alerts'] });
      }
    }
  }, [user, blockId, userId, queryClient]);

  const isAlertMuted = useCallback((alertId: string) => {
    if (!user) return false;
    const alert = allAlerts.find((a) => a.id === alertId);
    return alert?.mutedByUsers.includes(user.id) ?? false;
  }, [allAlerts, user]);

  const isAlertReported = useCallback((alertId: string) => {
    if (!user) return false;
    const alert = allAlerts.find((a) => a.id === alertId);
    return alert?.reportedByUsers.includes(user.id) ?? false;
  }, [allAlerts, user]);

  const blockUser = useCallback(async (targetUserId: string) => {
    if (!targetUserId || blockedUserIds.includes(targetUserId)) return;
    log('[AlertsContext] Blocking user:', targetUserId);
    const updated = [...blockedUserIds, targetUserId];
    setBlockedUserIds(updated);
    await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(updated)).catch(
      (e) => log('[AlertsContext] Error saving blocked users:', e),
    );
  }, [blockedUserIds]);

  const unblockUser = useCallback(async (targetUserId: string) => {
    log('[AlertsContext] Unblocking user:', targetUserId);
    const updated = blockedUserIds.filter((id) => id !== targetUserId);
    setBlockedUserIds(updated);
    await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(updated)).catch(
      (e) => log('[AlertsContext] Error saving blocked users:', e),
    );
  }, [blockedUserIds]);

  const isUserBlocked = useCallback((targetUserId: string) => {
    return blockedUserIds.includes(targetUserId);
  }, [blockedUserIds]);

  return {
    alerts: filteredAlerts,
    filter,
    changeFilter,
    activeCount,
    submitAlert,
    resolveAlert,
    muteAlert,
    reportAbuse,
    isAlertMuted,
    isAlertReported,
    blockUser,
    unblockUser,
    isUserBlocked,
    blockedUserIds,
  };
});

// ─── Utility exports (used by alert screens) ──────────────────────────────

export function getCategoryLabel(category: SuspiciousActivityCategory): string {
  switch (category) {
    case 'suspicious_person': return 'Suspicious Person';
    case 'package_taken': return 'Package Taken';
    case 'unknown_vehicle': return 'Unknown Vehicle';
    case 'other': return 'Other';
  }
}

export function getCategoryColor(category: SuspiciousActivityCategory): { bg: string; fg: string } {
  switch (category) {
    case 'suspicious_person': return { bg: '#FFF3E0', fg: '#E65100' };
    case 'package_taken': return { bg: '#FFEBEE', fg: '#C62828' };
    case 'unknown_vehicle': return { bg: '#E8EAF6', fg: '#283593' };
    case 'other': return { bg: '#F3E5F5', fg: '#6A1B9A' };
  }
}
