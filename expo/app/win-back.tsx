/**
 * Win-back screen — shown to users whose subscription has lapsed or free trial ended.
 * Presents the 40%-off win-back offer and routes to the upgrade paywall.
 *
 * Navigate here via: router.replace('/win-back')
 * The day-7 hard paywall logic in AppContext already handles most cases,
 * but this screen can also be pushed manually from any "your subscription ended" alert.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ShieldOff,
  ShieldCheck,
  Bell,
  Zap,
  HandCoins,
  FileText,
  Gift,
  ChevronRight,
  Crown,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { palette, radius } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { PRICING } from '@/config/app';

const MISSING = [
  { icon: ShieldCheck, label: 'Theft Shield', sub: 'Real-time risk score on every delivery' },
  { icon: Zap,         label: 'Live Tracking', sub: 'Updates every 90 seconds, not 10 minutes' },
  { icon: Bell,        label: 'Out-for-Delivery Alerts', sub: 'Instant push the moment your package ships' },
  { icon: FileText,    label: 'Tax Invoicing', sub: 'Quarterly & annual PDFs, ready to file' },
];

export default function WinBackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { track } = useAnalytics();
  const [dismissed, setDismissed] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideTop = useRef(new Animated.Value(-30)).current;
  const slideBottom = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    track('winback_screen_view');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideTop, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(slideBottom, { toValue: 0, tension: 45, friction: 9, useNativeDriver: true }),
    ]).start();

    // Pulse animation on the offer badge
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('winback_claim_tapped');
    router.push('/upgrade?trigger=day7_hard' as any);
  }, [router, track]);

  const handleDismiss = useCallback(() => {
    if (dismissed) return;
    setDismissed(true);
    Haptics.selectionAsync();
    track('winback_dismissed');
    router.replace('/(tabs)/(home)' as any);
  }, [dismissed, router, track]);

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top loss-frame card */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideTop }] }}>
          <View style={styles.lossCard}>
            <LinearGradient
              colors={['rgba(229,72,77,0.06)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />
            <View style={styles.shieldOffWrap}>
              <ShieldOff size={28} color={palette.rose} />
            </View>
            <Text style={styles.lossTitle}>Your porch is unprotected.</Text>
            <Text style={styles.lossSub}>
              Your free access ended. Right now, your packages arrive without Theft Shield, without real-time risk scoring, and without live tracking. That's how porch pirates pick their targets.
            </Text>
          </View>
        </Animated.View>

        {/* What you're missing */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.sectionLabel}>WHAT YOU'RE MISSING</Text>
          <View style={[styles.missingCard, { backgroundColor: Colors.surface }]}>
            {MISSING.map((m, i) => {
              const Icon = m.icon;
              return (
                <View key={i} style={[styles.missingRow, i < MISSING.length - 1 && styles.missingRowBorder]}>
                  <View style={styles.missingIcon}>
                    <Icon size={15} color={palette.rose} />
                  </View>
                  <View style={styles.missingText}>
                    <Text style={styles.missingLabel}>{m.label}</Text>
                    <Text style={styles.missingSub}>{m.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Win-back offer */}
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideBottom }] }]}>
          <Animated.View style={[styles.offerCard, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={[palette.railBg, '#253554']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
              pointerEvents="none"
            />

            <View style={styles.offerBadge}>
              <Gift size={11} color={palette.railAccent} />
              <Text style={styles.offerBadgeText}>ONE-TIME WIN-BACK OFFER</Text>
            </View>

            <Crown size={28} color={palette.railAccent} style={{ marginBottom: 8 }} />
            <Text style={styles.offerTitle}>40% off your first 3 months</Text>
            <Text style={styles.offerPrice}>
              {PRICING.winback.displayPrice}{' '}
              <Text style={styles.offerPriceSub}>/ month for 3 months</Text>
            </Text>
            <Text style={styles.offerNote}>
              Then {PRICING.monthly.displayPrice}/mo — cancel any time in Settings.
              This offer is only shown once.
            </Text>

            <TouchableOpacity
              style={styles.claimBtn}
              onPress={handleClaim}
              activeOpacity={0.88}
              testID="claim-winback"
            >
              <Gift size={16} color={palette.railBg} />
              <Text style={styles.claimBtnText}>Claim offer — {PRICING.winback.displayPrice}/mo</Text>
              <ChevronRight size={16} color={palette.railBg} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Social proof */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.proofRow, { backgroundColor: Colors.surface }]}>
            <View style={styles.proofStat}>
              <Text style={styles.proofNum}>119M</Text>
              <Text style={styles.proofLabel}>packages stolen in the US last year</Text>
            </View>
            <View style={styles.proofDivider} />
            <View style={styles.proofStat}>
              <Text style={styles.proofNum}>1 in 5</Text>
              <Text style={styles.proofLabel}>deliveries targeted by porch pirates</Text>
            </View>
          </View>
        </Animated.View>

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDismiss}
          disabled={dismissed}
          activeOpacity={0.6}
          testID="dismiss-winback"
        >
          <Text style={styles.dismissText}>No thanks — continue without protection</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 18,
    gap: 14,
  },

  // Loss frame
  lossCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: `${palette.rose}30`,
    backgroundColor: palette.roseSoft,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shieldOffWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${palette.rose}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${palette.rose}25`,
  },
  lossTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: palette.rose,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  lossSub: {
    fontSize: 13,
    color: '#7A2B2D',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Missing
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.slate300,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 4,
  },
  missingCard: {
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  missingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.borderDark,
  },
  missingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: { flex: 1 },
  missingLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.ink,
  },
  missingSub: {
    fontSize: 11,
    color: palette.slate500,
    marginTop: 1,
  },

  // Offer
  offerCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: palette.railBg,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${palette.railAccent}22`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${palette.railAccent}40`,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: palette.railAccent,
    letterSpacing: 0.8,
  },
  offerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#F0F4F8',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
    lineHeight: 27,
  },
  offerPrice: {
    fontSize: 30,
    fontWeight: '900' as const,
    color: palette.railAccent,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  offerPriceSub: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: palette.railTextMuted ?? '#8099B8',
  },
  offerNote: {
    fontSize: 11,
    color: '#8099B8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    maxWidth: 280,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.railAccent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    justifyContent: 'center',
    shadowColor: palette.railAccent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  claimBtnText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900' as const,
    color: palette.railBg,
    letterSpacing: 0.3,
  },

  // Social proof
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  proofStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  proofNum: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: palette.rose,
    letterSpacing: -0.5,
  },
  proofLabel: {
    fontSize: 11,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 15,
  },
  proofDivider: {
    width: 1,
    height: 36,
    backgroundColor: palette.borderDark,
  },

  // Dismiss
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  dismissText: {
    fontSize: 12,
    color: palette.slate300,
    textDecorationLine: 'underline' as const,
  },
});
