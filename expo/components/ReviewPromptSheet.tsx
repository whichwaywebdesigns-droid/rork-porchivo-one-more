/**
 * ReviewPromptSheet — custom pre-prompt bottom sheet shown before the native
 * review dialog. This filters for willing reviewers before calling the
 * quota-limited SKStoreReviewController / Play In-App Review API.
 *
 * Flow:
 *   "Love it"   → showNativeReviewDialog() (native 1–5 star dialog)
 *   "Remind me" → remindMeLater() (14-day cooldown)
 *   "No thanks" → dismissPrompt() (14-day cooldown)
 *
 * If the native API is unavailable, "Love it" falls back to opening the
 * store listing directly.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Star, X, Bell, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';
import { radius, space, type, elevation } from '@/constants/theme';
import {
  showNativeReviewDialog,
  remindMeLater,
  dismissPrompt,
  type ReviewTriggerReason,
} from '@/lib/storeReview';

interface ReviewPromptSheetProps {
  visible: boolean;
  reason: ReviewTriggerReason;
  onDismiss: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function ReviewPromptSheet({ visible, reason, onDismiss }: ReviewPromptSheetProps) {
  const Colors = useColors();
  const { tokens } = useTheme();
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const starScales = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // ── Animate in/out ─────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      // Slide up + fade in
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 50,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger star pop-in
      starScales.forEach((scale, i) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
          delay: 120 + i * 80,
        }).start();
      });

      // Light haptic when sheet appears
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      // Slide down + fade out
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleRate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDismiss();
    // Small delay so the sheet animation finishes before the native dialog appears
    setTimeout(() => {
      void showNativeReviewDialog();
    }, 350);
  }, [onDismiss]);

  const handleRemindLater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void remindMeLater();
    onDismiss();
  }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    void dismissPrompt();
    onDismiss();
  }, [onDismiss]);

  // ── Render ─────────────────────────────────────────────────────────────

  const reasonText =
    reason === 'active_use_milestone'
      ? "You've been using Porchivo for a week now!"
      : reason === 'manual'
        ? 'Rate Porchivo'
        : 'Enjoying Porchivo?';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideY }],
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
          },
        ]}
      >
        {/* Close button */}
        <Pressable
          style={[styles.closeBtn, { backgroundColor: tokens.surfaceAlt }]}
          onPress={handleDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <X size={16} color={tokens.textMuted} strokeWidth={2.4} />
        </Pressable>

        {/* Star row */}
        <View style={styles.starRow}>
          {starScales.map((scale, i) => (
            <Animated.View
              key={i}
              style={[
                styles.starWrap,
                {
                  transform: [{ scale }],
                  backgroundColor: i < 4 ? `${tokens.accent}18` : `${tokens.accent}0A`,
                },
              ]}
            >
              <Star
                size={22}
                color={i < 4 ? tokens.accent : tokens.textMuted}
                fill={i < 4 ? tokens.accent : 'transparent'}
                strokeWidth={2}
              />
            </Animated.View>
          ))}
        </View>

        {/* Title + subtitle */}
        <Text style={[styles.title, { color: tokens.text }]}>
          {reasonText}
        </Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
          Your rating helps neighbors discover Porchivo and keeps us building better porch protection.
        </Text>

        {/* Action buttons */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: tokens.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleRate}
          accessibilityRole="button"
          accessibilityLabel="Rate Porchivo now"
        >
          <Heart size={17} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Rate Porchivo</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: tokens.surfaceAlt,
                borderColor: tokens.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={handleRemindLater}
            accessibilityRole="button"
            accessibilityLabel="Remind me later"
          >
            <Bell size={15} color={tokens.textMuted} strokeWidth={2} style={{ marginRight: 6 }} />
            <Text style={[styles.secondaryBtnText, { color: tokens.textMuted }]}>
              Remind me later
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                opacity: pressed ? 0.5 : 1,
              },
            ]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="No thanks"
          >
            <Text style={[styles.secondaryBtnText, { color: tokens.textMuted }]}>
              No thanks
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.xl,
    ...elevation.raised,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: space.md,
    right: space.lg,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  starWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.title,
    fontSize: 20,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subtitle: {
    ...type.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: space.xl,
  },
  primaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md + 2,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  secondaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
