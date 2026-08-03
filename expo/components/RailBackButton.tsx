import React, { useCallback } from 'react';
import { Platform, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { palette } from '@/constants/theme';

interface RailBackButtonProps {
  onPress: () => void;
  testID?: string;
  style?: ViewStyle;
}

/**
 * Back button matching the dark-rail onboarding aesthetic.
 * Used alongside DarkRailHeader on welcome / intro / login / role-selection / post-signup.
 */
export default function RailBackButton({ onPress, testID, style }: RailBackButtonProps) {
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
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID ?? 'rail-back'}
    >
      <ChevronLeft size={22} color={palette.railText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.railSurface,
    borderWidth: 1,
    borderColor: palette.railBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
