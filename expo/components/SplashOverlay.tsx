import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const FADE_DURATION = 450;
const SPLASH_BG_LIGHT = '#CACBCB';
const SPLASH_BG_DARK = '#102040';

interface SplashOverlayProps {
  visible: boolean;
}

/**
 * In-app splash overlay that mirrors the native launch screen. It is kept on
 * screen while the home dashboard's initial data loads and fades out with an
 * opacity animation once everything is ready.
 */
export function SplashOverlay({ visible }: SplashOverlayProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash as soon as the JS overlay is ready so the
    // transition from the system splash to the in-app splash is seamless.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? SPLASH_BG_DARK : SPLASH_BG_LIGHT,
          opacity,
        },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/images/splash-box.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  imageContainer: {
    width: 320,
    height: 693,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
