import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Globe } from 'lucide-react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useColors } from '@/constants/colors';
import type { AppColors } from '@/constants/colors';
import { useTheme } from '@/store/ThemeContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useExperiments } from '@/store/ExperimentsContext';
import { markExposedOnce } from '@/lib/experiments';
import {
  OnboardingScreen,
  PrimaryCTA,
  SecondaryAction,
  ParallaxLayer,
} from '@/components/onboarding';
import { Sparkles } from 'lucide-react-native';

const BOX_ASSET = require('@/assets/images/delivery_box_cardboard.png');
const LOGO_ASSET = require('@/assets/images/porchivo-logo.png');

/**
 * Welcome-only hero mark: the cardboard box sits above the app logo with a
 * slow continuous 3D rotation. The box spins right-to-left around its
 * vertical axis (rotateY), turning through real 3D space so each side
 * comes into view as it revolves. The top of the logo is allowed to
 * overlap the very bottom of the box as it turns, so the two read as a
 * single stacked brand mark rather than two detached pieces.
 */
function RotatingBoxAboveLogo({ logoSize }: { logoSize: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // iterations: -1 makes the loop explicit and avoids any native-driver
    // reset edge cases where a single cycle could appear to stop.
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: -1, resetBeforeIteration: true },
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // Negative range = right-to-left rotation (right edge moves back/away
  // first, left edge comes forward) — a true 3D turn about the Y axis.
  const spinY = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const boxWidth = logoSize * 1.5;
  const boxHeight = boxWidth * 0.874; // source image is 764x668
  // Pull the logo up so its top slightly overlaps the box's bottom edge.
  const overlap = boxHeight * 0.18;

  return (
    <View style={styles.heroStack}>
      <Animated.View
        style={[
          styles.boxWrap,
          {
            width: boxWidth,
            height: boxHeight,
            // perspective must come first in the transform chain to give
            // the rotateY real depth; backfaceVisibility hidden keeps the
            // mirrored back face of the image from flashing through.
            transform: [
              { perspective: 900 },
              { rotateY: spinY },
            ],
          },
        ]}
      >
        <Image
          source={BOX_ASSET}
          style={{ width: boxWidth, height: boxHeight }}
          resizeMode="contain"
          accessible={false}
        />
      </Animated.View>
      <Image
        source={LOGO_ASSET}
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
            borderRadius: logoSize * 0.24,
            marginTop: -overlap,
          },
        ]}
        resizeMode="contain"
        accessibilityLabel="Porchivo logo"
      />
    </View>
  );
}

const REACH_FACTS: string[] = [
  'Built to work in 190+ countries worldwide',
  'About 370,000 homeowner & community associations in the U.S.',
  'Package theft remains one of the most common delivery complaints',
  '7-8 million condominium housing units in the U.S.',
  '80 million homeowner households in the U.S. as of the mid-2020s',
  'Porchivo Delivery Insights — UPS & Amazon Hidden Services',
  'Safer Delivery Solutions',
  'Neighborhood Delivery Resources',
];

const FACT_INTERVAL_MS = 4000;

function RotatingReachPill({ Colors }: { Colors: AppColors }) {
  const [index, setIndex] = useState<number>(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % REACH_FACTS.length);
        spin.setValue(0);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(spin, {
            toValue: 1,
            duration: 560,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, FACT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [opacity, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.reachPill, { backgroundColor: Colors.skyBlue, opacity }]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Globe size={14} strokeWidth={2.4} color={Colors.primary} />
      </Animated.View>
      <Text style={[styles.reachText, { color: Colors.primary }]}>{REACH_FACTS[index]}</Text>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { isDark } = useTheme();
  const { track } = useAnalytics();
  const { experiment, variant, isResolved } = useExperiments();
  const { welcome } = experiment;

  useEffect(() => {
    if (!isResolved) return;
    void markExposedOnce().then((firstTime) => {
      if (firstTime) track('experiment_exposure', { surface: 'welcome', variant });
    });
  }, [isResolved, variant, track]);

  const handleGetStarted = () => {
    track('onboarding_started');
    track('onboarding_auth_started', { mode: 'signup' });
    // Android: lead with notification opt-in to exploit the ~81% push opt-in
    // rate — the notification channel becomes a zero-cost retention engine.
    // iOS: skip the early prompt (lower opt-in rate, stricter prompt budget).
    if (Platform.OS === 'android') {
      router.push({ pathname: '/delivery-alerts' as any, params: { mode: 'signup' } });
    } else {
      router.push({ pathname: '/welcome-features' as any, params: { mode: 'signup' } });
    }
  };

  const handleSignIn = () => {
    track('onboarding_auth_started', { mode: 'signin' });
    if (Platform.OS === 'android') {
      router.push({ pathname: '/delivery-alerts' as any, params: { mode: 'signin' } });
    } else {
      router.push({ pathname: '/welcome-features' as any, params: { mode: 'signin' } });
    }
  };

  const handleGuestBrowse = () => {
    track('guest_mode_started', { surface: 'welcome' });
    router.push('/guest-browse' as any);
  };

  return (
    <OnboardingScreen
      glow={false}
      footer={
        <View>
          <PrimaryCTA
            label={Platform.OS === 'android' ? 'Enable alerts & get started' : welcome.primaryCta}
            onPress={handleGetStarted}
            testID="welcome-get-started"
          />
          <SecondaryAction
            label={welcome.secondaryAction}
            onPress={handleSignIn}
            testID="welcome-sign-in"
          />
          <TouchableOpacity
            onPress={handleGuestBrowse}
            activeOpacity={0.7}
            style={styles.guestBtn}
            accessibilityRole="button"
            accessibilityLabel="Browse a demo neighborhood"
            testID="welcome-guest"
          >
            <Sparkles size={12} color={Colors.primary} />
            <Text style={[styles.guestText, { color: Colors.slateLight }]}>
              Just looking? Browse a demo neighborhood
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Radial bloom — echoes the splash's aperture, centered on the logo
          so the splash-to-welcome handoff feels continuous. */}
      <View style={styles.bloomContainer} pointerEvents="none">
        <Svg width={BLOOM_SIZE} height={BLOOM_SIZE} style={styles.bloomSvg}>
          <Defs>
            <RadialGradient id="welcomeBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={isDark ? '#EBF2FF' : '#A9C9F5'} stopOpacity={isDark ? 0.22 : 0.32} />
              <Stop offset="22%" stopColor={isDark ? '#6BA8F5' : '#7FB0F2'} stopOpacity={isDark ? 0.16 : 0.20} />
              <Stop offset="48%" stopColor={isDark ? '#4A8FE8' : '#5A92E0'} stopOpacity={isDark ? 0.10 : 0.12} />
              <Stop offset="76%" stopColor={isDark ? '#3A7BD5' : '#3A7BD5'} stopOpacity={isDark ? 0.05 : 0.05} />
              <Stop offset="100%" stopColor={isDark ? '#2A5FA8' : '#3A7BD5'} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={BLOOM_SIZE / 2} cy={BLOOM_SIZE / 2} r={BLOOM_SIZE / 2} fill="url(#welcomeBloom)" />
        </Svg>
      </View>

      {/* Top spacer pushes the logo block into the same centered position
          it holds on the splash screen (~42% screen height) so the handoff
          feels continuous. */}
      <View style={styles.spacer} />

      {/* Hero mark — rotating cardboard box above the logo, with a slight
          overlap where the top of the logo meets the bottom of the box. */}
      <ParallaxLayer entrance="rotateY" entranceDelay={100}>
        <View style={styles.logoWrap}>
          <RotatingBoxAboveLogo logoSize={132} />
        </View>
      </ParallaxLayer>

      {/* Wordmark revealed beneath the mark, mirroring the splash reveal */}
      <ParallaxLayer entrance="none" entranceDelay={180}>
        <Text style={[styles.wordmark, { color: Colors.slate }]}>Porchivo</Text>
      </ParallaxLayer>

      {/* Rotating reach pill */}
      <ParallaxLayer entrance="none" entranceDelay={260}>
        <RotatingReachPill Colors={Colors} />
      </ParallaxLayer>

      {/* Headline with 3D entrance */}
      <ParallaxLayer entrance="rotateX" entranceDelay={320}>
        <Text style={[styles.headline, { color: Colors.slate }]}>
          {welcome.headline}
        </Text>
      </ParallaxLayer>

      {/* Subhead */}
      {welcome.subheadline.trim().length > 0 && (
        <ParallaxLayer entrance="none" entranceDelay={420}>
          <Text style={[styles.subhead, { color: Colors.slateLight }]}>
            {welcome.subheadline}
          </Text>
        </ParallaxLayer>
      )}

      {/* Bottom spacer balances the top spacer so the block stays centered */}
      <View style={styles.spacer} />
    </OnboardingScreen>
  );
}

// Diameter of the radial bloom — large enough to fill the screen around the logo.
const BLOOM_SIZE = 620;

const styles = StyleSheet.create({
  bloomContainer: {
    position: 'absolute',
    // Center the bloom on the logo's vertical anchor (~42% screen height),
    // matching the splash's aperture origin for a seamless handoff.
    top: '42%',
    left: 0,
    right: 0,
    height: BLOOM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bloomSvg: {
    marginTop: -BLOOM_SIZE / 2,
  },
  logoWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  heroStack: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  boxWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // Keep the box's rotational pivot centered on its own body so the
    // overlap with the logo stays consistent through every angle of the
    // 3D turn.
    transformOrigin: 'center',
    // Hide the mirrored back face during the 3D rotation so only the
    // front of the cardboard box is ever visible to the viewer.
    backfaceVisibility: 'hidden',
  },
  logo: {
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 18,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 27,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  reachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 16,
  },
  reachText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  spacer: {
    flex: 1,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    marginTop: 4,
  },
  guestText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
