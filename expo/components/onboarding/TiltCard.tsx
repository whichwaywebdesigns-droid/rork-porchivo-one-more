import React, { useCallback, useRef } from 'react';
import {
  StyleSheet,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SPRING_BACK = { damping: 16, stiffness: 180, mass: 0.9 };
const SPRING_PRESS = { damping: 20, stiffness: 320, mass: 0.8 };

interface TiltCardProps {
  children: React.ReactNode;
  /** Perspective depth — higher = more dramatic. Default 900. */
  perspective?: number;
  /** Max rotation degrees. Default 12. */
  maxTilt?: number;
  /** Scale factor when pressed. Default 0.97. */
  pressScale?: number;
  /** Whether the card springs back when released. Default true. */
  springBack?: boolean;
  /** Called when the card is tapped (without drag). */
  onPress?: () => void;
  /** Extra styles for the card container. */
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

/**
 * A card that tilts in 3D space following the user's touch — inspired by
 * the interactive hover-tilt effects on Neu Web Studio / wearebrand.io,
 * adapted for mobile.
 *
 * Uses raw touch events (not gesture handlers) so it works perfectly
 * inside ScrollViews without hijacking scroll. The card rotates on
 * rotateX/rotateY based on where the finger lands relative to the card
 * center, creating a parallax sense of depth. Springs back to neutral
 * on release with a satisfying dampened return.
 */
export default function TiltCard({
  children,
  perspective = 900,
  maxTilt = 12,
  pressScale = 0.97,
  springBack = true,
  onPress,
  style,
  testID,
}: TiltCardProps) {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const widthRef = useRef<number>(0);
  const heightRef = useRef<number>(0);
  const pressLocationRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    heightRef.current = e.nativeEvent.layout.height;
  }, []);

  const handleTouchStart = useCallback(
    (e: any) => {
      hasMovedRef.current = false;
      pressLocationRef.current = {
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
      };
      scale.value = withSpring(pressScale, SPRING_PRESS);
    },
    [pressScale, scale],
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      hasMovedRef.current = true;
      const w = widthRef.current || 1;
      const h = heightRef.current || 1;
      const px = e.nativeEvent.locationX;
      const py = e.nativeEvent.locationY;

      // Normalized -1..1 from center
      const dx = (px / w) * 2 - 1;
      const dy = (py / h) * 2 - 1;

      // Tilt: finger right → right edge goes back (negative rotateY)
      //       finger down → bottom edge goes back (positive rotateX)
      rotateY.value = interpolate(
        dx,
        [-1, 1],
        [maxTilt, -maxTilt],
        Extrapolation.CLAMP,
      );
      rotateX.value = interpolate(
        dy,
        [-1, 1],
        [-maxTilt, maxTilt],
        Extrapolation.CLAMP,
      );
    },
    [maxTilt, rotateX, rotateY],
  );

  const handleTouchEnd = useCallback(() => {
    scale.value = withSpring(1, SPRING_BACK);
    if (springBack) {
      rotateX.value = withSpring(0, SPRING_BACK);
      rotateY.value = withSpring(0, SPRING_BACK);
    }

    // If the user tapped without moving, fire onPress
    if (!hasMovedRef.current && onPress) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
    pressLocationRef.current = null;
  }, [springBack, scale, rotateX, rotateY, onPress]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[styles.container, style as ViewStyle]}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      testID={testID}
    >
      <Animated.View style={[styles.inner, cardStyle]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Outer container stays flat — the inner view does the tilting
  },
  inner: {
    flex: 1,
  },
});
