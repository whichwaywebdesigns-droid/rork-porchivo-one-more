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

export default function SplashScreen(): React.ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session, isOnboarded } = useApp();
  const [hasSeenSlides, setHasSeenSlides] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HAS_SEEN_SLIDES_KEY).then((value) => {
      setHasSeenSlides(value === 'true');
    });
  }, []);

  const settleOpacity = useSharedValue<number>(0);
  const shakeX = useSharedValue<number>(0);
  const shakeY = useSharedValue<number>(0);
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
    // 0.0s: full image fades in, kept in frame entirely
    settleOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });

    // 0.0s → 2.0s: subtle shaky handheld camera movement
    const shakeStep = (offset: number) =>
      withSequence(
        withTiming(offset, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(-offset, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) })
      );

    shakeX.value = withRepeat(
      withSequence(shakeStep(2.5), withTiming(0, { duration: SHAKE_DURATION })),
      10,
      true
    );
    shakeY.value = withRepeat(
      withSequence(shakeStep(1.5), withTiming(0, { duration: SHAKE_DURATION })),
      10,
      true
    );
    shakeRotate.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(-0.4, { duration: SHAKE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: SHAKE_DURATION })
      ),
      10,
      true
    );

    // 2.0s: white fade overlay begins, then navigate once fully covered
    whiteFade.value = withDelay(
      2000,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(navigateNext)();
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, hasSeenSlides, session, isOnboarded]);

  const imageContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
      { rotate: `${shakeRotate.value}deg` },
    ],
    opacity: settleOpacity.value,
  }));

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
          resizeMode="contain"
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
