import React from 'react';
import { Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';

interface OnboardingScreenProps {
  children: React.ReactNode;
  /** Optional fixed footer (CTAs) pinned above the safe-area inset. */
  footer?: React.ReactNode;
  /** Subtle ambient glow in the top corner for depth. Default true. */
  glow?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
}

/**
 * Premium screen container for the onboarding flow.
 *
 * Provides the calm neutral background, safe-area padding, a single soft
 * ambient glow for depth, and an optional pinned footer for the one primary
 * action per screen. Theme-reactive (light/dark friendly).
 */
export default function OnboardingScreen({
  children,
  footer,
  glow = true,
  contentStyle,
}: OnboardingScreenProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {glow ? (
        <View style={styles.glow} pointerEvents="none">
          <LinearGradient
            colors={[Colors.primaryLight, 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8 },
          contentStyle as ViewStyle,
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
});
