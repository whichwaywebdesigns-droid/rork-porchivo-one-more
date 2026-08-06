import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, ArrowRight, Package, ChevronRight } from 'lucide-react-native';
import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackingWelcomeProps {
  onContinue?: () => void;
  onSkip?: () => void;
}

export default function TrackingWelcomeScreen({ onContinue, onSkip }: TrackingWelcomeProps): React.ReactElement {
  const { track } = useAnalytics();
  const router = useRouter();

  // Fallbacks for deep-link access — route into the step manager instead of crashing
  const safeContinue = useCallback(() => {
    if (onContinue) {
      onContinue();
    } else {
      router.replace('/tracking-onboarding' as never);
    }
  }, [onContinue, router]);
  const safeSkip = useCallback(() => {
    if (onSkip) onSkip();
    else router.replace('/tracking-onboarding' as never);
  }, [onSkip, router]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('onboarding_step_skipped', { step: 'welcome' });
    safeSkip();
  }, [track, safeSkip]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shieldScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    track('onboarding_started', { surface: 'tracking_welcome' });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
      }),
      Animated.spring(shieldScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 10,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [track, fadeAnim, slideAnim, shieldScale, pulseAnim]);

  const handleContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('welcome_cta_tapped', { surface: 'tracking_welcome' });
    safeContinue();
  }, [track, safeContinue]);

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });
  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.0, 0.0],
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.shieldWrap}>
            <Animated.View
              style={[
                styles.shieldRing,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.shieldTile,
                { transform: [{ scale: shieldScale }] },
              ]}
            >
              <ShieldCheck size={40} color={palette.surface} strokeWidth={2} />
            </Animated.View>
          </View>

          <Text style={styles.eyebrow}>PORCHIVO</Text>
          <Text style={styles.title}>Protect every package{'\n'}on your porch</Text>
          <Text style={styles.subtitle}>
            Track deliveries, get theft alerts, and connect with trusted neighbors — all in one place.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
           styles.illustrationRow,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {[
            { icon: <Package size={20} color={palette.navy} />, tint: palette.sky },
            { icon: <ShieldCheck size={20} color={palette.sage} />, tint: palette.sageSoft },
            { icon: <ArrowRight size={20} color={palette.ember} />, tint: palette.emberSoft },
          ].map((item, i) => (
            <View
              key={i}
              style={[styles.miniTile, { backgroundColor: item.tint }]}
            >
              {item.icon}
            </View>
          ))}
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinue}
            activeOpacity={0.85}
            accessibilityLabel="Start tracking"
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Start Tracking</Text>
            <ArrowRight size={20} color={palette.surface} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.footerHint}>
            No account needed yet — {Platform.OS === 'ios' ? 'iOS' : 'Android'} optimized
          </Text>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
            accessibilityLabel="Skip for now"
            accessibilityRole="button"
            testID="btn-skip"
          >
            <Text style={styles.skipText}>Skip for now</Text>
            <ChevronRight size={14} color={palette.slate300} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space.xxl,
    paddingTop: space.xxxl + 20,
    paddingBottom: space.xxxl,
  },
  hero: {
    alignItems: 'center',
  },
  shieldWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xxl,
  },
  shieldRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5,
    borderColor: palette.navy,
  },
  shieldTile: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  eyebrow: {
    ...ttype.overline,
    color: palette.ember,
    marginBottom: space.sm,
    fontSize: 12,
    letterSpacing: 2,
  },
  title: {
    ...ttype.displayMd,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 34,
  },
  subtitle: {
    ...ttype.body,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: space.sm,
  },
  illustrationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.lg,
    paddingVertical: space.xxxl,
  },
  miniTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: space.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.navy,
    paddingVertical: 18,
    paddingHorizontal: space.xxxl,
    borderRadius: radius.pill,
    minWidth: 260,
    ...elevation.raised,
  },
  ctaText: {
    color: palette.surface,
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  footerHint: {
    ...ttype.caption,
    color: palette.slate300,
    fontSize: 13,
  },
  skipText: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
