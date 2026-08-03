import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useApp } from '@/store/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  RefreshCw,
  Trash2,
  TrendingUp,
  Eye,
  Sparkles,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { palette, type as typeScale, tabularNums } from '@/constants/theme';
import DarkRailHeader from '@/components/DarkRailHeader';
import RailBackButton from '@/components/RailBackButton';
import { useAnalytics } from '@/store/AnalyticsContext';
import { clearAnalytics, FunnelEvent, AnalyticsEvent } from '@/lib/analytics';

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  match: (e: AnalyticsEvent) => boolean;
}

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// SECURITY: Hardcoded admin user IDs. Only these Supabase user UUIDs may
// access this screen. Update this list with your own Supabase user ID.
// Find it in Supabase Dashboard → Authentication → Users.
const ADMIN_USER_IDS: readonly string[] = [
  'cbe389f7-364e-4ba7-bf45-c0ca8e1e166f',
] as const;

export default function AdminFunnelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, refresh } = useAnalytics();
  const { session, isLoading } = useApp();

  // SECURITY: Block access for non-admin users immediately.
  const isAdmin = !!session?.user?.id && ADMIN_USER_IDS.includes(session.user.id);

  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.selectionAsync().catch(() => {});
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onClear = useCallback(() => {
    Alert.alert(
      'Clear local funnel?',
      'This wipes the device-side event buffer. Remote rows in Supabase are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await clearAnalytics();
            await refresh();
          },
        },
      ],
    );
  }, [refresh]);

  const events = summary.events;

  const steps: FunnelStep[] = useMemo(() => {
    const has = (e: FunnelEvent) => events.filter((x) => x.event === e).length;
    return [
      { key: 'intro_view', label: 'Intro opened', count: has('intro_view'), match: (e) => e.event === 'intro_view' },
      { key: 'intro_complete', label: 'Intro finished', count: has('intro_complete'), match: (e) => e.event === 'intro_complete' },
      { key: 'role_selected', label: 'Role chosen', count: has('role_selected'), match: (e) => e.event === 'role_selected' },
      { key: 'onboarding_complete', label: 'Onboarding done', count: has('onboarding_complete'), match: (e) => e.event === 'onboarding_complete' },
      { key: 'paywall_view', label: 'Paywall viewed', count: has('paywall_view'), match: (e) => e.event === 'paywall_view' },
      { key: 'trial_start', label: 'Trial started', count: has('trial_start'), match: (e) => e.event === 'trial_start' },
      { key: 'purchase_success', label: 'Purchase success', count: has('purchase_success'), match: (e) => e.event === 'purchase_success' },
    ];
  }, [events]);

  const top = steps[0]?.count ?? 0;
  const paywall = summary.paywallViews;

  const onbDrop = useMemo(() => {
    const stepViews = events.filter((e) => e.event === 'onboarding_step_view');
    const stepDone = events.filter((e) => e.event === 'onboarding_step_complete');
    const byIndex: Record<number, { step: string; views: number; done: number; skipped: number }> = {};
    stepViews.forEach((e) => {
      const i = Number(e.props?.index ?? -1);
      const s = String(e.props?.step ?? 'unknown');
      if (!byIndex[i]) byIndex[i] = { step: s, views: 0, done: 0, skipped: 0 };
      byIndex[i].views += 1;
    });
    stepDone.forEach((e) => {
      const i = Number(e.props?.index ?? -1);
      const s = String(e.props?.step ?? 'unknown');
      if (!byIndex[i]) byIndex[i] = { step: s, views: 0, done: 0, skipped: 0 };
      byIndex[i].done += 1;
      if (e.props?.skipped === true) byIndex[i].skipped += 1;
    });
    return Object.entries(byIndex)
      .map(([k, v]) => ({ index: Number(k), ...v }))
      .sort((a, b) => a.index - b.index);
  }, [events]);

  const recent = useMemo(() => events.slice(-25).reverse(), [events]);

  // NOTE: All hooks above run unconditionally. Gating is done below so the
  // hook order stays stable while the session restores asynchronously
  // (chunked SecureStore reads). Returning early before the hooks above would
  // violate the Rules of Hooks and freeze this screen on the gate state.
  if (isLoading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.accessDenied}>
          <ActivityIndicator color={palette.railAccent} />
          <Text style={[styles.accessDeniedText, { marginTop: 12 }]}>Checking session…</Text>
        </View>
      </View>
    );
  }

  if (!session?.user?.id) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Authentication required.</Text>
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Access denied.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]} testID="admin-funnel-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <DarkRailHeader status="FUNNEL · LOCAL" dotColor={palette.railAccent} />
      <View style={styles.topBar}>
        <RailBackButton onPress={() => router.back()} testID="admin-funnel-back" />
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} testID="admin-funnel-refresh">
            <RefreshCw size={16} color={palette.railText} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={onClear} testID="admin-funnel-clear">
            <Trash2 size={16} color={palette.rose} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.railAccent} />}
        testID="admin-funnel-scroll"
      >
        <View style={styles.kpiRow}>
          <KpiTile icon={<Eye size={16} color={palette.navy} />} label="Paywall views" value={String(paywall)} />
          <KpiTile icon={<Sparkles size={16} color={palette.gold} />} label="Trial starts" value={String(summary.trialStarts)} />
          <KpiTile icon={<CreditCard size={16} color={palette.sage} />} label="Purchases" value={String(summary.purchases)} />
        </View>

        <View style={styles.conversionCard}>
          <View style={styles.conversionRow}>
            <TrendingUp size={18} color={palette.railAccent} />
            <Text style={styles.conversionLabel}>Paywall → Paid</Text>
            <Text style={styles.conversionValue}>{pct(summary.purchases, paywall)}</Text>
          </View>
          <View style={styles.conversionRow}>
            <TrendingUp size={18} color={palette.gold} />
            <Text style={styles.conversionLabel}>Trial → Paid</Text>
            <Text style={styles.conversionValue}>{pct(summary.purchases, summary.trialStarts)}</Text>
          </View>
        </View>

        <SectionTitle>Acquisition funnel</SectionTitle>
        <View style={styles.card}>
          {steps.map((s, i) => {
            const ratio = top > 0 ? s.count / top : 0;
            const dropFromPrev = i > 0 ? (steps[i - 1]?.count ?? 0) - s.count : 0;
            return (
              <View key={s.key} style={styles.funnelRow} testID={`funnel-step-${s.key}`}>
                <View style={styles.funnelHeader}>
                  <Text style={styles.funnelLabel}>{s.label}</Text>
                  <Text style={styles.funnelCount}>{s.count}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(2, ratio * 100)}%` }]} />
                </View>
                <View style={styles.funnelMeta}>
                  <Text style={styles.metaText}>{pct(s.count, top)} of top</Text>
                  {i > 0 && dropFromPrev > 0 ? (
                    <View style={styles.dropPill}>
                      <AlertTriangle size={11} color={palette.rose} />
                      <Text style={styles.dropText}>−{dropFromPrev}</Text>
                    </View>
                  ) : (
                    <View style={styles.holdPill}>
                      <CheckCircle2 size={11} color={palette.sage} />
                      <Text style={styles.holdText}>held</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <SectionTitle>Onboarding step drop-off</SectionTitle>
        <View style={styles.card}>
          {onbDrop.length === 0 ? (
            <Text style={styles.empty}>No onboarding events yet.</Text>
          ) : (
            onbDrop.map((s) => {
              const completion = s.views > 0 ? s.done / s.views : 0;
              return (
                <View key={`${s.index}-${s.step}`} style={styles.stepRow} testID={`step-${s.step}`}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.funnelLabel}>
                      {s.index + 1}. {s.step}
                    </Text>
                    <Text style={styles.funnelCount}>
                      {s.done}/{s.views}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(2, completion * 100)}%`,
                          backgroundColor: completion > 0.7 ? palette.sage : palette.gold,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.funnelMeta}>
                    <Text style={styles.metaText}>{pct(s.done, s.views)} completed</Text>
                    {s.skipped > 0 ? (
                      <Text style={styles.skipText}>{s.skipped} skipped</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <SectionTitle>Recent events</SectionTitle>
        <View style={styles.card}>
          {recent.length === 0 ? (
            <Text style={styles.empty}>No events captured yet.</Text>
          ) : (
            recent.map((e, i) => (
              <View key={`${e.ts}-${i}`} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName}>{e.event}</Text>
                  {e.props && Object.keys(e.props).length > 0 ? (
                    <Text style={styles.eventProps} numberOfLines={1}>
                      {JSON.stringify(e.props)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.eventTime}>{timeAgo(e.ts)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footnote}>
          Local device buffer (last {summary.events.length} events). Remote table writes are best-effort to
          {' '}<Text style={styles.code}>analytics_events</Text>.
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.kpiTile}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.railSurface,
    borderWidth: 1,
    borderColor: palette.railBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    borderColor: palette.rose,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.slate200,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    ...typeScale.title,
    color: palette.ink,
    ...tabularNums,
  },
  kpiLabel: {
    ...typeScale.caption,
    color: palette.slate500,
    marginTop: 2,
  },
  conversionCard: {
    backgroundColor: palette.railBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.railBorder,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conversionLabel: {
    flex: 1,
    color: palette.railTextMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
  },
  conversionValue: {
    color: palette.railText,
    fontSize: 18,
    fontWeight: '800' as const,
    ...tabularNums,
  },
  sectionTitle: {
    ...typeScale.overline,
    color: palette.slate500,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.slate200,
    padding: 14,
    marginBottom: 16,
    gap: 14,
  },
  funnelRow: {
    gap: 6,
  },
  stepRow: {
    gap: 6,
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  funnelLabel: {
    ...typeScale.body,
    color: palette.ink,
  },
  funnelCount: {
    ...typeScale.headline,
    color: palette.ink,
    ...tabularNums,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.slate100,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: palette.navy,
    borderRadius: 999,
  },
  funnelMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    ...typeScale.caption,
    color: palette.slate500,
  },
  dropPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.roseSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dropText: {
    color: palette.rose,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  holdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.sageSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  holdText: {
    color: palette.sage,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  skipText: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  empty: {
    ...typeScale.body,
    color: palette.slate500,
    textAlign: 'center',
    paddingVertical: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: palette.railAccent,
  },
  eventName: {
    ...typeScale.body,
    color: palette.ink,
    fontWeight: '600' as const,
  },
  eventProps: {
    ...typeScale.caption,
    color: palette.slate500,
  },
  eventTime: {
    ...typeScale.caption,
    color: palette.slate500,
    ...tabularNums,
  },
  footnote: {
    ...typeScale.caption,
    color: palette.slate500,
    textAlign: 'center',
    marginTop: 4,
  },
  code: {
    fontFamily: 'Courier',
    color: palette.slate700,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    ...typeScale.body,
    color: palette.slate500,
  },
});
