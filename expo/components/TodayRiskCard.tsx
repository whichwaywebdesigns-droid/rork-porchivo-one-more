import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Shield, ShieldAlert, ShieldCheck, Crown, Package } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radius, space, type as ttype } from '@/constants/theme';
import { calculatePorchRisk, pickNextInboundPackage, RiskLevel } from '@/lib/porchRisk';
import { usePackages } from '@/store/PackagesContext';
import { useAlerts } from '@/store/AlertsContext';
import { useNeighborhood } from '@/store/NeighborhoodContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { useDrivers } from '@/store/DriversContext';
import { useApp } from '@/store/AppContext';

const LEVEL_META: Record<RiskLevel, {
  label: string;
  color: string;
  bg: string;
  glow: string;
  Icon: typeof Shield;
}> = {
  low: {
    label: 'Low risk',
    color: palette.successGreen,
    bg: palette.successGlow,
    glow: 'rgba(68,255,136,0.08)',
    Icon: ShieldCheck,
  },
  medium: {
    label: 'Medium risk',
    color: palette.gold,
    bg: palette.goldGlow,
    glow: 'rgba(232,200,74,0.08)',
    Icon: Shield,
  },
  high: {
    label: 'High risk',
    color: palette.danger,
    bg: palette.dangerGlow,
    glow: 'rgba(255,68,68,0.08)',
    Icon: ShieldAlert,
  },
};

function formatEta(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TodayRiskCard() {
  const router = useRouter();
  const { packages } = usePackages();
  const { alerts } = useAlerts();
  const { weekCount } = useNeighborhood();
  const { getHoldForPackage } = usePorchPartners();
  const { getDriverForPackage } = useDrivers();
  const showSoftGate = false;

  const pkg = useMemo(() => pickNextInboundPackage(packages), [packages]);

  const activeAlertCount = useMemo(
    () => alerts.filter((a) => a.status === 'active').length,
    [alerts],
  );

  const result = useMemo(() => {
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

  if (!pkg) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push('/add-package' as any)}
        testID="today-risk-card-empty"
        accessibilityRole="button"
        accessibilityLabel="Add a package to see your porch risk"
      >
        <View style={styles.emptyRow}>
          <View style={[styles.iconWrap, { backgroundColor: palette.bgElevated }]}>
            <Package size={20} color={palette.textMuted} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Today's risk</Text>
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptyBody}>Add a package to start scoring your porch risk.</Text>
          </View>
          <ChevronRight size={16} color={palette.textMuted} />
        </View>
      </TouchableOpacity>
    );
  }

  if (!result) return null;

  const meta = LEVEL_META[result.level];
  const Icon = meta.Icon;

  const widthInterp = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handlePress = () => {
    router.push({ pathname: '/porch-risk' as const, params: { id: pkg.id } });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={handlePress}
      testID="today-risk-card"
      accessibilityRole="button"
      accessibilityLabel={`Today's risk for ${pkg.name}: ${meta.label}, ${result.score} out of 100`}
    >
      {/* Ambient color wash from risk level */}
      <LinearGradient
        colors={[meta.glow, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Icon size={22} color={meta.color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Today's risk</Text>
          <Text style={styles.title} numberOfLines={1}>
            {pkg.name}
          </Text>
          <Text style={styles.eta} numberOfLines={1}>
            {pkg.carrier} · {formatEta(pkg.expectedDeliveryDate)}
          </Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={[styles.scoreNum, { color: meta.color }]}>{result.score}</Text>
          <Text style={styles.scoreOver}>/100</Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { width: widthInterp, backgroundColor: meta.color }]}
        />
        <View style={[styles.barTick, { left: '35%' }]} />
        <View style={[styles.barTick, { left: '65%' }]} />
      </View>

      <View style={styles.footer}>
        <View style={[styles.levelChip, { backgroundColor: meta.bg, borderColor: `${meta.color}30` }]}>
          <Text style={[styles.levelChipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Secure plan</Text>
          <ChevronRight size={15} color={palette.accent} strokeWidth={2.5} />
        </View>
      </View>

      {showSoftGate && (
        <TouchableOpacity
          style={styles.softGate}
          activeOpacity={0.85}
          onPress={() => router.push('/upgrade?trigger=theft_shield' as any)}
          testID="today-risk-soft-gate"
          accessibilityRole="button"
          accessibilityLabel="Unlock Theft Shield"
        >
          <Crown size={11} color={palette.accent} />
          <Text style={styles.softGateText}>Unlock Theft Shield — 7-day free trial</Text>
          <ChevronRight size={11} color={palette.accent} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: palette.borderDark,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    ...ttype.micro,
    color: palette.textMuted,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    letterSpacing: -0.2,
  },
  eta: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
    fontWeight: '500' as const,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  scoreNum: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  scoreOver: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600' as const,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.bgElevated,
    overflow: 'hidden',
    position: 'relative' as const,
    marginBottom: space.md,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barTick: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: palette.bgSurface,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  levelChipText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.accent,
  },
  softGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: palette.borderDark,
  },
  softGateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.accent,
    letterSpacing: 0.2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: 2,
  },
  emptyBody: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 17,
  },
});
