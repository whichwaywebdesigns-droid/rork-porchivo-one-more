import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimaryCTAProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Show the trailing arrow. Default true. */
  showArrow?: boolean;
  testID?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * The single primary action per screen. Clear, accessible contrast; a quiet
 * press-scale; medium haptic on commit. Never loud.
 */
export default function PrimaryCTA({
  label,
  onPress,
  disabled = false,
  loading = false,
  showArrow = true,
  testID,
  style,
}: PrimaryCTAProps) {
  const Colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() =>
        !disabled &&
        !loading &&
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
      }
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      style={[
          styles.button,
          {
            backgroundColor: disabled ? Colors.elevated : Colors.primary,
            shadowColor: Colors.primary,
            shadowOpacity: disabled ? 0 : 0.28,
            transform: [{ scale }],
          },
          style as ViewStyle,
        ]}
    >
        {loading ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <View style={styles.row}>
            <Text
              style={[styles.label, { color: disabled ? Colors.slateLighter : Colors.onPrimary }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {showArrow ? (
              <ArrowRight
                size={18}
                color={disabled ? Colors.slateLighter : Colors.onPrimary}
                strokeWidth={2.5}
              />
            ) : null}
          </View>
        )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
