import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useColors } from '@/constants/colors';

const SPRING = { damping: 14, stiffness: 180, mass: 0.9 };

interface SecuritySuccessOverlayProps {
  /** Toggle visibility. Auto-dismisses after `autoDismissMs`. */
  visible: boolean;
  /** Optional callback once the overlay has fully faded out. */
  onComplete?: () => void;
  /** Auto-dismiss delay. Default 1150ms. */
  autoDismissMs?: number;
}

/**
 * Animated shield / lock micro-interaction shown briefly on a successful
 * login. A ring blooms from the center, a check draws in, and the whole
 * thing fades — communicating "your data is encrypted" without words.
 *
 * Designed to overlay the auth screen on success before the route handoff.
 */
export default function SecuritySuccessOverlay({
  visible,
  onComplete,
  autoDismissMs = 1150,
}: SecuritySuccessOverlayProps) {
  const Colors = useColors();
  const bloom = useSharedValue(0);
  const check = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Fade in fast
      opacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
      // Bloom ring
      ringScale.value = withSpring(1, SPRING);
      bloom.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      // Check draws after bloom settles
      check.value = withDelay(220, withSpring(1, { damping: 12, stiffness: 220, mass: 0.8 }));

      const stop = () => {
        opacity.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished && onComplete) runOnJS(onComplete)();
        });
      };
      const t = setTimeout(stop, autoDismissMs);
      return () => clearTimeout(t);
    } else {
      opacity.value = 0;
      bloom.value = 0;
      check.value = 0;
      ringScale.value = 0.6;
    }
  }, [visible, autoDismissMs, bloom, check, ringScale, opacity, onComplete]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: interpolate(bloom.value, [0, 0.6, 1], [0, 1, 0.85], Extrapolation.CLAMP),
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.4, 1.6], Extrapolation.CLAMP) }],
    opacity: interpolate(bloom.value, [0, 0.5, 1], [0.5, 0.35, 0], Extrapolation.CLAMP),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: interpolate(check.value, [0, 1], [0.3, 1], Extrapolation.CLAMP) }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, overlayStyle]} pointerEvents="none">
      <View style={styles.center}>
        {/* Bloom halo */}
        <Animated.View
          style={[styles.bloom, { backgroundColor: Colors.primary }, bloomStyle]}
        />
        {/* Ring */}
        <Animated.View
          style={[
            styles.ring,
            { borderColor: Colors.primary, backgroundColor: Colors.primary },
            ringStyle,
          ]}
        >
          <Animated.View style={checkStyle}>
            <Check size={36} color={Colors.onPrimary} strokeWidth={3.2} />
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.4,
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A7BD5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 12,
  },
});
