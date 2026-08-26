import React, { useEffect, useRef, useState } from 'react';
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
import { useOrganization } from '@/store/OrganizationContext';

const SPLASH_CARD = require('@/assets/images/splash-cardboard-full.png');
const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';

const SHAKE_DURATION = 100;
const START_SCALE = 1.15; // Slight zoom so shake never reveals white edges
const END_SCALE = 1.02; // Pull back to show the whole sticker on the final frame
const FOCUS_Y = 0.35; // Center of the Porchivo sticker
const TRUCK_COLOR = '#8B5A2B'; // Generic delivery brown

export default function SplashScreen(): React.ReactElement {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { session, isOnboarded } = useApp();
  const { isOrgMember, isLoading: isOrgLoading } = useOrganization();
  const [hasSeenSlides, setHasSeenSlides] = useState<boolean | null>(null);

  // Refs so the Reanimated completion callback (captured at effect-run time)
  // and the failsafe timer read the latest values without restarting the
  // animation.
  const isOrgMemberRef = useRef<boolean>(isOrgMember);
  useEffect(() => {
    isOrgMemberRef.current = isOrgMember;
  }, [isOrgMember]);

  const sessionRef = useRef(session);
  const isOnboardedRef = useRef<boolean | null>(isOnboarded);
  const isOrgLoadingRef = useRef<boolean>(isOrgLoading);
  const hasSeenSlidesRef = useRef<boolean | null>(hasSeenSlides);
  useEffect(() => {
    sessionRef.current = session;
    isOnboardedRef.current = isOnboarded;
    isOrgLoadingRef.current = isOrgLoading;
    hasSeenSlidesRef.current = hasSeenSlides;
  }, [session, isOnboarded, isOrgLoading, hasSeenSlides]);

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
  const truckProgress = useSharedValue<number>(0);
  const truckBounce = useSharedValue<number>(0);

  const navigateNext = () => {
    const safeReplace = (path: string) => {
      try {
        router.replace(path as any);
      } catch {
        // Navigator not ready — root layout redirect will handle it.
      }
    };

    if (sessionRef.current) {
      if (isOnboardedRef.current) {
        // Tier-aware: community members go to Home, free-tier to Deliveries.
        const dest = isOrgMemberRef.current ? '/(tabs)/(home)' : '/(tabs)/packages';
        safeReplace(dest);
      } else {
        safeReplace('/onboarding-setup');
      }
      return;
    }

    if (hasSeenSlidesRef.current) {
      safeReplace('/tracking-onboarding');
    } else {
      safeReplace('/onboarding');
    }
  };

  // Deferred dispatch: if the intro animation finishes before profile/org
  // context resolves, hold the splash (the truck loader keeps animating) and
  // navigate as soon as the data lands — instead of guessing the destination
  // and flashing the wrong screen.
  const [navPending, setNavPending] = useState<boolean>(false);
  const navPendingRef = useRef<boolean>(false);
  const pendingSinceRef = useRef<number>(0);

  const tryNavigate = () => {
    if (
      sessionRef.current &&
      (isOnboardedRef.current === null || isOrgLoadingRef.current)
    ) {
      if (!navPendingRef.current) {
        navPendingRef.current = true;
        pendingSinceRef.current = Date.now();
        setNavPending(true);
      }
      return;
    }
    navigateNext();
  };

  // Dispatch as soon as profile/org resolve.
  useEffect(() => {
    if (!navPending) return;
    if (session && (isOnboarded === null || isOrgLoading)) return;
    navPendingRef.current = false;
    setNavPending(false);
    navigateNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navPending, session, isOnboarded, isOrgLoading]);

  // Failsafe: never hold the splash longer than 8s — fall back to a
  // best-guess destination so the app stays navigable on a dead network.
  useEffect(() => {
    if (!navPending) return;
    const timer = setTimeout(() => {
      navPendingRef.current = false;
      setNavPending(false);
      navigateNext();
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navPending]);

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

    // Truck loading progress: 0.3s → 2.0s
    truckProgress.value = withDelay(
      300,
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) })
    );
    truckBounce.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-2, { duration: 150, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 150, easing: Easing.inOut(Easing.sin) })
        ),
        12,
        true
      )
    );

    // 2.0s: white fade overlay covers the fully-framed sticker, then navigate
    whiteFade.value = withDelay(
      2000,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(tryNavigate)();
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, hasSeenSlides, session, isOnboarded]);

  const imageContainerStyle = useAnimatedStyle(() => {
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

  const trackWidth = width * 0.55;
  const truckSize = 20;

  const truckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: truckProgress.value * (trackWidth - truckSize) }, { translateY: truckBounce.value }],
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

      {/* Loading truck at bottom */}
      <View style={[styles.loader, { bottom: 48 }]} pointerEvents="none">
        <View style={[styles.track, { width: trackWidth }]}>
          <Animated.View style={[styles.truck, { width: truckSize, height: truckSize }, truckStyle]}>
            <View style={styles.truckBody} />
            <View style={styles.truckCab} />
            <View style={styles.wheelLeft} />
            <View style={styles.wheelRight} />
          </Animated.View>
        </View>
        <View style={styles.loadingTextRow}>
          <View style={styles.pulseDot} />
          <View style={styles.loadingText} />
        </View>
      </View>
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
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8DCC8',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  truck: {
    position: 'absolute',
    left: 0,
    top: -10,
  },
  truckBody: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 14,
    height: 10,
    backgroundColor: TRUCK_COLOR,
    borderRadius: 2,
  },
  truckCab: {
    position: 'absolute',
    left: 13,
    top: 8,
    width: 6,
    height: 6,
    backgroundColor: TRUCK_COLOR,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  wheelLeft: {
    position: 'absolute',
    left: 2,
    top: 13,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5C3A1E',
  },
  wheelRight: {
    position: 'absolute',
    left: 13,
    top: 13,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5C3A1E',
  },
  loadingTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TRUCK_COLOR,
  },
  loadingText: {
    width: 80,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8DCC8',
  },
});
