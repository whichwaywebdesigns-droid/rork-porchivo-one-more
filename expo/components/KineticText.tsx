import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { View, StyleSheet, TextStyle, ViewStyle } from 'react-native';

interface KineticTextProps {
  text: string;
  style?: TextStyle;
  delay?: number;
  duration?: number;
  containerStyle?: ViewStyle;
}

/**
 * Animated text that clips upward into view — like a reveal shutter.
 * Use for hero headlines and section titles.
 */
export function KineticText({
  text,
  style,
  delay = 0,
  duration = 600,
  containerStyle,
}: KineticTextProps) {
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: duration * 0.7, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, duration, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.clip, containerStyle]}>
      <Animated.Text style={[style, animStyle]}>{text}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
