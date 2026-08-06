import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnalytics } from '@/store/AnalyticsContext';

const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';

const SLIDES = [
  { image: require('@/assets/images/onboarding-2.png') },
  { image: require('@/assets/images/onboarding-3.png') },
  { image: require('@/assets/images/onboarding-4.png') },
];

const COLORS = {
  background: '#FFFFFF',
  primary: '#1B3A6B',
  accent: '#E8611A',
  textMuted: '#6B7F99',
  dotInactive: '#D8E4F0',
};

export default function OnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { track } = useAnalytics();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const progress = useSharedValue<number>(0);
  const pulse = useSharedValue<number>(0);
  const hasInteracted = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(currentIndex);
  const isAnimatingRef = useRef<boolean>(isAnimating);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  const finish = useCallback(async () => {
    hasInteracted.current = true;
    cancelAnimation(pulse);
    pulse.value = 0;
    track('onboarding_completed', { slides_shown: SLIDES.length });
    await AsyncStorage.setItem(HAS_SEEN_SLIDES_KEY, 'true');
    router.replace('/tracking-onboarding' as any);
  }, [router, track]);

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const goNext = useCallback(() => {
    if (isAnimatingRef.current || currentIndexRef.current >= SLIDES.length - 1) {
      return;
    }
    hasInteracted.current = true;
    cancelAnimation(pulse);
    pulse.value = 0;
    setIsAnimating(true);
    const next = currentIndexRef.current + 1;
    setNextIndex(next);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: 450, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setCurrentIndex)(next);
          runOnJS(setNextIndex)(null);
          runOnJS(setIsAnimating)(false);
          runOnJS(track)('onboarding_carousel_slide', {
            slide_index: next,
            total_slides: SLIDES.length,
          });
          progress.value = 0;
        }
      }
    );
  }, [progress, track]);

  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  const goPrevious = useCallback(() => {
    if (isAnimatingRef.current || currentIndexRef.current <= 0) {
      return;
    }
    hasInteracted.current = true;
    cancelAnimation(pulse);
    pulse.value = 0;
    setIsAnimating(true);
    const previous = currentIndexRef.current - 1;
    setNextIndex(previous);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: 450, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setCurrentIndex)(previous);
          runOnJS(setNextIndex)(null);
          runOnJS(setIsAnimating)(false);
          runOnJS(track)('onboarding_carousel_slide', {
            slide_index: previous,
            total_slides: SLIDES.length,
          });
          progress.value = 0;
        }
      }
    );
  }, [progress, track]);

  const goPreviousRef = useRef(goPrevious);
  useEffect(() => {
    goPreviousRef.current = goPrevious;
  }, [goPrevious]);

  useEffect(() => {
    track('onboarding_started', { slide_index: 0 });
    pulse.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
      ),
    );
  }, [track, pulse]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((event) => {
          if (isAnimatingRef.current) return;
          if (event.translationX < -50) {
            if (currentIndexRef.current < SLIDES.length - 1) {
              runOnJS(goNextRef.current)();
            } else {
              runOnJS(finishRef.current)();
            }
          } else if (event.translationX > 50 && currentIndexRef.current > 0) {
            runOnJS(goPreviousRef.current)();
          }
        }),
    []
  );

  const outgoingStyle = useAnimatedStyle(() => {
    const rotateY = -progress.value * 90;
    const scale = 1 - progress.value * 0.05;
    const opacity = 1 - progress.value;
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
    };
  });

  const incomingStyle = useAnimatedStyle(() => {
    const delayed = Math.max(0, (progress.value - 0.333) / 0.667);
    const rotateY = 90 - delayed * 90;
    const scale = 0.95 + delayed * 0.05;
    const opacity = delayed;
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const shadowOpacity = p < 0.5 ? p * 0.6 : (1 - p) * 0.6;
    return {
      shadowOpacity,
    };
  });

  const swipeHintStyle = useAnimatedStyle(() => {
    const p = pulse.value;
    const opacity = 0.25 + p * 0.45;
    const translateX = -p * 10;
    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const isFirstSlide = currentIndex === 0;

  return (
    <SafeAreaView style={styles.root} testID="onboarding-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {!isLastSlide && (
          <TouchableOpacity
            onPress={finishRef.current}
            style={[styles.skipButton, { top: 16 + insets.top }]}
            activeOpacity={0.7}
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        <GestureDetector gesture={swipeGesture}>
          <View style={[styles.stage, { width, height: height - 180 }]}>
            <Animated.View
              style={[
                styles.card,
                { width, height: height - 180 },
                outgoingStyle,
                shadowStyle,
              ]}
              pointerEvents={nextIndex !== null ? 'none' : 'auto'}
            >
              <Image
                source={SLIDES[currentIndex].image}
                style={styles.image}
                resizeMode="contain"
                accessible={false}
              />
            </Animated.View>

            {nextIndex !== null && (
              <Animated.View
                style={[
                  styles.card,
                  { width, height: height - 180 },
                  incomingStyle,
                  shadowStyle,
                ]}
              >
                <Image
                  source={SLIDES[nextIndex].image}
                  style={styles.image}
                  resizeMode="contain"
                  accessible={false}
                />
              </Animated.View>
            )}
          </View>
        </GestureDetector>

        {/* Slide arrows */}
        {!isFirstSlide && (
          <TouchableOpacity
            onPress={goPreviousRef.current}
            style={[styles.arrow, styles.arrowLeft]}
            activeOpacity={0.7}
            accessibilityLabel="Previous slide"
          >
            <View style={styles.arrowCircle}>
              <ChevronLeft size={24} color={COLORS.primary} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
        {!isLastSlide && (
          <TouchableOpacity
            onPress={goNextRef.current}
            style={[styles.arrow, styles.arrowRight]}
            activeOpacity={0.7}
            accessibilityLabel="Next slide"
          >
            <View style={styles.arrowCircle}>
              <ChevronRight size={24} color={COLORS.primary} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}

        {!isLastSlide && (
          <Animated.View
            style={[styles.swipeHint, swipeHintStyle]}
            pointerEvents="none"
          >
            <ChevronLeft size={28} color={COLORS.primary} strokeWidth={2.5} />
            <Text style={styles.swipeHintText}>Swipe</Text>
          </Animated.View>
        )}

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {isLastSlide ? (
            <TouchableOpacity
              onPress={finishRef.current}
              style={styles.getStartedButton}
              activeOpacity={0.85}
              accessibilityLabel="Get started"
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={goNextRef.current}
              style={styles.nextButton}
              activeOpacity={0.85}
              accessibilityLabel="Next slide"
            >
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  stage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    position: 'absolute',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    zIndex: 10,
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.dotInactive,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  getStartedButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  swipeHint: {
    position: 'absolute',
    right: 28,
    bottom: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  swipeHintText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
