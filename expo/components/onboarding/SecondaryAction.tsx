import React from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

interface SecondaryActionProps {
  label: string;
  onPress: () => void;
  /** 'muted' = low-emphasis text link; 'tonal' = subtle filled pill. */
  emphasis?: 'muted' | 'tonal';
  testID?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Low-emphasis secondary text action (e.g. "Sign in", "Skip for now",
 * "Continue with limited access"). Calm by default, never competing with the
 * primary CTA.
 */
export default function SecondaryAction({
  label,
  onPress,
  emphasis = 'muted',
  testID,
  style,
}: SecondaryActionProps) {
  const Colors = useColors();

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  const containerStyle: ViewStyle =
    emphasis === 'tonal'
      ? {
          paddingVertical: 13,
          borderRadius: 14,
          backgroundColor: Colors.elevated,
        }
      : { paddingVertical: 12 };

  const textStyle: TextStyle = {
    color: emphasis === 'tonal' ? Colors.slate : Colors.slateLight,
    fontWeight: emphasis === 'tonal' ? '600' : '600',
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.base, containerStyle, style as ViewStyle]}
      testID={testID}
    >
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
});
