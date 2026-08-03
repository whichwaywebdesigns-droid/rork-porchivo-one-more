import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '@/store/ThemeContext';

interface Star {
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

interface StarfieldBackgroundProps {
  /** Vertical coverage of the starfield as a fraction of screen height. Default 0.46. */
  coverage?: number;
  /** Number of stars. Default 22. */
  count?: number;
}

/**
 * Night-sky gradient with a field of twinkling stars. Echoes the Porchivo login
 * concept's aperture-from-darkness aesthetic. Rendered behind auth content.
 */
export default function StarfieldBackground({
  coverage = 0.46,
  count = 22,
}: StarfieldBackgroundProps) {
  const { isDark } = useTheme();

  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: count }, () => ({
        top: Math.random() * coverage * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.6 + 0.6,
        delay: Math.random() * 4000,
        duration: 3000 + Math.random() * 4000,
      })),
    [coverage, count]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={
          isDark
            ? ['#05070c', '#0B1526', '#102040', '#0c1a33']
            : ['#0B1526', '#102040', '#1c3358', '#14264a']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      {stars.map((s, i) => (
        <Twinkle key={i} star={s} />
      ))}
    </View>
  );
}

function Twinkle({ star }: { star: Star }) {
  const opacity = useSharedValue(0.15);

  React.useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: star.duration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: star.duration / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [opacity, star.delay, star.duration]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${star.top}%`,
          left: `${star.left}%`,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: '#C9D6E8',
        },
        style,
      ]}
    />
  );
}
