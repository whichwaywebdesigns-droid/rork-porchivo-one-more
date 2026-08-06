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
  withDelay,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/store/AppContext';

// New cardboard hero shot: full image shown first, then camera zooms into box
const SPLASH_CARD = require('@/assets/images/splash-cardboard-full.png');
const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';
const FLAP_COLOR = '#C4A265';
const BOX_FOCAL_Y = 0.35; // Focal point of the open box on the full image (relative)

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

  // Phase 1: full image settles in at scale 1.0 (no initial scale-down)
  const settleOpacity = useSharedValue<number>(0);
  const imageScale = useSharedValue<number>(1);
  const translateX = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(0);
  const flapProgress = useSharedValue<number>(0);
  const overlayOpacity = useSharedValue<number>(1);

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
    // 0.0s → 0.4s: full image fades in and rests, completely visible
    settleOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });

    // 1.0s → 2.2s: camera zooms into the center of the open box.
    // The image scales up while translating so the box focal point stays centered.
    const ZOOM = 3.2;
    const targetX = (width / 2) - (width * ZOOM * 0.5); // keep horizontal center
    const targetY = (height * BOX_FOCAL_Y) - (height * ZOOM * BOX_FOCAL_Y);

    imageScale.value = withDelay(
      1000,
      withTiming(ZOOM, { duration: 1200, easing: Easing.inOut(Easing.cubic) })
    );
    translateX.value = withDelay(
      1000,
      withTiming(targetX, { duration: 1200, easing: Easing.inOut(Easing.cubic) })
    );
    translateY.value = withDelay(
      1000,
      withTiming(targetY, { duration: 1200, easing: Easing.inOut(Easing.cubic) })
    );

    // Flaps hinge open as the camera moves in, 1.2s → 2.0s
    flapProgress.value = withDelay(
      1200,
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
    );

    // Fade out the splash during the final part of the zoom, then route
    overlayOpacity.value = withDelay(
      2000,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(navigateNext)();
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, width, hasSeenSlides, session, isOnboarded]);

  const imageContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: imageScale.value },
    ],
    opacity: settleOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, imageContainerStyle]}>
          <Image
            source={SPLASH_CARD}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
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
