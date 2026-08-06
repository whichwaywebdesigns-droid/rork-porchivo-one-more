import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Package,
  Bell,
  Users,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useApp } from '@/store/AppContext';
import { log } from '@/lib/logger';
import { useRouter } from 'expo-router';

interface TrackingCompleteProps {
  onContinue?: () => void;
  /** Which steps the user actually completed (vs skipped) */
  completedSteps?: Set<number>;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TrackingCompleteScreen({
  onContinue,
  completedSteps,
}: TrackingCompleteProps): React.ReactElement {
  const { track } = useAnalytics();
  const { completeOnboarding, session, user } = useApp();
  const router = useRouter();

  // Fallback for deep-link access — route into the step manager instead of crashing
  const safeContinue = useCallback(() => {
    if (onContinue) onContinue();
    else router.replace('/tracking-onboarding' as never);
  }, [onContinue, router]);

  const safeCompletedSteps = completedSteps ?? new Set<number>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shieldScale = useRef(new Animated.Value(0.5)).current;
  const shieldBounce = useRef(new Animated.Value(0)).current;
  const summaryAnims = useRef<Animated.Value[]>(
    [0, 1, 2, 3].map(() => new Animated.Value(0)),
  ).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    track('onboarding_step_view', { step: 'complete' });
    track('onboarding_completed', {
      steps_completed: Array.from(safeCompletedSteps).join(','),
      step_count: safeCompletedSteps.size,
    });

    // Hero entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8,
      }),
      Animated.spring(shieldScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 14,
      }),
    ]).start();

    // Shield celebratory bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(shieldBounce, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shieldBounce, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Staggered summary items
    summaryAnims.forEach((anim, i) => {
      setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }).start();
      }, 400 + i * 150);
    });

    // CTA entrance
    setTimeout(() => {
      Animated.spring(ctaAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8,
      }).start();
    }, 1100);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleEnter = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Final onboarding completion call (idempotent — safe if already completed in Step 2)
    const userId = session?.user?.id ?? user?.id;
    if (userId) {
      void completeOnboarding({
        hasLocationConsent: safeCompletedSteps.has(5),
        hasPreciseLocationConsent: false,
      }).catch((e) => log('[TrackingComplete] completeOnboarding error (non-fatal):', e));
    }

    track('onboarding_step_complete', { step: 'complete' });
    safeContinue();
  }, [track, safeContinue, completeOnboarding, session, user, safeCompletedSteps]);

  // ── Summary items ───────────────────────────────────────────────────
  const summaryItems = [
    {
      icon: <Package size={18} color={palette.navy} strokeWidth={2.2} />,
      label: 'Package tracking',
      done: safeCompletedSteps.has(2),
      tint: palette.sky,
    },
    {
      icon: <ShieldCheck size={18} color={palette.sage} strokeWidth={2.2} />,
      label: 'Theft Shield risk score',
      done: safeCompletedSteps.has(3),
      tint: palette.sageSoft,
    },
    {
      icon: <Bell size={18} color={palette.ember} strokeWidth={2.2} />,
      label: 'Delivery alerts',
      done: safeCompletedSteps.has(4),
      tint: palette.emberSoft,
    },
    {
      icon: <Users size={18} color={palette.navy} strokeWidth={2.2} />,
      label: 'Porch Partners network',
      done: safeCompletedSteps.has(5),
      tint: palette.sky,
    },
  ];

  const bounceRotate = shieldBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -5, 0],
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        <View style={styles.stepDots}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                s === 6 && styles.stepDotActive,
                s < 6 && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 6 of 6</Text>
      </View>

      <View style={styles.content}>
        {/* Hero */}
        <Animated.View
          style={[
            styles.hero,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View
            style={[
              styles.shieldWrap,
              {
                transform: [
                  { scale: shieldScale },
                  { rotate: `${bounceRotate}deg` },
                ],
              },
            ]}
          >
            <View style={styles.shieldGlow} />
            <View style={styles.shieldTile}>
              <ShieldCheck size={44} color={palette.surface} strokeWidth={2} />
            </View>
            <View style={styles.sparkleTopRight}>
              <Sparkles size={14} color={palette.ember} strokeWidth={2.5} />
            </View>
            <View style={styles.sparkleBotLeft}>
              <Sparkles size={10} color={palette.navy} strokeWidth={2.5} />
            </View>
          </Animated.View>

          <Text style={styles.eyebrow}>YOU&apos;RE ALL SET</Text>
          <Text style={styles.title}>Your porch is now protected</Text>
          <Text style={styles.subtitle}>
            Porchivo is watching your deliveries, monitoring your neighborhood, and ready to alert you the moment something matters.
          </Text>
        </Animated.View>

        {/* Summary checklist */}
        <View style={styles.summaryWrap}>
          {summaryItems.map((item, i) => (
            <Animated.View
              key={item.label}
              style={[
                styles.summaryRow,
                {
                  opacity: summaryAnims[i],
                  transform: [
                    {
                      translateX: summaryAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.summaryIcon, { backgroundColor: item.tint }]}>
                {item.icon}
              </View>
              <Text
                style={[
                  styles.summaryLabel,
                  !item.done && styles.summaryLabelPending,
                ]}
              >
                {item.label}
              </Text>
              {item.done ? (
                <View style={styles.checkBadge}>
                  <ShieldCheck size={14} color={palette.sage} strokeWidth={2.5} />
                </View>
              ) : (
                <Text style={styles.pendingLabel}>Later</Text>
              )}
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Footer CTA */}
      <Animated.View
        style={[
          styles.footer,
          {
            opacity: ctaAnim,
            transform: [
              {
                translateY: ctaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleEnter}
          activeOpacity={0.85}
          accessibilityLabel="Enter Porchivo"
          accessibilityRole="button"
          testID="btn-enter-porchivo"
        >
          <Text style={styles.ctaText}>Enter Porchivo</Text>
          <ArrowRight size={20} color={palette.surface} strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  // ── Step indicator ──────────────────────────────────────────────────
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.slate200,
  },
  stepDotActive: {
    backgroundColor: palette.navy,
    width: 24,
  },
  stepDotDone: {
    backgroundColor: palette.sage,
  },
  stepLabel: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 12,
  },
  // ── Content ─────────────────────────────────────────────────────────
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  // ── Hero ────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    marginBottom: space.xxxl,
  },
  shieldWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  shieldGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.sageSoft,
    opacity: 0.6,
  },
  shieldTile: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 10,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: 8,
    right: 4,
  },
  sparkleBotLeft: {
    position: 'absolute',
    bottom: 10,
    left: 6,
  },
  eyebrow: {
    ...ttype.overline,
    color: palette.ember,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    ...ttype.display,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subtitle: {
    ...ttype.body,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: space.md,
  },
  // ── Summary ─────────────────────────────────────────────────────────
  summaryWrap: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...elevation.low,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    ...ttype.body,
    color: palette.ink,
    fontSize: 15,
    flex: 1,
    fontWeight: '600' as const,
  },
  summaryLabelPending: {
    color: palette.slate300,
    fontWeight: '500' as const,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingLabel: {
    ...ttype.caption,
    color: palette.slate300,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  // ── Footer ──────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.navy,
    paddingVertical: 17,
    paddingHorizontal: space.xxxl,
    borderRadius: radius.pill,
    ...elevation.raised,
  },
  ctaText: {
    color: palette.surface,
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
});
