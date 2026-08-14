import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  HandHeart,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Bell,
  Crown,
  Lock,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette, radius, space, type as ttype, elevation } from '@/constants/theme';
import { usePackages } from '@/store/PackagesContext';
import { useAlerts } from '@/store/AlertsContext';
import { useNeighborhood } from '@/store/NeighborhoodContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { useDrivers } from '@/store/DriversContext';
import { calculatePorchRisk, RiskLevel, RiskResult } from '@/lib/porchRisk';
import { useApp } from '@/store/AppContext';
import { useAnalytics } from '@/store/AnalyticsContext';

const LEVEL_META: Record<RiskLevel, {
  label: string;
  headline: string;
  color: string;
  bg: string;
  Icon: typeof Shield;
}> = {
  low: {
    label: 'Low Porch Risk',
    headline: 'You’re in good shape for this delivery.',
    color: palette.sage,
    bg: palette.sageSoft,
    Icon: ShieldCheck,
  },
  medium: {
    label: 'Medium Porch Risk',
    headline: 'A few things could go wrong — let’s tighten the plan.',
    color: palette.gold,
    bg: palette.goldSoft,
    Icon: Shield,
  },
  high: {
    label: 'High Porch Risk',
    headline: 'High likelihood of porch trouble. Take action below.',
    color: palette.rose,
    bg: palette.roseSoft,
    Icon: ShieldAlert,
  },
};

export default function PorchRiskScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { packages, refreshAllPackages } = usePackages();
  const { alerts } = useAlerts();
  const { weekCount } = useNeighborhood();
  const { getHoldForPackage } = usePorchPartners();
  const { getDriverForPackage } = useDrivers();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllPackages();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllPackages]);
  const { capabilities } = useApp();
  const { track } = useAnalytics();
  // HOA-provisioned model — all users have full access.
  const showSoftGate = false;

  const pkg = useMemo(() => {
    if (id) return packages.find((p) => p.id === id) ?? null;
    return packages.find((p) => p.currentStatus === 'out_for_delivery')
      ?? packages.find((p) => p.currentStatus === 'shipped')
      ?? packages[0]
      ?? null;
  }, [id, packages]);

  const activeAlertCount = useMemo(
    () => alerts.filter((a) => a.status === 'active').length,
    [alerts],
  );

  const result = useMemo<RiskResult | null>(() => {
    if (!pkg) return null;
    const hasPartner = !!getHoldForPackage(pkg.id) || !!pkg.porchPartnerId;
    const hasDriver = !!getDriverForPackage(pkg.id) || !!pkg.driverId;
    return calculatePorchRisk({
      pkg,
      activeAlertCount,
      weekEvents: weekCount,
      hasPartner,
      hasDriver,
    });
  }, [pkg, activeAlertCount, weekCount, getHoldForPackage, getDriverForPackage]);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!result) return;
    Animated.timing(progress, {
      toValue: result.score / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [result, progress]);

  if (!pkg || !result) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Porch Risk' }} />
        <Shield size={36} color={palette.slate300} />
        <Text style={styles.emptyTitle}>No active deliveries</Text>
        <Text style={styles.emptyBody}>Add a package to see its porch risk.</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.replace('/add-package' as never)}
        >
          <Text style={styles.emptyBtnText}>Add a package</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = LEVEL_META[result.level];
  const Icon = meta.Icon;
  const fillColor = meta.color;

  const widthInterp = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const planActions: { id: string; label: string; sub: string; icon: React.ReactNode; onPress: () => void; show: boolean }[] = [
    {
      id: 'partner',
      label: 'Assign a Porch Partner',
      sub: 'Have a trusted neighbor hold the package.',
      icon: <HandHeart size={18} color={palette.ember} />,
      onPress: () => router.push({ pathname: '/package-detail' as never, params: { id: pkg.id } }),
      show: !pkg.porchPartnerId,
    },
    {
      id: 'driver',
      label: 'Assign a Driver',
      sub: 'Pick a courier for the last mile.',
      icon: <UserCheck size={18} color={palette.navy} />,
      onPress: () => router.push({ pathname: '/package-detail' as never, params: { id: pkg.id } }),
      show: !pkg.driverId,
    },
    {
      id: 'window',
      label: 'Set a delivery window',
      sub: 'Tell drivers the safest time to drop.',
      icon: <Clock size={18} color={palette.navy} />,
      onPress: () => router.push('/delivery-windows' as never),
      show: true,
    },
    {
      id: 'alerts',
      label: 'Turn on theft alerts',
      sub: 'Get pinged the moment something’s off.',
      icon: <Bell size={18} color={palette.gold} />,
      onPress: () => router.push({ pathname: '/notifications-permission' as never }),
      show: true,
    },
  ].filter((a) => a.show);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Porch Risk' }} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.navy} />}
      >
        <View style={[styles.heroCard, { backgroundColor: meta.bg }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: fillColor }]}>
              <Icon size={26} color={palette.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: fillColor }]}>{meta.label}</Text>
              <Text style={styles.heroHeadline}>{meta.headline}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNumber, { color: fillColor }]}>{result.score}</Text>
            <Text style={styles.scoreOver}>/100 risk</Text>
          </View>

          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                { width: widthInterp, backgroundColor: fillColor },
              ]}
            />
            <View style={[styles.barTick, { left: '35%' }]} />
            <View style={[styles.barTick, { left: '65%' }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabelLow}>Low</Text>
            <Text style={styles.barLabelMid}>Medium</Text>
            <Text style={styles.barLabelHigh}>High</Text>
          </View>

          <View style={styles.pkgPill}>
            <MapPin size={12} color={palette.slate500} />
            <Text style={styles.pkgPillText} numberOfLines={1}>
              {pkg.name} · {pkg.carrier}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What we&apos;re seeing</Text>
        <View style={styles.factorsCard}>
          {result.factors.map((f, i) => (
            <View
              key={f.id}
              style={[
                styles.factorRow,
                i < result.factors.length - 1 ? styles.factorDivider : null,
              ]}
            >
              <View
                style={[
                  styles.factorBullet,
                  {
                    backgroundColor: f.positive ? palette.sageSoft : palette.roseSoft,
                  },
                ]}
              >
                {f.positive ? (
                  <CheckCircle2 size={14} color={palette.sage} />
                ) : (
                  <AlertTriangle size={14} color={palette.rose} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.factorLabel}>{f.label}</Text>
                <Text style={styles.factorDetail}>{f.detail}</Text>
              </View>
              <Text
                style={[
                  styles.factorWeight,
                  { color: f.positive ? palette.sage : palette.rose },
                ]}
              >
                {f.positive ? '−' : '+'}
                {Math.abs(f.weight)}
              </Text>
            </View>
          ))}
        </View>

        {showSoftGate && (
          <TouchableOpacity
            style={styles.softGateCard}
            activeOpacity={0.9}
            onPress={() => {
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              track('theftshield_viewed', { source: 'porch_risk' });
              router.push('/porch-risk' as never);
            }}
            testID="risk-soft-gate"
          >
            <View style={styles.softGateGlow} />
            <View style={styles.softGateRow}>
              <View style={styles.softGateIcon}>
                <Crown size={18} color={palette.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.softGateTitleRow}>
                  <Text style={styles.softGateTitle}>Unlock Theft Shield</Text>
                  <View style={styles.softGateTrialPill}>
                    <Sparkles size={10} color={palette.gold} />
                    <Text style={styles.softGateTrialText}>7-day free trial</Text>
                  </View>
                </View>
                <Text style={styles.softGateBody}>
                  Real-time porch alerts, photo-on-delivery reminders, and priority routing — $13.99/mo or $99.99/yr.
                </Text>
              </View>
              <ChevronRight size={18} color={palette.slate500} />
            </View>
            <View style={styles.softGateLockedRow}>
              <View style={styles.softGateLockedItem}>
                <Lock size={11} color={palette.slate500} />
                <Text style={styles.softGateLockedText}>Geofenced alerts</Text>
              </View>
              <View style={styles.softGateLockedItem}>
                <Lock size={11} color={palette.slate500} />
                <Text style={styles.softGateLockedText}>Photo proof reminders</Text>
              </View>
              <View style={styles.softGateLockedItem}>
                <Lock size={11} color={palette.slate500} />
                <Text style={styles.softGateLockedText}>Priority routing</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {planActions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Secure plan for this delivery</Text>
            <View style={styles.planCard}>
              {planActions.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.planRow,
                    i < planActions.length - 1 ? styles.planDivider : null,
                  ]}
                  onPress={a.onPress}
                  activeOpacity={0.7}
                  testID={`risk-plan-${a.id}`}
                >
                  <View style={styles.planIcon}>{a.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planLabel}>{a.label}</Text>
                    <Text style={styles.planSub}>{a.sub}</Text>
                  </View>
                  <ChevronRight size={18} color={palette.slate300} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.allSetCard}>
            <CheckCircle2 size={20} color={palette.sage} />
            <Text style={styles.allSetText}>Your secure plan is locked in.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scroll: {
    padding: space.xl,
  },
  center: {
    flex: 1,
    backgroundColor: palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    gap: space.sm,
  },
  emptyTitle: {
    ...ttype.headline,
    color: palette.ink,
    marginTop: space.md,
  },
  emptyBody: {
    ...ttype.caption,
    color: palette.slate500,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: space.lg,
    backgroundColor: palette.navy,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  emptyBtnText: {
    color: palette.surface,
    fontWeight: '700' as const,
    fontSize: 14,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: space.xl,
    ...elevation.low,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  heroHeadline: {
    ...ttype.headline,
    color: palette.ink,
    lineHeight: 22,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: space.md,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  scoreOver: {
    fontSize: 14,
    color: palette.slate500,
    fontWeight: '600' as const,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: palette.slate100,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  barLabelLow: { fontSize: 11, color: palette.sage, fontWeight: '700' as const },
  barLabelMid: { fontSize: 11, color: palette.gold, fontWeight: '700' as const },
  barLabelHigh: { fontSize: 11, color: palette.rose, fontWeight: '700' as const },
  pkgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: space.lg,
    maxWidth: '100%',
  },
  pkgPillText: {
    fontSize: 12,
    color: palette.slate700,
    fontWeight: '600' as const,
  },
  sectionTitle: {
    ...ttype.headline,
    color: palette.ink,
    marginTop: space.xl,
    marginBottom: space.md,
    marginLeft: 4,
  },
  factorsCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    ...elevation.low,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
  },
  factorDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate100,
  },
  factorBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  factorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: palette.ink,
    marginBottom: 2,
  },
  factorDetail: {
    fontSize: 12,
    color: palette.slate500,
    lineHeight: 17,
  },
  factorWeight: {
    fontSize: 13,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  planCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    ...elevation.low,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  planDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate100,
  },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 1,
  },
  planSub: {
    fontSize: 12,
    color: palette.slate500,
  },
  allSetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: space.xl,
    backgroundColor: palette.sageSoft,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  allSetText: {
    fontSize: 14,
    color: palette.sage,
    fontWeight: '700' as const,
  },
  softGateCard: {
    marginTop: space.xl,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: palette.goldSoft,
    overflow: 'hidden',
    ...elevation.low,
  },
  softGateGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: palette.goldSoft,
    opacity: 0.7,
  },
  softGateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  softGateIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  softGateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  softGateTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: palette.ink,
  },
  softGateTrialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  softGateTrialText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: palette.gold,
    letterSpacing: 0.3,
  },
  softGateBody: {
    fontSize: 12,
    color: palette.slate500,
    lineHeight: 17,
  },
  softGateLockedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.slate100,
  },
  softGateLockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.canvas,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  softGateLockedText: {
    fontSize: 11,
    color: palette.slate500,
    fontWeight: '600' as const,
  },
});
