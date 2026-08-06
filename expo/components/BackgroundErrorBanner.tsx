/**
 * BackgroundErrorBanner — non-intrusive bottom banner that surfaces background
 * process failures (Ship24 polling, Supabase fetch errors, etc.) to the user.
 *
 * Slides in from the bottom with a subtle amber accent, auto-dismisses after
 * the TTL set in the context, and offers an optional Retry button.
 *
 * Mounted once in RootLayoutNav, above the Stack but below the toast viewport.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, X, RotateCw } from 'lucide-react-native';

import { useBackgroundError } from '@/store/BackgroundErrorContext';
import { useColors } from '@/constants/colors';
import { radius, space, type, elevation } from '@/constants/theme';

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 } as const;

export function BackgroundErrorBanner() {
  const { currentError, dismiss, resolveError } = useBackgroundError();
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const [visible, setVisible] = React.useState(false);

  // Animate in when a new error arrives, out when cleared.
  useEffect(() => {
    if (currentError) {
      setVisible(true);
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });

      // Subtle warning haptic — not as aggressive as an error toast.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else if (visible) {
      // Slide out then unmount.
      translateY.value = withTiming(120, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
      opacity.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentError?.timestamp, currentError?.source]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible || !currentError) return null;

  const accent = Colors.secondary; // warm orange — non-alarming but attention-getting
  const retry = currentError.onRetry;

  const handleRetry = () => {
    resolveError(currentError.source);
    currentError.onRetry?.();
  };

  const handleDismiss = () => {
    dismiss();
  };

  return (
    <View
      style={[
        styles.viewport,
        { bottom: insets.bottom + space.xs, pointerEvents: 'box-none' as const },
      ]}
    >
      <Animated.View
        style={[
          styles.banner,
          elevation.raised,
          {
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
          },
          animatedStyle,
        ]}
      >
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: accent + '1A' }]}>
          <AlertTriangle size={18} color={accent} strokeWidth={2.4} />
        </View>

        {/* Message */}
        <View style={styles.textWrap}>
          <Text style={[styles.message, { color: Colors.slate }]} numberOfLines={2}>
            {currentError.message}
          </Text>
          <Text style={[styles.subLabel, { color: Colors.slateLighter }]}>
            We&apos;ll keep trying in the background.
          </Text>
        </View>

        {/* Retry button */}
        {retry ? (
          <Pressable
            hitSlop={8}
            onPress={handleRetry}
            style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <RotateCw size={15} color={accent} strokeWidth={2.6} />
            <Text style={[styles.retryText, { color: accent }]}>Retry</Text>
          </Pressable>
        ) : null}

        {/* Dismiss X */}
        <Pressable
          hitSlop={10}
          onPress={handleDismiss}
          style={({ pressed }) => [styles.dismissBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <X size={16} color={Colors.slateLighter} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    zIndex: 9990, // Below toast (9999) but above most content
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: 480,
    paddingVertical: space.md,
    paddingLeft: space.lg + 4,
    paddingRight: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    flexDirection: 'column',
    gap: 1,
  },
  message: {
    ...type.body,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 19,
  },
  subLabel: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '400' as const,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  retryText: {
    ...type.caption,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  dismissBtn: {
    padding: space.xs,
    flexShrink: 0,
  },
});
