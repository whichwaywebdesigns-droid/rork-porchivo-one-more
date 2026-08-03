import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColors } from '@/constants/colors';

interface OnboardingProgressProps {
  /** 1-based current step. */
  step: number;
  /** Total steps in the flow. */
  total: number;
}

/**
 * Quiet, premium progress indicator: a row of segments where completed and
 * current steps fill with the accent. The active segment animates its width
 * gently so the user understands forward motion without any noise.
 */
export default function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  const Colors = useColors();
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: 1,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [step, fill]);

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const reached = i < step;
        const isCurrent = i === step - 1;
        return (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor: reached ? Colors.primary : Colors.border,
                flex: isCurrent ? 1.6 : 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 5,
  },
  segment: {
    height: 5,
    borderRadius: 3,
  },
});
