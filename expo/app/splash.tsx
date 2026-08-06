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
  withDelay,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/store/AppContext';

const SPLASH_BOX = require('@/assets/images/splash-box.png');
const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';
const FLAP_COLOR = '#C4A265';

type FlapSide = 'left' | 'right';

interface CardboardFlapProps {
  side: FlapSide;
  progress: SharedValue<number>;
  containerWidth: number;
  containerHeight: number;
}

function CardboardFlap({
  side,
  progress,
  containerWidth,
  containerHeight,
}: CardboardFlapProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const target = side === 'left' ? -110 : 110;
    const rotateY = progress.value * target;
    return {
      transform: [{ perspective: 800 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const flapWidth = containerWidth * 0.5;
  const flapHeight = containerHeight * 0.45;

  return (
    <Animated.View
      style={[
        styles.flap,
        {
          width: flapWidth,
          height: flapHeight,
          left: side === 'left' ? 0 : containerWidth * 0.5,
          top: containerHeight * 0.05,
          transformOrigin: side === 'left' ? 'right center' : 'left center',
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

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

  const settleScale = useSharedValue<number>(0.95);
  const flapProgress = useSharedValue<number>(0);
  const zoomScale = useSharedValue<number>(1);
  const translateY = useSharedValue<number>(0);
  const opacity = useSharedValue<number>(1);

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
      router.replace('/welcome' as any);
    } else {
      router.replace('/onboarding' as any);
    }
  };

  useEffect(() => {
    // Phase 1: settle from 0.95 to 1.0 over 0.4s
    settleScale.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
      withDelay(1500, withTiming(1, { duration: 0 }))
    );

    // Phase 2: flaps hinge open from 1.9s to 2.5s
    flapProgress.value = withDelay(
      1900,
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
    );

    // Phase 3: camera zooms into the open box from 1.9s to 2.7s
    zoomScale.value = withDelay(
      1900,
      withTiming(3, { duration: 800, easing: Easing.inOut(Easing.cubic) })
    );
    translateY.value = withDelay(
      1900,
      withTiming(-height * 0.25, {
        duration: 800,
        easing: Easing.inOut(Easing.cubic),
      })
    );

    // Fade out during the final 0.4s of the zoom, then route to the next screen
    opacity.value = withDelay(
      2300,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(navigateNext)();
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, hasSeenSlides, session, isOnboarded]);

  const containerStyle = useAnimatedStyle(() => {
    const scale = settleScale.value * zoomScale.value;
    return {
      transform: [{ scale }, { translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.root} testID="splash-screen">
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
        <Image
          source={SPLASH_BOX}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
        />
        <CardboardFlap
          side="left"
          progress={flapProgress}
          containerWidth={width}
          containerHeight={height}
        />
        <CardboardFlap
          side="right"
          progress={flapProgress}
          containerWidth={width}
          containerHeight={height}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flap: {
    position: 'absolute',
    backgroundColor: FLAP_COLOR,
    backfaceVisibility: 'hidden',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
});
