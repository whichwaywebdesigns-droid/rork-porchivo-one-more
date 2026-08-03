import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { palette, space, type as typeScale } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export default function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.titles}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={10}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginTop: space.xxl,
    marginBottom: space.md,
  },
  titles: {
    flex: 1,
  },
  eyebrow: {
    ...typeScale.overline,
    color: palette.slate500,
    marginBottom: 4,
  },
  title: {
    ...typeScale.title,
    color: palette.ink,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy,
  },
});
