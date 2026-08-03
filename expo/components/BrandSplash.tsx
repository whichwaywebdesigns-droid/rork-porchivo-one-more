import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { BrandLogoWithBox } from '@/components/onboarding';

// Deep relaxing exhale — "breath equals life" subliminal cue during the splash
const EXHALE_SOUND = require('@/assets/audio/splash-exhale.mp3');

interface BrandSplashProps {
  onAnimationComplete?: () => void;
  visible: boolean;
}

// Brand blue palette over near-black — concentrics use the app's blue hues
const VOID_TOP = '#05070C';
const VOID_BOT = '#0A0F18';
const BLUE_CORE = '#EBF2FF'; // sky / brightest core
const BLUE_LIGHT = '#6BA8F5'; // navySoft (dark)
const BLUE = '#4A8FE8'; // accent (dark)
const BLUE_MID = '#3A7BD5'; // navy / accent
const BLUE_DEEP = '#2A5FA8'; // accentDim
const TEXT_WARM = '#E8EEF8';
const TEXT_SUB = 'rgba(232,238,248,0.52)';

/**
 * Option #4 — the peephole / aperture bloom.
 * A single distant warm dot rushes toward you, blooms into one flash of
 * warmth that fills the screen, then settles into a calm glow that reveals
 * the wordmark. One hero beat, nothing else.
 */
export default function BrandSplash({ onAnimationComplete, visible }: BrandSplashProps) {
  const { width, height } = useWindowDimensions();

  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Aperture: 0 = distant pinpoint, 1 = bloomed peak, settles ~0.62
  const bloom = useRef(new Animated.Value(0)).current;
  // Fire a single haptic tap at the peak of the bloom
  const hapticFired = useRef(false);
  // Brief white-hot flash at the peak of the bloom
  const flash = useRef(new Animated.Value(0)).current;

  // Text reveal
  const wordmarkOp = useRef(new Animated.Value(0)).current;
  const wordmarkScale = useRef(new Animated.Value(0.86)).current;
  const taglineOp = useRef(new Animated.Value(0)).current;

  // Calm breathing after settle
  const breathe = useRef(new Animated.Value(0)).current;

  // Logo + wordmark flash pulse
  const logoFlash = useRef(new Animated.Value(0)).current;
  const wordmarkFlash = useRef(new Animated.Value(0)).current;

  // Deep exhale sound, timed to the bloom so breath syncs with the warmth
  useEffect(() => {
    let player: AudioPlayer | null = null;
    let exhaleTimer: ReturnType<typeof setTimeout> | null = null;

    // Browsers block audio autoplay until the user interacts with the page, so
    // attempting to play on web throws a runtime error. The exhale is a native
    // delight — skip it on web entirely.
    if (Platform.OS === 'web') {
      return;
    }

    (async () => {
      try {
        // Respect the silent switch is fine; keep it gentle and non-intrusive
        await setAudioModeAsync({ playsInSilentMode: false });
        player = createAudioPlayer(EXHALE_SOUND);
        player.volume = 1.0;
        // Start the exhale as the bloom begins to breathe in (~delay + a beat)
        exhaleTimer = setTimeout(() => {
          try {
            // play() may return a rejected promise (e.g. autoplay policy) — swallow it
            void Promise.resolve(player?.play()).catch(() => {});
          } catch {
            // ignore playback errors — audio is a non-critical extra
          }
        }, 420);
      } catch {
        // Audio is a delightful extra — never block the splash if it fails
      }
    })();

    return () => {
      if (exhaleTimer) clearTimeout(exhaleTimer);
      try {
        player?.remove();
      } catch {
        // ignore teardown errors
      }
    };
  }, []);

  useEffect(() => {
    // Fire one subtle haptic tap right at the bloom peak
    const hapticListener = bloom.addListener(({ value }) => {
      if (!hapticFired.current && value >= 0.92) {
        hapticFired.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    });

    Animated.sequence([
      Animated.delay(340),

      // Rush + bloom: pinpoint rockets toward you and overshoots
      Animated.parallel([
        Animated.timing(bloom, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.16, 0.84, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: 460,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flash, {
            toValue: 0,
            duration: 640,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Settle back from the overshoot into a calm glow
      Animated.timing(bloom, {
        toValue: 0.62,
        duration: 760,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),

      // Wordmark emerges from within the warmth
      Animated.parallel([
        Animated.timing(wordmarkOp, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(wordmarkScale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(taglineOp, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Constant logo + wordmark flash loop after the reveal settles
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(logoFlash, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkFlash, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(logoFlash, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkFlash, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ).start();
    });

    // Calm breathing loop on the settled glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => {
      bloom.removeListener(hapticListener);
    };
  }, [bloom, flash, wordmarkOp, wordmarkScale, taglineOp, breathe, logoFlash, wordmarkFlash]);

  // Dismiss on hide
  useEffect(() => {
    if (!visible) {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onAnimationComplete?.();
      });
    }
  }, [visible, containerOpacity, onAnimationComplete]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const cx = width / 2;
  const cy = height * 0.42;
  // Diagonal so the bloom can fully cover the screen at peak
  const maxR = Math.hypot(width, height) * 0.62;

  const breatheAdd = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] });
  // Scale a static circle instead of animating the SVG radius — animating a
  // react-native-svg Circle leaks `collapsable` onto the DOM node on web.
  const glowScale = Animated.add(bloom, breatheAdd);

  const glowOpacity = bloom.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [0.9, 0.95, 1],
  });

  const logoFlashOpacity = logoFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const logoFlashScale = logoFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const wordmarkFlashOpacity = wordmarkFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  const LOGO_SIZE = 132;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: containerOpacity, pointerEvents: visible ? ('auto' as const) : ('none' as const) }]}
      testID="brand-splash"
    >
      {/* Near-black void */}
      <LinearGradient
        colors={[VOID_TOP, '#070B12', VOID_BOT]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Aperture bloom — a static circle scaled by an Animated wrapper */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - maxR,
          top: cy - maxR,
          width: maxR * 2,
          height: maxR * 2,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
          pointerEvents: 'none' as const,
        }}
      >
        <Svg width={maxR * 2} height={maxR * 2}>
          <Defs>
            <RadialGradient id="aperture" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={BLUE_CORE} stopOpacity={0.95} />
              <Stop offset="16%" stopColor={BLUE_LIGHT} stopOpacity={0.78} />
              <Stop offset="38%" stopColor={BLUE} stopOpacity={0.55} />
              <Stop offset="62%" stopColor={BLUE_MID} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={BLUE_DEEP} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={maxR} cy={maxR} r={maxR} fill="url(#aperture)" />
        </Svg>
      </Animated.View>

      {/* White-hot flash at the peak of the bloom */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: BLUE_CORE, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }), pointerEvents: 'none' as const }]}
      />

      {/* Logo + wordmark + tagline, revealed within the warmth */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: cy - 90,
          alignItems: 'center',
          pointerEvents: 'none' as const,
        }}
      >
        <Animated.View
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            opacity: Animated.multiply(wordmarkOp, logoFlashOpacity),
            transform: [{ scale: Animated.multiply(wordmarkScale, logoFlashScale) }],
            marginBottom: 18,
          }}
        >
          <BrandLogoWithBox logoSize={LOGO_SIZE} />
        </Animated.View>
        <Animated.Text
          style={{
            color: TEXT_WARM,
            fontSize: 36,
            fontWeight: '800',
            fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : undefined,
            letterSpacing: 5,
            textAlign: 'center',
            opacity: Animated.multiply(wordmarkOp, wordmarkFlashOpacity),
            transform: [{ scale: wordmarkScale }],
          }}
        >
          Porchivo
        </Animated.Text>
        <Animated.Text
          style={{
            marginTop: 12,
            color: TEXT_SUB,
            fontSize: 11,
            fontWeight: '600',
            fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : undefined,
            letterSpacing: 3.4,
            textTransform: 'uppercase',
            textAlign: 'center',
            opacity: taglineOp,
          }}
        >
          Protect what arrives.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 9999,
    elevation: 9999,
  },
});
