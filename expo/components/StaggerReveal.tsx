import React from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { View, ViewStyle } from 'react-native';

interface StaggerRevealProps {
  children: React.ReactNode[];
  staggerMs?: number;
  style?: ViewStyle;
  initialDelay?: number;
}

/**
 * Wraps each child in a staggered spring entrance animation.
 * Each item slides up and fades in with a configurable stagger interval.
 */
export function StaggerReveal({
  children,
  staggerMs = 80,
  style,
  initialDelay = 0,
}: StaggerRevealProps) {
  return (
    <View style={style}>
      {React.Children.map(children, (child, index) => (
        <Animated.View
          key={index}
          entering={FadeInUp.delay(initialDelay + index * staggerMs)
            .duration(560)
            .springify()
            .damping(18)
            .stiffness(120)}
        >
          {child}
        </Animated.View>
      ))}
    </View>
  );
}
