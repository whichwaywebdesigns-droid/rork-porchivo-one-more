import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, ViewStyle } from 'react-native';
import { useColors, AppColors } from '@/constants/colors';
import { radius, space } from '@/constants/theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional badge counts per option, rendered as a small dot/number. */
  counts?: Partial<Record<T, number>>;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A compact segmented control with a sliding active pill. Theme-aware and
 * accessible — each segment is a TouchableOpacity with an accessibility role.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  counts,
  style,
  testID,
}: SegmentedControlProps<T>) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const handleLayout = (width: number) => {
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  };

  const segmentWidth = containerWidth > 0 ? containerWidth / options.length : 0;
  const pillTranslate = segmentWidth * selectedIndex;

  const handleChange = (next: T) => {
    if (next === value) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    onChange(next);
  };

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      onLayout={(e) => handleLayout(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {/* Sliding active pill */}
      {containerWidth > 0 && (
        <View
          style={[
            styles.pill,
            {
              width: segmentWidth,
              transform: [{ translateX: pillTranslate }],
            },
          ]}
          pointerEvents="none"
        />
      )}

      {options.map((opt) => {
        const isActive = opt.value === value;
        const count = counts?.[opt.value];
        return (
          <TouchableOpacity
            key={opt.value}
            style={styles.segment}
            onPress={() => handleChange(opt.value)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={opt.label}
            testID={`${testID ?? 'segmented'}-${opt.value}`}
          >
            <View style={styles.segmentInner}>
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {typeof count === 'number' && count > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.elevated,
      borderRadius: radius.lg,
      padding: 4,
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pill: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      ...{
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 2,
      } as ViewStyle,
    },
    segment: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: space.sm,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    segmentInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slateLight,
      letterSpacing: 0.1,
    },
    labelActive: {
      color: colors.slate,
      fontWeight: '700' as const,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.border,
    },
    badgeActive: {
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: colors.slateLighter,
    },
    badgeTextActive: {
      color: colors.onPrimary,
    },
  });
}
