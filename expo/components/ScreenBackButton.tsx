import React, { useCallback } from 'react';
import { Platform, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { useColors } from '@/constants/colors';

interface ScreenBackButtonProps {
  onPress: () => void;
  testID?: string;
  style?: ViewStyle;
}

/**
 * Standard back button for all regular (light/dark) screens.
 * Uses ChevronLeft at 24px, theme-adaptive text color, haptic feedback.
 * Consistent across every screen — use this instead of inline back buttons.
 */
export default function ScreenBackButton({ onPress, testID, style }: ScreenBackButtonProps) {
  const Colors = useColors();

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={handlePress}
      activeOpacity={0.6}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID={testID ?? 'screen-back'}
    >
      <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
