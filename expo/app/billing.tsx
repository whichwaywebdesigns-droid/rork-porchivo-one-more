/**
 * Billing.tsx — Porchivo plan management screen
 *
 * Psychological design architecture:
 *  • Identity-first hero: "You're a Porchivo Premium Member" — not "Subscription: Active"
 *  • Gold color = earned achievement (highest satisfaction trigger in subscription UX research)
 *  • Staggered feature entrance: each chip delivers its own micro-dopamine hit
 *  • Cancellation state uses warm amber (urgency without alarm), never red
 *  • Copy is present-tense active: "protecting your porch right now"
 *  • Expired state is calm and comeback-focused, not punishing
 *  • All 8 required billing states handled explicitly
 *
 * Source of truth: user_entitlement view (backend-confirmed via revenuecat-webhook)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  ShieldCheck,
  Zap,
  Bell,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Clock,
  HandCoins,
  Music,
  Sparkles,
  FileText,
  Infinity as InfinityIcon,
  BadgeCheck,
  Users,
  XCircle,
  ChevronRight,
  RotateCcw,
  Package,
  Building2,
  Wifi,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette, space, radius, type as typeSizes, tabularNums } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import DarkRailHeader from '@/components/DarkRailHeader';
import RailBackButton from '@/components/RailBackButton';
import { SubscriptionStatus } from '@/types/database';
import { SubscriptionTier } from '@/lib/tiers';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useToast } from '@/hooks/useToast';

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingState =
  | 'loading'
  | 'active'
  | 'lifetime'
  | 'trial'
  | 'cancelling'       // cancelled but still entitled (access until period end)
  | 'expired'
  | 'billing_issue'
  | 'free'
  | 'unavailable';     // error / sync needed

interface HeroConfig {
  gradientColors: [string, string, string];
  accentColor: string;
  iconColor: string;
  statusText: string;
  statusBg: string;
  statusTextColor: string;
  headline: string;
  subheadline: string;
  dotColor: string;
}

interface FeatureDef {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  tier: SubscriptionTier[];
}

// ─── Feature definitions (tier-gated) ────────────────────────────────────────

const ALL_FEATURES: FeatureDef[] = [
  { icon: ShieldCheck, label: 'Theft Shield active — risk-scored before every drop', tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Zap,         label: 'Live tracking refreshed every 90 seconds',             tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Bell,        label: 'Instant alerts — out-for-delivery and delivered',       tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Package,     label: 'Unlimited packages — every carrier, no cap',           tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: HandCoins,   label: 'Porch Partner marketplace — hire a trusted neighbor',  tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: FileText,    label: 'Tax invoicing — quarterly and annual PDFs',             tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Music,       label: 'Custom delivery chimes',                                tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Sparkles,    label: 'Widgets and Live Activities on iPhone',                 tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: BadgeCheck,  label: 'Zero ads — clean and fast, always',                    tier: ['premium', 'family', 'enterprise', 'lifetime'] },
  { icon: Users,       label: 'Family sharing — every household member covered',      tier: ['family', 'enterprise', 'lifetime'] },
  { icon: Building2,   label: 'Community dashboard — HOA-wide theft patterns',        tier: ['enterprise'] },
  { icon: Wifi,        label: 'Community theft network — one alert reaches all homes', tier: ['enterprise'] },
  { icon: ShieldCheck, label: 'WhichWay Trust Engine — continuous compliance automation',  tier: ['enterprise'] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateLong(isoStr: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function daysUntil(isoStr: string | null): number {
  if (!isoStr) return 0;
  try {
    const d = new Date(isoStr);
    const now = new Date();
    return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function tierLabel(tier: SubscriptionTier): string {
  switch (tier) {
    case 'premium':    return 'Premium';
    case 'family':     return 'Family Plan';
    case 'enterprise': return 'HOA Enterprise';
    case 'lifetime':   return 'Lifetime';
    default:           return 'Free';
  }
}

function tierFullName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'premium':    return 'Porchivo Premium';
    case 'family':     return 'Porchivo Family';
    case 'enterprise': return 'Porchivo HOA Enterprise';
    case 'lifetime':   return 'Porchivo Lifetime';
    default:           return 'Porchivo Free';
  }
}

function resolveBillingState(params: {
  isEntitlementLoading: boolean;
  isEntitled: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  isLifetime: boolean;
  tier: SubscriptionTier;
  currentPeriodEnd: string | null;
}): BillingState {
  const { isEntitlementLoading, isEntitled, subscriptionStatus, isLifetime, tier, currentPeriodEnd } = params;
  if (isEntitlementLoading) return 'loading';
  if (tier === 'free' && !isEntitled) return 'free';
  if (isLifetime) return 'lifetime';
  if (!subscriptionStatus) {
    // RC SDK says entitled but no backend row yet (just purchased)
    return isEntitled ? 'active' : 'free';
  }
  switch (subscriptionStatus) {
    case 'active':
      return 'active';
    case 'cancelled':
      // Cancelled but still entitled = access continues until period end
      return isEntitled ? 'cancelling' : 'expired';
    case 'expired':
      return 'expired';
    case 'billing_issue':
    case 'grace_period':
      return 'billing_issue';
    case 'paused':
      return 'expired'; // treat paused as expired from access standpoint
    default:
      return isEntitled ? 'active' : 'unavailable';
  }
}

function getHeroConfig(state: BillingState, tier: SubscriptionTier, currentPeriodEnd: string | null): HeroConfig {
  const days = daysUntil(currentPeriodEnd);
  const dateStr = formatDateLong(currentPeriodEnd);

  switch (state) {
    case 'lifetime':
      return {
        gradientColors: ['#1A2B4A', '#12203A', '#0A1428'] as [string, string, string],
        accentColor: palette.gold,
        iconColor: palette.gold,
        statusText: 'LIFETIME MEMBER',
        statusBg: 'rgba(200, 148, 30, 0.18)',
        statusTextColor: palette.gold,
        headline: `${tierFullName(tier)}`,
        subheadline: 'Your porch is protected forever.',
        dotColor: palette.gold,
      };

    case 'active':
      return {
        gradientColors: ['#1A2B4A', '#122238', '#0D1B2E'] as [string, string, string],
        accentColor: palette.gold,
        iconColor: palette.gold,
        statusText: 'ACTIVE',
        statusBg: 'rgba(30, 156, 106, 0.18)',
        statusTextColor: palette.successGreen,
        headline: `${tierFullName(tier)} Member`,
        subheadline: currentPeriodEnd
          ? `Renewing on ${dateStr}`
          : 'Full access active',
        dotColor: palette.successGreen,
      };

    case 'trial':
      return {
        gradientColors: ['#1A2B4A', '#122238', '#0D1B2E'] as [string, string, string],
        accentColor: '#4A8FE8',
        iconColor: '#4A8FE8',
        statusText: `TRIAL — ${days} DAYS LEFT`,
        statusBg: 'rgba(74, 143, 232, 0.18)',
        statusTextColor: '#4A8FE8',
        headline: `${tierFullName(tier)} Trial`,
        subheadline: `Full access until ${dateStr}`,
        dotColor: '#4A8FE8',
      };

    case 'cancelling':
      return {
        gradientColors: ['#2A1E0A', '#1F1608', '#160F04'] as [string, string, string],
        accentColor: palette.gold,
        iconColor: palette.gold,
        statusText: 'CANCELS AT PERIOD END',
        statusBg: 'rgba(200, 148, 30, 0.18)',
        statusTextColor: palette.gold,
        headline: 'Your access continues',
        subheadline: days > 0
          ? `Protected for ${days} more ${days === 1 ? 'day' : 'days'} — until ${dateStr}`
          : `Access ended ${dateStr}`,
        dotColor: palette.gold,
      };

    case 'billing_issue':
      return {
        gradientColors: ['#2A1208', '#200D04', '#180900'] as [string, string, string],
        accentColor: palette.warmOrange,
        iconColor: palette.warmOrange,
        statusText: 'PAYMENT NEEDS ATTENTION',
        statusBg: 'rgba(232, 98, 42, 0.18)',
        statusTextColor: palette.warmOrange,
        headline: 'Action required',
        subheadline: 'Update your payment method to keep your porch protected.',
        dotColor: palette.warmOrange,
      };

    case 'expired':
      return {
        gradientColors: ['#151D30', '#101828', '#0A1020'] as [string, string, string],
        accentColor: palette.slate500,
        iconColor: '#8099B8',
        statusText: 'SUBSCRIPTION ENDED',
        statusBg: 'rgba(107, 127, 153, 0.15)',
        statusTextColor: '#8099B8',
        headline: 'Your subscription ended',
        subheadline: 'Renew to restore full protection.',
        dotColor: '#8099B8',
      };

    case 'free':
      return {
        gradientColors: ['#1A2B4A', '#122238', '#0D1B2E'] as [string, string, string],
        accentColor: '#4A8FE8',
        iconColor: '#4A8FE8',
        statusText: 'FREE PLAN',
        statusBg: 'rgba(74, 143, 232, 0.15)',
        statusTextColor: '#4A8FE8',
        headline: 'Upgrade to Porchivo Premium',
        subheadline: 'Full Theft Shield, live tracking, and the Porch Partner marketplace.',
        dotColor: '#4A8FE8',
      };

    default: // unavailable / loading fallback
      return {
        gradientColors: ['#1A2B4A', '#122238', '#0D1B2E'] as [string, string, string],
        accentColor: '#4A8FE8',
        iconColor: '#4A8FE8',
        statusText: 'STATUS UNAVAILABLE',
        statusBg: 'rgba(74, 143, 232, 0.12)',
        statusTextColor: '#6B7F99',
        headline: 'Billing status unavailable',
        subheadline: 'Tap Sync to refresh your subscription status.',
        dotColor: '#6B7F99',
      };
  }
}

function getHeroIcon(state: BillingState): React.ComponentType<{ size: number; color: string }> {
  switch (state) {
    case 'lifetime': return Crown;
    case 'active':   return Crown;
    case 'trial':    return Clock;
    case 'cancelling': return Clock;
    case 'billing_issue': return AlertTriangle;
    case 'expired':  return XCircle;
    case 'free':     return ShieldCheck;
    default:         return RefreshCw;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FeatureChipProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  active: boolean;
  accentColor: string;
  animValue: Animated.Value;
}

function FeatureChip({ icon: Icon, label, active, accentColor, animValue }: FeatureChipProps) {
  return (
    <Animated.View
      style={[
        styles.featureChip,
        {
          opacity: animValue,
          transform: [{ translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <View style={[styles.featureIconWrap, { backgroundColor: active ? `${accentColor}18` : 'rgba(107,127,153,0.10)' }]}>
        <Icon size={16} color={active ? accentColor : '#4A5F7A'} />
      </View>
      <Text style={[styles.featureLabel, { color: active ? '#C8D8F0' : '#4A5F7A' }]} numberOfLines={1}>{label}</Text>
      {active ? (
        <CheckCircle2 size={14} color={accentColor} style={styles.featureCheck} />
      ) : (
        <XCircle size={14} color="#2A3A52" style={styles.featureCheck} />
      )}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { track } = useAnalytics();
  const toast = useToast();
  const {
    tier,
    isPremium,
    subscriptionStatus,
    currentPeriodEnd,
    cancelledAt,
    isLifetime,
    isEntitled,
    isEntitlementLoading,
    syncEntitlement,
    restorePurchase,
  } = useApp();

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Derive clean billing state
  const billingState: BillingState = resolveBillingState({
    isEntitlementLoading,
    isEntitled,
    subscriptionStatus,
    isLifetime,
    tier,
    currentPeriodEnd,
  });

  const hero = getHeroConfig(billingState, tier, currentPeriodEnd);
  const HeroIcon = getHeroIcon(billingState);

  // Features visible for this tier
  const tierFeatures = ALL_FEATURES.filter((f) => f.tier.includes(tier === 'free' ? 'premium' : tier));
  const featureAnims = useRef<Animated.Value[]>(
    ALL_FEATURES.map(() => new Animated.Value(0))
  ).current;

  // Mount animations
  const mountAnim   = useRef(new Animated.Value(0)).current;
  const heroScale   = useRef(new Animated.Value(0.88)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const sectionAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    track('billing_screen_view', { billingState, tier });

    // Hero entrance
    Animated.parallel([
      Animated.timing(mountAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(heroScale,  { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    // Staggered features
    const featureDelay = 480;
    const staggered = featureAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        delay: featureDelay + i * 65,
        useNativeDriver: true,
      })
    );
    Animated.parallel(staggered).start();

    // Section fade
    Animated.timing(sectionAnim, { toValue: 1, duration: 440, delay: 360, useNativeDriver: true }).start();

    // Status pulse loop for active/lifetime
    if (billingState === 'active' || billingState === 'lifetime') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.22, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManageSubscription = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('billing_manage_tap', { platform: Platform.OS });
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions?package=app.rork.porchivo_neighborhood_safety';
    Linking.openURL(url).catch(() =>
      toast.error('Couldn’t open subscription settings. Manage your plan in your device Settings.')
    );
  }, [track, toast]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsSyncing(true);
    track('billing_sync_tap');
    try {
      await syncEntitlement();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success('Billing status refreshed.');
    } catch {
      toast.error('Couldn’t refresh billing status. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncEntitlement, track, toast]);

  const handleRestore = useCallback(async () => {
    if (isRestoring) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsRestoring(true);
    track('billing_restore_tap');
    try {
      const ok = await restorePurchase();
      Haptics.notificationAsync(
        ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      ).catch(() => {});
      if (ok) {
        toast.success('Your subscription has been restored.');
      } else {
        toast.info("No previous purchase found for this account. Contact support if this seems wrong.", { duration: 4500 });
      }
    } catch {
      toast.error('Restore failed. Something went wrong — please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, restorePurchase, track, toast]);

  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track('billing_upgrade_tap', { from: billingState });
    router.push('/org-signup' as any);
  }, [router, billingState, track]);

  const handleTrustEngine = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('trust_engine_view', { source: 'billing' });
    router.push('/trust-engine' as any);
  }, [router, track]);

  const handleResubscribe = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track('billing_resubscribe_tap');
    router.push('/org-signup' as any);
  }, [router, track]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderStatusDot = () => (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={[styles.statusDot, { backgroundColor: hero.dotColor }]} />
    </Animated.View>
  );

  const renderSkeletonCard = () => (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: '40%', height: 12, marginBottom: 14 }]} />
      <View style={[styles.skeletonLine, { width: '70%', height: 24, marginBottom: 10 }]} />
      <View style={[styles.skeletonLine, { width: '55%', height: 15 }]} />
    </View>
  );

  const renderHero = () => (
    <Animated.View style={{ opacity: heroOpacity, transform: [{ scale: heroScale }] }}>
      <LinearGradient
        colors={hero.gradientColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.heroCard}
      >
        {/* Radial glow overlay */}
        <View style={[styles.heroGlow, { backgroundColor: `${hero.accentColor}08` }]} />

        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: hero.statusBg, borderColor: `${hero.accentColor}30` }]}>
          {renderStatusDot()}
          <Text style={[styles.statusPillText, { color: hero.statusTextColor }]}>{hero.statusText}</Text>
        </View>

        {/* Icon + headline */}
        <View style={styles.heroIconContainer}>
          <View style={[styles.heroIconRing, { borderColor: `${hero.accentColor}30` }]}>
            <View style={[styles.heroIconBg, { backgroundColor: `${hero.accentColor}18` }]}>
              <HeroIcon size={38} color={hero.iconColor} />
            </View>
          </View>
        </View>

        <Text style={styles.heroHeadline}>{hero.headline}</Text>
        <Text style={styles.heroSubheadline}>{hero.subheadline}</Text>

        {/* Cancelling: days-remaining bar */}
        {billingState === 'cancelling' && currentPeriodEnd && (() => {
          const days = daysUntil(currentPeriodEnd);
          const totalDays = 30; // show ~30d window
          const pct = Math.max(0, Math.min(1, days / totalDays));
          return (
            <View style={styles.timeBarTrack}>
              <View style={[styles.timeBarFill, {
                width: `${pct * 100}%` as `${number}%`,
                backgroundColor: pct > 0.4 ? palette.gold : palette.warmOrange,
              }]} />
              <Text style={styles.timeBarLabel}>{days} {days === 1 ? 'day' : 'days'} remaining</Text>
            </View>
          );
        })()}
      </LinearGradient>
    </Animated.View>
  );

  const renderBillingDetails = () => {
    if (billingState === 'loading' || billingState === 'free') return null;

    const rows: Array<{ label: string; value: string }> = [];

    if (billingState !== 'lifetime') {
      rows.push({ label: 'Plan', value: tierLabel(tier) });
    }

    if (currentPeriodEnd && (billingState === 'active' || billingState === 'trial')) {
      rows.push({ label: 'Renews on', value: formatDateLong(currentPeriodEnd) });
    }
    if (currentPeriodEnd && billingState === 'cancelling') {
      rows.push({ label: 'Access ends', value: formatDateLong(currentPeriodEnd) });
    }
    if (cancelledAt && billingState === 'cancelling') {
      rows.push({ label: 'Cancelled on', value: formatDateLong(cancelledAt) });
    }
    if (billingState === 'lifetime') {
      rows.push({ label: 'Plan', value: 'Lifetime — never expires' });
      rows.push({ label: 'Renews', value: 'Never — you own it' });
    }
    if (billingState === 'expired' && currentPeriodEnd) {
      rows.push({ label: 'Ended on', value: formatDateLong(currentPeriodEnd) });
    }
    if (billingState === 'billing_issue' && currentPeriodEnd) {
      rows.push({ label: 'Grace period ends', value: formatDateLong(currentPeriodEnd) });
    }

    if (rows.length === 0) return null;

    return (
      <Animated.View style={{ opacity: sectionAnim }}>
        <Text style={styles.sectionLabel}>BILLING DETAILS</Text>
        <View style={styles.detailCard}>
          {rows.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 && <View style={styles.detailDivider} />}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={[styles.detailValue, tabularNums]}>{row.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderFeatures = () => {
    if (billingState === 'loading' || billingState === 'free' || billingState === 'unavailable') return null;
    const featuresForState = ALL_FEATURES.filter((f) => f.tier.includes(tier === 'free' ? 'premium' : tier));
    const isActive = billingState === 'active' || billingState === 'lifetime' || billingState === 'trial';

    return (
      <Animated.View style={{ opacity: sectionAnim }}>
        <Text style={styles.sectionLabel}>
          {isActive ? 'PROTECTING YOUR PORCH RIGHT NOW' : billingState === 'cancelling' ? 'STILL ACTIVE UNTIL ACCESS ENDS' : 'WHAT YOU\'LL GET BACK'}
        </Text>
        <View style={styles.featuresGrid}>
          {featuresForState.map((f, i) => {
            const featureIdx = ALL_FEATURES.indexOf(f);
            return (
              <FeatureChip
                key={f.label}
                icon={f.icon}
                label={f.label}
                active={isActive || billingState === 'cancelling'}
                accentColor={hero.accentColor}
                animValue={featureAnims[featureIdx] ?? featureAnims[i] ?? new Animated.Value(1)}
              />
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderActions = () => (
    <Animated.View style={[styles.actionsSection, { opacity: sectionAnim }]}>
      <Text style={styles.sectionLabel}>MANAGE</Text>

      {/* Primary action — varies by state */}
      {(billingState === 'active' || billingState === 'lifetime' || billingState === 'trial' || billingState === 'cancelling') && (
        <TouchableOpacity style={styles.actionRowPrimary} onPress={handleManageSubscription} activeOpacity={0.82}>
          <View style={styles.actionLeft}>
            <View style={styles.actionIconWrap}>
              <ExternalLink size={18} color={palette.gold} />
            </View>
            <View>
              <Text style={styles.actionTitle}>Manage Subscription</Text>
              <Text style={styles.actionSub}>
                {Platform.OS === 'android' ? 'Opens Google Play' : 'Opens App Store'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#4A5F7A" />
        </TouchableOpacity>
      )}

      {/* Trust Engine — Enterprise users only */}
      {tier === 'enterprise' && (billingState === 'active' || billingState === 'trial' || billingState === 'cancelling') && (
        <TouchableOpacity style={[styles.actionRowPrimary, { borderColor: 'rgba(74, 143, 232, 0.25)' }]} onPress={handleTrustEngine} activeOpacity={0.82}>
          <View style={styles.actionLeft}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(74, 143, 232, 0.12)' }]}>
              <ShieldCheck size={18} color="#4A8FE8" />
            </View>
            <View>
              <Text style={styles.actionTitle}>WhichWay Trust Engine</Text>
              <Text style={styles.actionSub}>Compliance posture & monitoring loop</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#4A5F7A" />
        </TouchableOpacity>
      )}

      {/* Billing issue: fix payment first */}
      {billingState === 'billing_issue' && (
        <TouchableOpacity style={[styles.actionRowPrimary, { borderColor: `${palette.warmOrange}40` }]} onPress={handleManageSubscription} activeOpacity={0.82}>
          <View style={styles.actionLeft}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(232, 98, 42, 0.15)' }]}>
              <AlertTriangle size={18} color={palette.warmOrange} />
            </View>
            <View>
              <Text style={[styles.actionTitle, { color: palette.warmOrange }]}>Fix Payment Method</Text>
              <Text style={styles.actionSub}>Tap to update your billing details</Text>
            </View>
          </View>
          <ChevronRight size={18} color={palette.warmOrange} />
        </TouchableOpacity>
      )}

      {/* Expired or free: upgrade CTA */}
      {(billingState === 'expired' || billingState === 'free') && (
        <TouchableOpacity style={styles.upgradeActionBtn} onPress={billingState === 'expired' ? handleResubscribe : handleUpgrade} activeOpacity={0.88}>
          <LinearGradient
            colors={['#3A7BD5', '#2A5FA8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeActionGradient}
          >
            <Crown size={18} color="#FFFFFF" />
            <Text style={styles.upgradeActionText}>
              {billingState === 'expired' ? 'Reactivate Protection' : 'Upgrade to Premium'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Cancelling: resubscribe CTA */}
      {billingState === 'cancelling' && (
        <TouchableOpacity style={styles.upgradeActionBtn} onPress={handleResubscribe} activeOpacity={0.88}>
          <LinearGradient
            colors={['#C8941E', '#A87818']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeActionGradient}
          >
            <Crown size={18} color="#FFFFFF" />
            <Text style={styles.upgradeActionText}>Keep My Subscription</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Restore & Sync — always available */}
      <View style={styles.secondaryActions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleRestore}
          activeOpacity={0.75}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color="#6B7F99" />
          ) : (
            <RotateCcw size={15} color="#6B7F99" />
          )}
          <Text style={styles.secondaryBtnText}>{isRestoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </TouchableOpacity>

        <View style={styles.secondaryDivider} />

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleSync}
          activeOpacity={0.75}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#6B7F99" />
          ) : (
            <RefreshCw size={15} color="#6B7F99" />
          )}
          <Text style={styles.secondaryBtnText}>{isSyncing ? 'Syncing…' : 'Sync Status'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderFooter = () => (
    <Animated.View style={[styles.footer, { opacity: sectionAnim }]}>
      <Text style={styles.footerText}>
        Subscriptions are managed and billed by Apple or Google.{'\n'}
        Cancellation takes effect at the end of the current billing period.
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openURL('mailto:support@porchivo.app').catch(() => {})}
        activeOpacity={0.7}
      >
        <Text style={styles.footerLink}>Contact Support</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── Layout ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Rail header */}
      <DarkRailHeader
        status={
          billingState === 'lifetime' ? 'LIFETIME' :
          billingState === 'active'   ? 'PREMIUM' :
          billingState === 'cancelling' ? 'CANCELS' :
          billingState === 'billing_issue' ? 'BILLING' :
          billingState === 'expired'  ? 'EXPIRED' :
          billingState === 'loading'  ? 'LOADING' :
          'BILLING'
        }
        dotColor={hero.dotColor}
      />

      {/* Back button */}
      <Animated.View style={[styles.topBar, { opacity: mountAnim }]}>
        <RailBackButton onPress={() => router.back()} testID="billing-back" />
        <Text style={styles.screenTitle}>My Plan</Text>
        <View style={styles.topBarSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        {billingState === 'loading' ? renderSkeletonCard() : renderHero()}

        {/* Billing details */}
        {renderBillingDetails()}

        {/* Features */}
        {renderFeatures()}

        {/* Actions */}
        {renderActions()}

        {/* Footer */}
        {renderFooter()}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.railBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    color: palette.railText,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  topBarSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xl,
  },

  // Hero
  heroCard: {
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 22,
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
  },
  heroIconContainer: {
    marginBottom: 18,
  },
  heroIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeadline: {
    color: '#E8EEF8',
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubheadline: {
    color: '#8099B8',
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Time bar (cancelling state)
  timeBarTrack: {
    width: '100%',
    marginTop: 20,
    gap: 6,
  },
  timeBarFill: {
    height: 4,
    borderRadius: 2,
    minWidth: 8,
  },
  timeBarLabel: {
    color: '#6B7F99',
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'left',
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: palette.railSurface,
    borderRadius: radius.xl,
    padding: 28,
    borderWidth: 1,
    borderColor: palette.railBorder,
    alignItems: 'center',
    paddingVertical: 40,
  },
  skeletonLine: {
    backgroundColor: '#253554',
    borderRadius: 6,
  },

  // Section labels
  sectionLabel: {
    color: '#4A5F7A',
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.8,
    marginBottom: space.sm,
  },

  // Feature chips
  featuresGrid: {
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: palette.railBorder,
    gap: 12,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  featureCheck: {
    flexShrink: 0,
  },

  // Billing detail card
  detailCard: {
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.railBorder,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  detailDivider: {
    height: 1,
    backgroundColor: palette.railBorder,
    marginHorizontal: space.lg,
  },
  detailLabel: {
    color: '#6B7F99',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  detailValue: {
    color: '#C8D8F0',
    fontSize: 14,
    fontWeight: '600' as const,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // Actions
  actionsSection: {
    gap: space.sm,
  },
  actionRowPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 148, 30, 0.20)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 148, 30, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: '#C8D8F0',
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  actionSub: {
    color: '#4A5F7A',
    fontSize: 12,
    fontWeight: '400' as const,
    marginTop: 2,
  },

  // Upgrade / reactivate CTA
  upgradeActionBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  upgradeActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 10,
  },
  upgradeActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },

  // Secondary actions (restore + sync)
  secondaryActions: {
    flexDirection: 'row',
    backgroundColor: palette.railSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.railBorder,
    overflow: 'hidden',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  secondaryDivider: {
    width: 1,
    backgroundColor: palette.railBorder,
  },
  secondaryBtnText: {
    color: '#6B7F99',
    fontSize: 13,
    fontWeight: '600' as const,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.xl,
  },
  footerText: {
    color: '#3A4B6E',
    fontSize: 12,
    fontWeight: '400' as const,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#4A5F7A',
    fontSize: 13,
    fontWeight: '600' as const,
    textDecorationLine: 'underline',
  },
});
