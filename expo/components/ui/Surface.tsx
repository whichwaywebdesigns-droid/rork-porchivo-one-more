import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { palette, radius, space, elevation } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'card' | 'inset' | 'hero' | 'flat';

interface SurfaceProps extends ViewProps {
  variant?: Variant;
  pressable?: boolean;
  onPress?: () => void;
  padding?: keyof typeof space | 0;
  tone?: 'default' | 'sky' | 'ember' | 'gold' | 'sage' | 'rose';
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  testID?: string;
}

const TONE_BG: Record<NonNullable<SurfaceProps['tone']>, string> = {
  default: palette.surface,
  sky: palette.sky,
  ember: palette.emberSoft,
  gold: palette.goldSoft,
  sage: palette.sageSoft,
  rose: palette.roseSoft,
};

export default function Surface({
  variant = 'card',
  pressable,
  onPress,
  padding = 'lg',
  tone = 'default',
  style,
  children,
  testID,
  ...rest
}: SurfaceProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleIn = () => {
    if (!pressable) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handleOut = () => {
    if (!pressable) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const base: ViewStyle = {
    backgroundColor: TONE_BG[tone],
    borderRadius: variant === 'hero' ? radius.xl : radius.lg,
    padding: padding === 0 ? 0 : space[padding],
    ...(variant === 'card' ? elevation.low : variant === 'hero' ? elevation.raised : elevation.none),
    ...(variant === 'inset' ? { borderWidth: 1, borderColor: palette.slate200 } : null),
  };

  if (pressable && onPress) {
    return (
      <AnimatedPressable
        testID={testID}
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        accessibilityRole="button"
        style={[base, style as ViewStyle, { transform: [{ scale }] }]}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View
      testID={testID}
      style={[base, style as ViewStyle, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

export const surfaceStyles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: palette.slate100,
    marginVertical: space.md,
  },
});
