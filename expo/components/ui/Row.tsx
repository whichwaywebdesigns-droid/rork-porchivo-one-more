import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { palette, radius, space } from '@/constants/theme';

interface RowProps {
  icon?: React.ReactNode;
  iconTone?: 'sky' | 'ember' | 'sage' | 'gold' | 'rose' | 'slate';
  label: string;
  description?: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const TONE_BG: Record<NonNullable<RowProps['iconTone']>, string> = {
  sky: palette.sky,
  ember: palette.emberSoft,
  sage: palette.sageSoft,
  gold: palette.goldSoft,
  rose: palette.roseSoft,
  slate: palette.slate100,
};

export default function Row({
  icon,
  iconTone = 'sky',
  label,
  description,
  value,
  trailing,
  onPress,
  destructive,
  showChevron,
  style,
  testID,
}: RowProps) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.row, style]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: TONE_BG[iconTone] }]}>{icon}</View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.label, destructive && { color: palette.rose }]} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {trailing}
      {showChevron && onPress ? <ChevronRight size={18} color={palette.slate300} /> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.ink,
  },
  description: {
    fontSize: 13,
    color: palette.slate500,
    marginTop: 2,
  },
  value: {
    fontSize: 13,
    color: palette.slate500,
    fontWeight: '500',
  },
});
