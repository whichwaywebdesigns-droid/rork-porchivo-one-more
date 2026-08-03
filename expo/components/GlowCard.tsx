import React, { useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Pressable, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radius } from '@/constants/theme';

interface GlowCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  glowColor?: string;
  disabled?: boolean;
}

/**
 * A dark card that reveals a diagonal glow gradient on press and springs back.
 * Drop-in replacement for TouchableOpacity on card components.
 */
export function GlowCard({
  children,
  onPress,
  style,
  glowColor = palette.accentGlow,
  disabled = false,
}: GlowCardProps) {
  const glowOpacity = useSharedValue(0);
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    glowOpacity.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(0.975, { damping: 22, stiffness: 320 });
  }, [glowOpacity, scale]);

  const onPressOut = useCallback(() => {
    glowOpacity.value = withTiming(0, { duration: 340 });
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [glowOpacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View style={[styles.card, style, cardStyle]}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.glowOverlay, glowStyle]}>
          <LinearGradient
            colors={['transparent', glowColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderDark,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glowOverlay: {
    zIndex: 0,
    borderRadius: radius.lg,
  },
});
