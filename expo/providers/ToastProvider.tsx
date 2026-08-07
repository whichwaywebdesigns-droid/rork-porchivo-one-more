/**
 * ToastProvider — global, lightweight, auto-dismissing snackbar for Porchivo.
 *
 * Usage:
 *   import { useToast } from '@/hooks/useToast';
 *   const toast = useToast();
 *   toast.success('Package added');
 *   toast.error('Something went wrong');
 *   toast.show({ message: 'Saved', variant: 'info', actionLabel: 'Undo', onAction: () => {} });
 *
 * The banner animates in from the top, auto-dismisses after a duration, can be
 * swiped up to dismiss, and pairs with haptic feedback on success/error.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PackageCheck, PackageX, MailWarning, PackageOpen } from 'lucide-react-native';
import createContextHook from '@nkzw/create-context-hook';

import { useColors } from '@/constants/colors';
import { radius, space, type, elevation } from '@/constants/theme';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 3200. Pass 0 to disable auto-dismiss. */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState extends Required<Omit<ToastOptions, 'actionLabel' | 'onAction'>> {
  id: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContextValue {
  show: (opts: ToastOptions) => void;
  success: (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) => void;
  error: (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) => void;
  info: (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) => void;
  warning: (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) => void;
  hide: () => void;
}

const DEFAULT_DURATION = 3200;

export const [_ToastContextInner, useToastContext] =
  createContextHook((): ToastContextValue & { _toast: ToastState | null; _setToast: (t: ToastState | null) => void } => {
    const [toast, setToast] = useState<ToastState | null>(null);
    const counter = useRef<number>(0);

    const show = useCallback((opts: ToastOptions): void => {
      const variant: ToastVariant = opts.variant ?? 'info';
      counter.current += 1;
      setToast({
        id: counter.current,
        message: opts.message,
        variant,
        duration: opts.duration ?? DEFAULT_DURATION,
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
      });

      if (Platform.OS !== 'web') {
        const feedback =
          variant === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : variant === 'error'
              ? Haptics.NotificationFeedbackType.Error
              : variant === 'warning'
                ? Haptics.NotificationFeedbackType.Warning
                : null;
        if (feedback) {
          Haptics.notificationAsync(feedback).catch(() => {});
        }
      }

      AccessibilityInfo.announceForAccessibility?.(opts.message);
    }, []);

    const hide = useCallback((): void => setToast(null), []);

    const success = useCallback(
      (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) =>
        show({ ...opts, message, variant: 'success' }),
      [show],
    );
    const error = useCallback(
      (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) =>
        show({ ...opts, message, variant: 'error' }),
      [show],
    );
    const info = useCallback(
      (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) =>
        show({ ...opts, message, variant: 'info' }),
      [show],
    );
    const warning = useCallback(
      (message: string, opts?: Omit<ToastOptions, 'message' | 'variant'>) =>
        show({ ...opts, message, variant: 'warning' }),
      [show],
    );

    return { show, success, error, info, warning, hide, _toast: toast, _setToast: setToast };
  });

// ── Visual layer ──────────────────────────────────────────────────────────────

function ToastViewport() {
  const { _toast: toast, hide } = useToastContext();
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((): void => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(null);
        hide();
      }
    });
  }, [translateY, opacity, hide]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) {
          dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    }),
  ).current;

  // Animate in when a new toast arrives, and schedule auto-dismiss.
  React.useEffect(() => {
    if (!toast) return;
    setRendered(toast);
    translateY.setValue(-140);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    if (timerRef.current) clearTimeout(timerRef.current);
    if (toast.duration > 0) {
      timerRef.current = setTimeout(() => dismiss(), toast.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!rendered) return null;

  const accent =
    rendered.variant === 'success'
      ? Colors.success
      : rendered.variant === 'error'
        ? Colors.danger
        : rendered.variant === 'warning'
          ? Colors.palette.warmOrange
          : Colors.primary;

  const Icon =
    rendered.variant === 'success'
      ? PackageCheck
      : rendered.variant === 'error'
        ? PackageX
        : rendered.variant === 'warning'
          ? MailWarning
          : PackageOpen;

  return (
    <View style={[styles.viewport, { top: insets.top + space.sm, pointerEvents: 'box-none' as const }]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          elevation.raised,
          {
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={[styles.iconWrap, { backgroundColor: accent + '1A' }]}>
          <Icon size={20} color={accent} strokeWidth={2.4} />
        </View>
        <Text style={[styles.message, { color: Colors.slate }]} numberOfLines={3}>
          {rendered.message}
        </Text>
        {rendered.actionLabel ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              rendered.onAction?.();
              dismiss();
            }}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionLabel, { color: accent }]}>{rendered.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ── Public provider ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <_ToastContextInner>
      {children}
      <ToastViewport />
    </_ToastContextInner>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    maxWidth: 480,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
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
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...type.body,
    flex: 1,
    fontWeight: '600',
  },
  action: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  actionLabel: {
    ...type.caption,
    fontWeight: '800',
  },
});
