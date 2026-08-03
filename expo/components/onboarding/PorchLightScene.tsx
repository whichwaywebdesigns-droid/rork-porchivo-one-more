import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, RadialGradient, Defs, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Signature success chime — a warm crystal-bell bloom timed with the porch light.
const VERIFIED_CHIME = require('@/assets/audio/porch-light-verified-chime.mp3');
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';

/** Three visual states for the porch light hero scene. */
export type PorchLightStage = 'idle' | 'authenticating' | 'verified';

interface PorchLightSceneProps {
  stage: PorchLightStage;
  /** Diameter of the scene's viewBox in px. Default 260. */
  size?: number;
}

/**
 * Signature porch-light hero: a house silhouette with a porch lamp that blooms
 * from a dim idle bulb to a hot amber beacon on authentication, with ripple
 * rings during verification and a "porch light's on — welcome home" status line
 * once verified. The visual metaphor for Porchivo's biometric unlock.
 */
export default function PorchLightScene({ stage, size = 260 }: PorchLightSceneProps) {
  const glow = useSharedValue(0); // 0 idle, 1 lit
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const bulbR = useSharedValue(7);
  const haloR = useSharedValue(16);
  // Gentle success pulse — only runs in the 'verified' stage.
  const verifiedPulse = useSharedValue(0);
  // Haptic timers for the verified pulse pattern.
  const hapticTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Audio player for the verified chime — kept on a ref so it can be torn down cleanly.
  const chimePlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    // Clear any pending haptic timers from a previous stage.
    hapticTimers.current.forEach(clearTimeout);
    hapticTimers.current = [];

    // Tear down any chime player from a previous verified stage.
    try {
      chimePlayerRef.current?.remove();
    } catch {
      // ignore teardown errors
    }
    chimePlayerRef.current = null;

    // Drive the glow + rings based on stage
    cancelAnimation(glow);
    cancelAnimation(ringA);
    cancelAnimation(ringB);
    cancelAnimation(verifiedPulse);

    if (stage === 'authenticating') {
      glow.value = withTiming(0.6, { duration: 300, easing: Easing.out(Easing.quad) });
      haloR.value = withTiming(26, { duration: 600, easing: Easing.out(Easing.cubic) });
      // Two staggered ripple rings, looping
      ringA.value = 0;
      ringB.value = 0;
      ringA.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      ringB.value = withDelay(
        350,
        withRepeat(
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
    } else if (stage === 'verified') {
      glow.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      haloR.value = withTiming(30, { duration: 500, easing: Easing.out(Easing.cubic) });
      bulbR.value = withSequence(
        withTiming(9, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(7.5, { duration: 200, easing: Easing.inOut(Easing.quad) })
      );
      // Slow, gentle breathing pulse to emphasize successful entry.
      verifiedPulse.value = 0;
      verifiedPulse.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );

      // Haptic pattern synced to the light pulse:
      //   t=0      → success chime (the "porch light's on" moment)
      //   t=400ms  → soft tick at first pulse peak (matches the 400ms delay)
      //   then a Light impact at each subsequent peak (every 2200ms),
      //   limited to 3 cycles so it never drones on.
      const fireHaptic = (delay: number, fn: () => void) => {
        const t = setTimeout(fn, delay);
        hapticTimers.current.push(t);
      };
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        fireHaptic(0, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}));
        const pulseCycleMs = 2200;
        const peakOffsetMs = 400; // matches withDelay before the breathing loop
        for (let i = 0; i < 3; i++) {
          const at = peakOffsetMs + i * pulseCycleMs + 1100; // 1100ms into cycle = peak
          fireHaptic(at, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}));
        }

        // Signature success chime — plays simultaneously with the initial haptic.
        // Audio is a delightful extra; never block the verified state if it fails.
        (async () => {
          try {
            // Respect the silent switch; the chime is a gentle ambient accent.
            await setAudioModeAsync({ playsInSilentMode: false });
            const player = createAudioPlayer(VERIFIED_CHIME);
            player.volume = 0.85;
            chimePlayerRef.current = player;
            try {
              void Promise.resolve(player.play()).catch(() => {});
            } catch {
              // ignore playback errors — audio is non-critical
            }
          } catch {
            // ignore setup errors — audio is non-critical
          }
        })();
      }
    } else {
      glow.value = withTiming(0, { duration: 280, easing: Easing.inOut(Easing.quad) });
      haloR.value = withTiming(16, { duration: 400, easing: Easing.out(Easing.cubic) });
      bulbR.value = withTiming(7, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    // Clear pending haptics + chime player on unmount.
    return () => {
      hapticTimers.current.forEach(clearTimeout);
      hapticTimers.current = [];
      try {
        chimePlayerRef.current?.remove();
      } catch {
        // ignore teardown errors
      }
      chimePlayerRef.current = null;
    };
  }, []);

  // Animated ring styles (SVG circles can't take animated props directly, so we
  // render them as Animated.View wrappers with native transforms).
  const ringAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ringA.value, [0, 1], [0.4, 2.6], Extrapolation.CLAMP) }],
    opacity: interpolate(ringA.value, [0, 1], [0.55, 0], Extrapolation.CLAMP),
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ringB.value, [0, 1], [0.4, 2.6], Extrapolation.CLAMP) }],
    opacity: interpolate(ringB.value, [0, 1], [0.55, 0], Extrapolation.CLAMP),
  }));

  // Verified-only outer glow ring — a soft amber halo that breathes outward.
  const verifiedRingStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(verifiedPulse.value, [0, 1], [1, 1.55], Extrapolation.CLAMP),
      },
    ],
    opacity: interpolate(verifiedPulse.value, [0, 1], [0, 0.5], Extrapolation.CLAMP),
  }));

  const haloStyle = useAnimatedStyle(() => {
    const baseScale = interpolate(haloR.value, [16, 30], [1, 1.875], Extrapolation.CLAMP);
    // Subtle ±4% scale + opacity breath layered on the halo when verified.
    const pulseScale = 1 + interpolate(verifiedPulse.value, [0, 1], [0, 0.04], Extrapolation.CLAMP);
    const baseOpacity = interpolate(glow.value, [0, 0.6, 1], [0.35, 0.7, 0.92], Extrapolation.CLAMP);
    const pulseOpacity = interpolate(verifiedPulse.value, [0, 1], [0, 0.08], Extrapolation.CLAMP);
    return {
      transform: [{ scale: baseScale * pulseScale }],
      opacity: baseOpacity + pulseOpacity,
    };
  });

  // Center of the porch light in viewBox units
  const cx = 168;
  const cy = 126;
  // Scale factor from viewBox (260) → rendered size
  const k = size / 260;

  return (
    <View style={[styles.wrap, { width: size, height: size * (220 / 260) }]}>
      <Svg viewBox="0 0 260 220" width={size} height={size * (220 / 260)}>
        <Defs>
          <RadialGradient id="porchGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={stage === 'idle' ? '#F5A855' : '#FFE3B0'} />
            <Stop
              offset="100%"
              stopColor="#F5A855"
              stopOpacity={stage === 'idle' ? 0.35 : 0.9}
            />
          </RadialGradient>
        </Defs>

        {/* House silhouette */}
        <Path d="M30 220 V140 L130 70 L230 140 V220 Z" fill="#0A1428" stroke="#1c2c4a" strokeWidth="2" />
        {/* Roof */}
        <Path
          d="M18 148 L130 62 L242 148"
          fill="none"
          stroke="#1c2c4a"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Door */}
        <Path d="M112 168 h36 v52 h-36 Z" fill="#050b18" />
        {/* Porch light fixture arm */}
        <Line x1="168" y1="150" x2="168" y2="132" stroke="#3a2c1a" strokeWidth="3" />
      </Svg>

      {/* Verified-only outer glow ring — a soft amber halo that breathes outward */}
      {stage === 'verified' && (
        <Animated.View
          style={[
            styles.verifiedRing,
            {
              left: cx * k - 48,
              top: cy * k - 48,
              width: 96,
              height: 96,
              borderRadius: 48,
            },
            verifiedRingStyle,
          ]}
          pointerEvents="none"
        />
      )}

      {/* Glow halo (animated) — overlay aligned to the bulb position */}
      <Animated.View
        style={[
          styles.halo,
          {
            left: cx * k - 30,
            top: cy * k - 30,
            width: 60,
            height: 60,
            borderRadius: 30,
          },
          haloStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={60} height={60}>
          <Defs>
            <RadialGradient id="porchHaloGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={stage === 'idle' ? '#F5A855' : '#FFE3B0'} stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#F5A855" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={30} cy={30} r={30} fill="url(#porchHaloGlow)" />
        </Svg>
      </Animated.View>

      {/* Ripple rings while authenticating */}
      {stage === 'authenticating' && (
        <>
          <Animated.View
            style={[
              styles.ring,
              {
                left: cx * k - 22,
                top: cy * k - 22,
                width: 44,
                height: 44,
                borderRadius: 22,
              },
              ringAStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.ring,
              {
                left: cx * k - 22,
                top: cy * k - 22,
                width: 44,
                height: 44,
                borderRadius: 22,
              },
              ringBStyle,
            ]}
            pointerEvents="none"
          />
        </>
      )}

      {/* Bulb (animated radius via scale) */}
      <Animated.View
        style={[
          styles.bulb,
          {
            left: cx * k - 8,
            top: cy * k - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: stage === 'idle' ? '#8a5a2a' : '#FFE3B0',
          },
        ]}
      />
    </View>
  );
}

/** Status line beneath the porch light scene — copy mirrors the concept. */
export function PorchLightStatus({ stage }: { stage: PorchLightStage }) {
  if (stage === 'verified') {
    return (
      <View style={styles.statusRow}>
        <ShieldCheck size={14} color="#FFE3B0" />
        <Animated.Text style={styles.statusVerified}>Porch light's on — welcome home</Animated.Text>
      </View>
    );
  }
  if (stage === 'authenticating') {
    return <Animated.Text style={styles.statusAuth}>Verifying…</Animated.Text>;
  }
  return <Animated.Text style={styles.statusIdle}>Ready when you are</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  verifiedRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFE3B0',
    shadowColor: '#F5A855',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#F5A855',
  },
  bulb: {
    position: 'absolute',
    shadowColor: '#F5A855',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusVerified: {
    color: '#FFE3B0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  statusAuth: {
    color: 'rgba(245, 168, 85, 0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  statusIdle: {
    color: 'rgba(201, 214, 232, 0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
