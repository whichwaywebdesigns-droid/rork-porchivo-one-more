import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeSlideInProps {
  children: React.ReactNode;
  /** Delay before the entrance begins, ms. Use for staggered reveals. */
  delay?: number;
  /** Vertical travel distance, px. Kept small for a composed feel. */
  offset?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Quiet entrance primitive: a brief, elegant fade + slight upward slide.
 * No bouncing, no looping — motion only guides attention to what just arrived.
 */
export default function FadeSlideIn({
  children,
  delay = 0,
  offset = 14,
  duration = 460,
  style,
}: FadeSlideInProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}
