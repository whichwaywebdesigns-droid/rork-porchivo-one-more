import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/store/AppContext';
import { useOrganization } from '@/store/OrganizationContext';

// Cinematic splash video, cross-platform encoded as an animated WebP (a real
// <Video> player would need a dev client — Expo Go only ships expo-image).
// The animation is ~3.8s; navigation fires just before it completes.
const SPLASH_ANIM = require('@/assets/images/splash-anim.webp');
// Static last frame, painted underneath so there is never a blank flash
// while the animation decodes.
const SPLASH_POSTER = require('@/assets/images/splash-video-poster.jpg');
// Brand launch chime that accompanies the video (muxed into the MP4 on the
// native apps; played separately here).
const SPLASH_CHIME = require('@/assets/audio/splash-chime.mp3');

const HAS_SEEN_SLIDES_KEY = 'porchivo_pre_auth_slides_seen';

const SPLASH_DURATION_MS = 3600;
const SPLASH_BG = '#CBCBCA'; // Matches the video's edge color for seamless cover

export default function SplashScreen(): React.ReactElement {
  const router = useRouter();
  const { session, isOnboarded } = useApp();
  const { isOrgMember, isLoading: isOrgLoading } = useOrganization();
  const [hasSeenSlides, setHasSeenSlides] = useState<boolean | null>(null);

  // Refs so the navigation callback and failsafe timer read the latest
  // values without restarting the splash timeline.
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

  // Deferred dispatch: if the splash finishes before profile/org context
  // resolves, hold the splash (the animation keeps looping) and navigate as
  // soon as the data lands — instead of guessing the destination and
  // flashing the wrong screen.
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

  // Splash timeline: run once on mount, navigate as the video winds down.
  useEffect(() => {
    const timer = setTimeout(() => {
      tryNavigate();
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Launch chime. Browsers block audio autoplay until the user interacts
  // with the page, so skip it on web entirely (native only).
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let player: AudioPlayer | null = null;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: false });
        player = createAudioPlayer(SPLASH_CHIME);
        player.volume = 1.0;
        // play() may return a rejected promise (e.g. autoplay policy) — swallow it
        void Promise.resolve(player?.play()).catch(() => {});
      } catch {
        // Audio is a delightful extra — never block the splash if it fails
      }
    })();

    return () => {
      try {
        player?.remove();
      } catch {
        // ignore teardown errors
      }
    };
  }, []);

  return (
    <View style={styles.root} testID="splash-screen">
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      {/* Poster first so a slow decode never flashes blank */}
      <Image
        source={SPLASH_POSTER}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
        accessible={false}
      />
      <Image
        source={SPLASH_ANIM}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
});
