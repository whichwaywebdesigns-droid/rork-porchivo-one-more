import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

interface ParallaxLayerProps {
  children: React.ReactNode;
  /** Depth factor — higher values move more in response to scroll.
   *  Positive = moves same direction as scroll (background). 
   *  Negative = moves opposite (foreground pops). Default 0.5. */
  depth?: number;
  /** Perspective for the 3D transform. Default 1000. */
  perspective?: number;
  /** Optional initial entrance: rotates in from the given axis. */
  entrance?: 'rotateX' | 'rotateY' | 'both' | 'none';
  /** Entrance delay in ms. Default 0. */
  entranceDelay?: number;
  /** Style override for the animated container. */
  style?: ViewStyle | ViewStyle[];
}

/**
 * A layer that applies 3D perspective + parallax depth movement.
 *
 * Inspired by the layered depth transitions on Neu Web Studio /
 * wearebrand.io — elements at different "depths" move at different
 * rates, creating a subtle parallax cinemagraph effect.
 *
 * When `entrance` is set, the layer animates in from a rotated state
 * on mount, giving the onboarding screens a 3D reveal.
 */
export default function ParallaxLayer({
  children,
  depth = 0.5,
  perspective = 1000,
  entrance = 'none',
  entranceDelay = 0,
  style,
}: ParallaxLayerProps) {
  const rotateX = useSharedValue(entrance === 'rotateX' || entrance === 'both' ? -25 : 0);
  const rotateY = useSharedValue(entrance === 'rotateY' || entrance === 'both' ? 15 : 0);
  const opacity = useSharedValue(entrance !== 'none' ? 0 : 1);
  const translateY = useSharedValue(entrance !== 'none' ? 40 : 0);
  const scale = useSharedValue(entrance !== 'none' ? 0.9 : 1);

  useEffect(() => {
    if (entrance === 'none') return;

    const config = { duration: 700, easing: Easing.out(Easing.cubic) };
    const springConfig = { damping: 18, stiffness: 120, mass: 0.9 };

    opacity.value = withDelay(entranceDelay, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(entranceDelay, withSpring(0, springConfig));
    scale.value = withDelay(entranceDelay, withSpring(1, springConfig));
    rotateX.value = withDelay(entranceDelay, withSpring(0, springConfig));
    rotateY.value = withDelay(entranceDelay, withSpring(0, springConfig));
  }, [entrance, entranceDelay, opacity, translateY, scale, rotateX, rotateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { perspective },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.container, style as ViewStyle, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Callers provide their own sizing
  },
});
