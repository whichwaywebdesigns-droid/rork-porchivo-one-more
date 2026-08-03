import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// ── Tunables ────────────────────────────────────────────────────────────────
const SPRING = { damping: 20, stiffness: 110, mass: 0.9 };
const BLUR_DURATION = 700;

export type RevealAxis = 'rotateY' | 'rotateX' | 'both' | 'none';

interface ImmersiveRevealProps {
  children: React.ReactNode;
  /** Delay before the reveal begins, ms. */
  delay?: number;
  /** Which axis the layer rotates in from. Default 'rotateY'. */
  axis?: RevealAxis;
  /** Initial translate-Y travel, px. Default 36. */
  translateY?: number;
  /** Initial scale. Default 0.92. */
  scale?: number;
  /** Initial rotate magnitude in degrees. Default 18. */
  rotate?: number;
  /** Initial blur radius, px. Animated down to 0. Default 12. */
  blur?: number;
  /** Style override for the animated container. */
  style?: ViewStyle | ViewStyle[];
}

/**
 * Neu Web Studio-style immersive reveal.
 *
 * Each wrapped layer animates in with a layered, cinematic entrance:
 *   • blur-to-focus   (start soft, sharpen into view)
 *   • 3D rotate       (rotateY / rotateX off-axis → upright)
 *   • scale-up        (slightly undersized → full size)
 *   • translate-Y     (rises into place)
 *   • opacity fade
 *
 * Stagger multiple `ImmersiveReveal` wrappers with increasing `delay`
 * to get the parallax-depth cascade where far layers lead and near
 * layers follow — the signature Neu Web Studio transition feel.
 */
export default function ImmersiveReveal({
  children,
  delay = 0,
  axis = 'rotateY',
  translateY = 36,
  scale = 0.92,
  rotate = 18,
  blur = 12,
  style,
}: ImmersiveRevealProps) {
  const progress = useSharedValue(0);
  const rotateX = useSharedValue(axis === 'rotateX' || axis === 'both' ? -rotate : 0);
  const rotateY = useSharedValue(axis === 'rotateY' || axis === 'both' ? rotate : 0);
  const ty = useSharedValue(translateY);
  const sc = useSharedValue(scale);
  const op = useSharedValue(0);

  useEffect(() => {
    // Blur fades on a timing; the rest spring into place for a settle.
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: BLUR_DURATION, easing: Easing.out(Easing.cubic) }),
    );
    op.value = withDelay(
      delay,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
    );
    ty.value = withDelay(delay, withSpring(0, SPRING));
    sc.value = withDelay(delay, withSpring(1, SPRING));
    rotateX.value = withDelay(delay, withSpring(0, SPRING));
    rotateY.value = withDelay(delay, withSpring(0, SPRING));
  }, [delay, progress, op, ty, sc, rotateX, rotateY, axis, rotate, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    // Blur only supported on iOS / web; falls back gracefully on Android.
    const blurRadius = interpolate(
      progress.value,
      [0, 1],
      [blur, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: op.value,
      transform: [
        { perspective: 1200 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
        { translateY: ty.value },
        { scale: sc.value },
      ],
      // filterBlur is a Reanimated animated prop (iOS/web only)
      filterBlur: blurRadius,
    };
  });

  return (
    <Animated.View style={[style as ViewStyle, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Container that dims + blurs the whole screen briefly on mount, then
 * "opens" to reveal the page — the Neu Web Studio page-load feel.
 * Wrap the whole screen body once; children stagger underneath.
 */
export function ImmersiveScene({ children }: { children: React.ReactNode }) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal]);

  const sceneStyle = useAnimatedStyle(() => {
    const blurRadius = interpolate(
      reveal.value,
      [0, 1],
      [14, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(reveal.value, [0, 1], [1.04, 1], Extrapolation.CLAMP);
    const opacity = interpolate(reveal.value, [0, 1], [0.2, 1], Extrapolation.CLAMP);
    return {
      flex: 1,
      opacity,
      transform: [{ scale }],
      // filterBlur is a Reanimated animated prop (iOS/web only)
      filterBlur: blurRadius,
    };
  });

  return <Animated.View style={sceneStyle}>{children}</Animated.View>;
}

export { View };
