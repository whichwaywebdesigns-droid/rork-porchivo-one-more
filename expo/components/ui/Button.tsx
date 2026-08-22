import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { palette, radius, space } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ember' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle | ViewStyle[];
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

function getStyles(variant: Variant): { container: ViewStyle; text: TextStyle } {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: palette.accent,
          shadowColor: palette.accent,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        text: { color: palette.onAccent },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: palette.bgElevated,
          borderWidth: 1,
          borderColor: palette.borderDark,
        },
        text: { color: palette.textPrimary },
      };
    case 'tonal':
      return {
        container: { backgroundColor: palette.accentGlow },
        text: { color: palette.accent },
      };
    case 'ember':
      return {
        container: { backgroundColor: palette.warmOrange },
        text: { color: palette.textPrimary },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: palette.accent },
      };
    case 'destructive':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: palette.danger },
      };
  }
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  trailingIcon,
  loading,
  disabled,
  fullWidth,
  testID,
  style,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const variantStyles = getStyles(variant);

  const handleIn = () => {
    if (!disabled && !loading) {
      // Light tick on press — keeps tap feedback consistent with native builds.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handleOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <AnimatedPressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
          styles.base,
          {
            height: HEIGHT[size],
            paddingHorizontal: size === 'sm' ? space.md : space.xl,
            opacity: disabled ? 0.5 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          variantStyles.container,
          { transform: [{ scale }] },
          style as ViewStyle,
        ]}
    >
        {loading ? (
          <ActivityIndicator size="small" color={variantStyles.text.color as string} />
        ) : (
          <View style={styles.row}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text
              style={[
                styles.label,
                { fontSize: FONT[size] },
                variantStyles.text,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
          </View>
        )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});
