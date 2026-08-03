import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette } from '@/constants/theme';

interface DarkRailHeaderProps {
  status: string;
  dotColor?: string;
  style?: ViewStyle;
}

/**
 * Shared dark "rail" header used across the onboarding flow
 * (welcome, intro, login, role-selection, post-signup) for visual continuity.
 */
export default function DarkRailHeader({
  status,
  dotColor = palette.railAccent,
  style,
}: DarkRailHeaderProps) {
  return (
    <View style={[styles.rail, style]} testID="dark-rail-header">
      <Text style={styles.brand}>PORCHIVO</Text>
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.railBg,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.railBorder,
  },
  brand: {
    color: palette.railText,
    fontSize: 13,
    fontWeight: '900' as const,
    letterSpacing: 2.4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.railBorderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.railSurface,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    marginRight: 7,
  },
  statusText: {
    color: palette.railTextMuted,
    fontSize: 10,
    fontWeight: '900' as const,
    letterSpacing: 1,
  },
});
