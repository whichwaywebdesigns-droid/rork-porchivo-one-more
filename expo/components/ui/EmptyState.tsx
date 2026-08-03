import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette, radius, space, type as typeScale } from '@/constants/theme';
import Button from './Button';

type Tone = 'sky' | 'ember' | 'sage' | 'gold';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  tone?: Tone;
  style?: ViewStyle;
  testID?: string;
}

const TONES: Record<Tone, string> = {
  sky: palette.accentGlow,
  ember: palette.warmOrangeGlow,
  sage: palette.successGlow,
  gold: palette.goldGlow,
};

export default function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
  tone = 'sky',
  style,
  testID,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <View style={[styles.tile, { backgroundColor: TONES[tone] }]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onCta ? (
        <View style={{ marginTop: space.lg }}>
          <Button label={ctaLabel} onPress={onCta} variant="primary" size="md" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
  },
  tile: {
    width: 96,
    height: 96,
    borderRadius: radius.xl + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: {
    ...typeScale.headline,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typeScale.caption,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 19,
  },
});
