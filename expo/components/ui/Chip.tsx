import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { palette, radius, space } from '@/constants/theme';

type Tone = 'navy' | 'ember' | 'sage' | 'rose' | 'gold' | 'slate';

interface ChipProps {
  label: string;
  tone?: Tone;
  icon?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const TONES: Record<Tone, { fg: string; bg: string }> = {
  navy: { fg: palette.navy, bg: palette.sky },
  ember: { fg: palette.emberDeep, bg: palette.emberSoft },
  sage: { fg: palette.sage, bg: palette.sageSoft },
  rose: { fg: palette.rose, bg: palette.roseSoft },
  gold: { fg: palette.gold, bg: palette.goldSoft },
  slate: { fg: palette.slate700, bg: palette.slate100 },
};

export default function Chip({ label, tone = 'navy', icon, selected, onPress, style }: ChipProps) {
  const t = TONES[tone];
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        { backgroundColor: t.bg },
        selected && { borderWidth: 1.5, borderColor: t.fg },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
