import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/store/AppContext';

const SPLASH_CARD = require('@/assets/images/splash-cardboard-full.png');
const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';

const SHAKE_DURATION = 100;
const START_SCALE = 1.15; // Slight zoom so shake never reveals white edges
const END_SCALE = 1.02; // Pull back to show the whole sticker on the final frame
const FOCUS_Y = 0.35; // Center of the Porchivo sticker

export default function SplashScreen(): React.ReactElement {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { session, isOnboarded } = useApp();
  const [hasSeenSlides, setHasSeenSlides] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HAS_SEEN_SLIDES_KEY).then((value) => {
      setHasSeenSlides(value === 'true');
    });
  }, []);

  const settleOpacity = useSharedValue<number>(0);
  const imageScale = useSharedValue<number>(START_SCALE);
  const translateX = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(0);
  const shakeRotate = useSharedValue<number>(0);
  const whiteFade = useSharedValue<number>(0);

  const navigateNext = () => {
    if (session) {
      if (isOnboarded) {
        router.replace('/(tabs)/(home)' as any);
      } else {
        router.replace('/onboarding-setup' as any);
      }
      return;
    }

    if (hasSeenSlides) {
      router.replace('/tracking-onboarding' as any);
    } else {
      router.replace('/onboarding' as any);
    }
  };

  useEffect(() => {
    // 0.0s: image fades in, already zoomed slightly so edges have bleed
    settleOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });

    // 0.0s → 1.7s: subtle shaky handheld movement
    const shakeStep = (offset: number) =>
      withSequence(
        withTiming(offset, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(-offset, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) })
      );

    translateX.value = withRepeat(
      withSequence(shakeStep(2.5), withTiming(0, { duration: SHAKE_DURATION })),
      10,
      true
    );
    translateY.value = withRepeat(
      withSequence(shakeStep(1.5), withTiming(0, { duration: SHAKE_DURATION })),
      10,
      true
    );
    shakeRotate.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(-0.35, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: SHAKE_DURATION })
      ),
      10,
      true
    );

    // 1.7s → 2.0s: settle back so the entire sticker is fully visible
    imageScale.value = withDelay(
      1700,
      withTiming(END_SCALE, { duration: 300, easing: Easing.out(Easing.cubic) })
    );

    // 2.0s: white fade overlay covers the fully-framed sticker, then navigate
    whiteFade.value = withDelay(
      2000,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(navigateNext)();
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, hasSeenSlides, session, isOnboarded]);

  const imageContainerStyle = useAnimatedStyle(() => {
    // Keep the sticker centered throughout the zoom and shake
    const scaledWidth = width * imageScale.value;
    const scaledHeight = height * imageScale.value;
    const centerX = (width - scaledWidth) / 2;
    const centerY = (height - scaledHeight) / 2;
    const focusOffsetY = (height * FOCUS_Y) - (scaledHeight * FOCUS_Y);

    return {
      transform: [
        { translateX: translateX.value + centerX },
        { translateY: translateY.value + centerY + focusOffsetY },
        { scale: imageScale.value },
        { rotate: `${shakeRotate.value}deg` },
      ],
      opacity: settleOpacity.value,
    };
  });

  const whiteOverlayStyle = useAnimatedStyle(() => ({
    opacity: whiteFade.value,
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={[StyleSheet.absoluteFill, imageContainerStyle]}>
        <Image
          source={SPLASH_CARD}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.whiteOverlay, whiteOverlayStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  whiteOverlay: {
    backgroundColor: '#FFFFFF',
  },
});
