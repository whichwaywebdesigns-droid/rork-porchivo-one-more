import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  Easing,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Drag-to-dismiss tunables ────────────────────────────────────────────────
const DISMISS_THRESHOLD = 120;   // |dragY| past which release dismisses
const DISMISS_DISTANCE = 500;    // how far the card flies off-screen
const DISMISS_DURATION = 240;    // ms for the fly-away animation
const SPRING_BACK = { damping: 18, stiffness: 200, mass: 0.85 };

export interface CarouselSlide {
  id: string;
  /** Hero icon/illustration node shown in the upper area of the card */
  visual: React.ReactNode;
  /** Large headline text */
  title: string;
  /** Supporting body text */
  subtitle: string;
  /** Accent color for this slide's glow / icon background */
  accent: string;
  /** Soft background tint for the card */
  accentSoft: string;
}

interface PerspectiveCarouselProps {
  slides: CarouselSlide[];
  /** Called when the active slide changes (0-indexed). */
  onSlideChange?: (index: number) => void;
  /** Called when a card is dragged away. Receives the slide id and remaining count. */
  onDismiss?: (slideId: string, remainingCount: number) => void;
  /** Card width as fraction of screen. Default 0.82. */
  cardWidthRatio?: number;
  /** Gap between cards in px. Default 16. */
  gap?: number;
  style?: ViewStyle;
}

/**
 * A horizontal carousel where cards tilt in 3D perspective as they
 * scroll past center — inspired by the cinematic slider transitions on
 * Neu Web Studio and wearebrand.io.
 *
 * Each card rotates on rotateY (yaw) and scales slightly based on its
 * distance from center. The center card is fully upright and at full
 * scale; off-center cards rotate away and shrink, creating a coverflow-
 * like 3D depth effect. A parallax glow follows the scroll position.
 *
 * Cards can be dragged vertically to dismiss them — swipe up or down
 * past a threshold and the card flies away with a spring exit.
 */
export default function PerspectiveCarousel({
  slides,
  onSlideChange,
  onDismiss,
  cardWidthRatio = 0.82,
  gap = 16,
  style,
}: PerspectiveCarouselProps) {
  const Colors = useColors();
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const cardWidth = SCREEN_W * cardWidthRatio;
  const spacerWidth = (SCREEN_W - cardWidth) / 2;
  const step = cardWidth + gap;

  const lastReportedIndex = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const visibleSlides = slides.filter((s) => !dismissedIds.includes(s.id));

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      scrollX.value = x;

      const idx = Math.round(x / step);
      if (idx !== lastReportedIndex.current && idx >= 0 && idx < visibleSlides.length) {
        lastReportedIndex.current = idx;
        setActiveIndex(idx);
        if (onSlideChange) onSlideChange(idx);
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [scrollX, step, visibleSlides.length, onSlideChange],
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * step, animated: true });
    },
    [step],
  );

  // ── Dismissal handling ──────────────────────────────────────────────────

  const handleDismiss = useCallback(
    (slideId: string) => {
      setDismissedIds((prev) =>
        prev.includes(slideId) ? prev : [...prev, slideId],
      );
      if (onDismiss) {
        const remaining = Math.max(0, slides.length - dismissedIds.length - 1);
        onDismiss(slideId, remaining);
      }
    },
    [onDismiss, slides.length, dismissedIds.length],
  );

  // After a card is removed, clamp the active index and re-scroll so the
  // next card slides smoothly into the vacated position.
  useEffect(() => {
    if (dismissedIds.length === 0 || visibleSlides.length === 0) return;

    const clamped = Math.min(activeIndex, visibleSlides.length - 1);
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      lastReportedIndex.current = clamped;
    }

    // Allow the reduced content to lay out before re-scrolling.
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: clamped * step, animated: true });
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedIds]);

  const handleReset = useCallback(() => {
    setDismissedIds([]);
    setActiveIndex(0);
    lastReportedIndex.current = 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
    }, 60);
  }, []);

  // ── Empty state ─────────────────────────────────────────────────────────

  if (visibleSlides.length === 0) {
    return (
      <View style={[styles.container, styles.emptyState, style]}>
        <Text style={[styles.emptyTitle, { color: Colors.slateLight }]}>
          All cards cleared
        </Text>
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetButton,
            { backgroundColor: Colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.resetText}>Restore cards</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
      >
        {visibleSlides.map((slide, index) => (
          <CarouselCard
            key={slide.id}
            slide={slide}
            index={index}
            scrollX={scrollX}
            step={step}
            cardWidth={cardWidth}
            spacerWidth={spacerWidth}
            isFirst={index === 0}
            isLast={index === visibleSlides.length - 1}
            isActive={index === activeIndex}
            onDismiss={handleDismiss}
          />
        ))}
      </ScrollView>

      {/* Dot indicators + restore link */}
      <View style={styles.dotsRow}>
        {visibleSlides.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => scrollToSlide(i)}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex ? Colors.primary : Colors.border,
                width: i === activeIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {dismissedIds.length > 0 && (
        <Pressable
          onPress={handleReset}
          hitSlop={12}
          style={({ pressed }) => [
            styles.restoreLink,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.restoreText, { color: Colors.slateLight }]}>
            Restore {dismissedIds.length} dismissed{' '}
            {dismissedIds.length === 1 ? 'card' : 'cards'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Individual carousel card with 3D perspective + drag-to-dismiss ──────────

interface CarouselCardProps {
  slide: CarouselSlide;
  index: number;
  scrollX: SharedValue<number>;
  step: number;
  cardWidth: number;
  spacerWidth: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  onDismiss: (slideId: string) => void;
}

function CarouselCard({
  slide,
  index,
  scrollX,
  step,
  cardWidth,
  spacerWidth,
  isFirst,
  isLast,
  isActive,
  onDismiss,
}: CarouselCardProps) {
  const Colors = useColors();

  // ── Drag-to-dismiss shared values ───────────────────────────────────────
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragOpacity = useSharedValue(1);
  const dragRotate = useSharedValue(0);
  const isDismissing = useSharedValue(0);

  const triggerDismiss = useCallback(() => {
    onDismiss(slide.id);
  }, [onDismiss, slide.id]);

  const pan = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-12, 12])
    .onUpdate((e) => {
      if (isDismissing.value === 1) return;
      dragY.value = e.translationY;
      const mag = Math.abs(e.translationY);
      dragScale.value = interpolate(
        mag,
        [0, 200],
        [1, 0.88],
        Extrapolation.CLAMP,
      );
      dragOpacity.value = interpolate(
        mag,
        [0, 200],
        [1, 0.35],
        Extrapolation.CLAMP,
      );
      dragRotate.value = interpolate(
        e.translationY,
        [-200, 0, 200],
        [-6, 0, 6],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      if (isDismissing.value === 1) return;

      if (Math.abs(e.translationY) > DISMISS_THRESHOLD) {
        // ── Dismiss: fly the card away ────────────────────────────────────
        isDismissing.value = 1;
        const dir = e.translationY > 0 ? 1 : -1;
        const config = { duration: DISMISS_DURATION, easing: Easing.out(Easing.cubic) };

        dragY.value = withTiming(dir * DISMISS_DISTANCE, config);
        dragScale.value = withTiming(0.72, { duration: DISMISS_DURATION });
        dragRotate.value = withTiming(dir * 14, { duration: DISMISS_DURATION });
        dragOpacity.value = withTiming(
          0,
          { duration: DISMISS_DURATION },
          (finished) => {
            if (finished) runOnJS(triggerDismiss)();
          },
        );
      } else {
        // ── Spring back to rest ───────────────────────────────────────────
        dragY.value = withSpring(0, SPRING_BACK);
        dragScale.value = withSpring(1, SPRING_BACK);
        dragOpacity.value = withSpring(1, SPRING_BACK);
        dragRotate.value = withSpring(0, SPRING_BACK);
      }
    });

  // ── Scroll-based 3D perspective (existing coverflow effect) ─────────────
  const animatedStyle = useAnimatedStyle(() => {
    const cardCenter = index * step;
    const distance = scrollX.value - cardCenter;
    const progress = distance / step;

    const rotateY = interpolate(
      progress,
      [-1.5, 0, 1.5],
      [35, 0, -35],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress,
      [-1, 0, 1],
      [0.82, 1, 0.82],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      progress,
      [-1, 0, 1],
      [-30, 0, 30],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      Math.abs(progress),
      [0, 1.2],
      [1, 0.4],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { scale },
        { translateX },
      ],
      opacity,
    };
  });

  // ── Parallax glow ───────────────────────────────────────────────────────
  const glowStyle = useAnimatedStyle(() => {
    const cardCenter = index * step;
    const distance = Math.abs(scrollX.value - cardCenter);
    const intensity = interpolate(
      distance,
      [0, step * 1.5],
      [0.25, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: intensity };
  });

  // ── Drag-to-dismiss style (applied to outer wrapper) ────────────────────
  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: dragScale.value },
      { rotateZ: `${dragRotate.value}deg` },
    ],
    opacity: dragOpacity.value,
  }));

  return (
    <View
      style={{
        width: isFirst || isLast ? cardWidth + spacerWidth : cardWidth,
        alignItems: isFirst ? 'flex-end' : isLast ? 'flex-start' : 'center',
      }}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ width: cardWidth }, dragStyle]}>
          <Animated.View style={[{ width: cardWidth }, animatedStyle]}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: Colors.surface,
                  borderColor: Colors.border,
                  shadowColor: Colors.cardShadow,
                },
              ]}
            >
              {/* Parallax glow overlay */}
              <Animated.View
                style={[StyleSheet.absoluteFillObject, styles.glow, glowStyle]}
                pointerEvents="none"
              >
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: slide.accent,
                      borderRadius: 24,
                    },
                  ]}
                />
              </Animated.View>

              {/* Visual / icon area */}
              <View
                style={[styles.visualArea, { backgroundColor: slide.accentSoft }]}
              >
                {slide.visual}
              </View>

              {/* Text content */}
              <View style={styles.textContent}>
                <Text style={[styles.cardTitle, { color: Colors.slate }]}>
                  {slide.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: Colors.slateLight }]}>
                  {slide.subtitle}
                </Text>
              </View>

              {/* Drag-to-dismiss hint — only on the active card */}
              {isActive && (
                <View style={styles.dismissHint} pointerEvents="none">
                  <View
                    style={[
                      styles.dismissHintPill,
                      { backgroundColor: Colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dismissHintText,
                        { color: Colors.slateLight },
                      ]}
                    >
                      Swipe up or down to dismiss
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 8,
    minHeight: 420,
  },
  glow: {
    borderRadius: 24,
    zIndex: 0,
  },
  visualArea: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textContent: {
    padding: 20,
    flex: 1,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  // ── Drag-to-dismiss hint ──
  dismissHint: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dismissHintPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dismissHintText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  // ── Restore link ──
  restoreLink: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  resetText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
