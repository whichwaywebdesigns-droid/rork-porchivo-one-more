import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Path, Polygon } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { getSafetyBand, SAFETY_GAUGE } from '@/lib/safetyScore';

/**
 * Animated needle gauge for safety scores (higher = safer).
 *
 * - 240° arc sweeping from lower-left (0) to lower-right (100)
 * - Zone colors run red → orange → green left to right, so a safe score
 *   always lands the needle in the green zone on the right
 * - Soft glow is faked with layered strokes (no SVG filters)
 * - Sweeps for 1.4s with an eased count-up on screen focus; honours
 *   Reduce Motion by jumping straight to the final position
 */

const START_ANGLE = 150;
const SWEEP_ANGLE = 240;
const TRACK_WIDTH = 14;
const ANIMATION_MS = 1400;

interface PolarPoint {
  x: number;
  y: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): PolarPoint {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface GaugeZone {
  color: string;
  start: number;
  end: number;
}

// Reversed zones: risk-free green sits on the right where high scores land.
const ZONES: GaugeZone[] = [
  { color: SAFETY_GAUGE.red, start: 150, end: 230 },
  { color: SAFETY_GAUGE.orange, start: 230, end: 310 },
  { color: SAFETY_GAUGE.green, start: 310, end: 390 },
];

const GLOW_LAYERS = [
  { extraWidth: 8, opacity: 0.15 },
  { extraWidth: 16, opacity: 0.06 },
] as const;

interface NeedleGaugeProps {
  /** Safety score, 0–100. Higher = safer. */
  score: number;
  /** Risk band label rendered in the glowing badge, e.g. "Low Risk". */
  riskLabel: string;
  /** Outer box size in px. */
  size?: number;
}

export default function NeedleGauge({
  score,
  riskLabel,
  size = 280,
}: NeedleGaugeProps): React.ReactElement {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const band = getSafetyBand(clampedScore);
  const reduceMotion = useReducedMotion();

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;

  // Needle overlay is drawn pointing straight up; RN rotation is clockwise,
  // so pointing at screen angle θ requires rotating by θ − 270°.
  const targetRotation = START_ANGLE + (clampedScore / 100) * SWEEP_ANGLE - 270;

  const rotation = useSharedValue<number>(0);
  const badgeGlow = useSharedValue<number>(0.25);

  const countAnim = useRef(new RNAnimated.Value(0)).current;
  const listenerId = useRef<string | null>(null);
  const [displayScore, setDisplayScore] = useState<number>(0);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const badgeGlowStyle = useAnimatedStyle(() => ({
    opacity: badgeGlow.value,
  }));

  const startAnimation = useCallback(() => {
    countAnim.stopAnimation();
    if (listenerId.current !== null) {
      countAnim.removeListener(listenerId.current);
      listenerId.current = null;
    }

    if (reduceMotion) {
      rotation.value = targetRotation;
      setDisplayScore(clampedScore);
      return;
    }

    rotation.value = 0;
    rotation.value = withTiming(targetRotation, {
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });

    countAnim.setValue(0);
    listenerId.current = countAnim.addListener(({ value }: { value: number }) => {
      setDisplayScore(Math.round(value * clampedScore));
    });
    RNAnimated.timing(countAnim, {
      toValue: 1,
      duration: ANIMATION_MS,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false,
    }).start(({ finished }: { finished: boolean }) => {
      if (finished) setDisplayScore(clampedScore);
    });
  }, [clampedScore, countAnim, reduceMotion, rotation, targetRotation]);

  useFocusEffect(
    useCallback(() => {
      startAnimation();
      return () => {
        countAnim.stopAnimation();
      };
    }, [startAnimation, countAnim]),
  );

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(badgeGlow);
      badgeGlow.value = 0.25;
      return;
    }
    badgeGlow.value = withRepeat(
      withTiming(0.5, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(badgeGlow);
    };
  }, [badgeGlow, reduceMotion]);

  const ticks = Array.from({ length: 11 }, (_: unknown, i: number) => {
    const angle = START_ANGLE + (i * SWEEP_ANGLE) / 10;
    const major = i % 5 === 0;
    const inner = polar(cx, cy, radius + (major ? 9 : 11), angle);
    const outer = polar(cx, cy, radius + (major ? 21 : 17), angle);
    return { key: `tick-${i}`, major, ...inner, x2: outer.x, y2: outer.y };
  });

  const needleLength = radius - 18;
  const needlePoints = `${cx},${cy - needleLength} ${cx - 3},${cy + 6} ${cx},${cy + 12} ${cx + 3},${cy + 6}`;
  const needleGlow = { x1: cx, y1: cy + 4, x2: cx, y2: cy - needleLength + 4 };

  return (
    <View
      style={[styles.wrap, { width: size, height: size + 8 }]}
      accessibilityRole="image"
      accessibilityLabel={`Safety score ${clampedScore} out of 100, ${riskLabel}`}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Path
            d={arcPath(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP_ANGLE)}
            stroke={SAFETY_GAUGE.track}
            strokeOpacity={0.4}
            strokeWidth={TRACK_WIDTH}
            strokeLinecap="round"
            fill="none"
          />
          {GLOW_LAYERS.map((glow, gi) =>
            ZONES.map((zone, zi) => (
              <Path
                key={`glow-${gi}-${zi}`}
                d={arcPath(cx, cy, radius, zone.start, zone.end)}
                stroke={zone.color}
                strokeOpacity={glow.opacity}
                strokeWidth={TRACK_WIDTH + glow.extraWidth}
                strokeLinecap="butt"
                fill="none"
              />
            )),
          )}
          {ZONES.map((zone, zi) => (
            <Path
              key={`zone-${zi}`}
              d={arcPath(cx, cy, radius, zone.start, zone.end)}
              stroke={zone.color}
              strokeWidth={TRACK_WIDTH}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
          {ticks.map((tick) => (
            <Line
              key={tick.key}
              x1={tick.x}
              y1={tick.y}
              x2={tick.x2}
              y2={tick.y2}
              stroke={SAFETY_GAUGE.track}
              strokeOpacity={tick.major ? 0.5 : 0.28}
              strokeWidth={tick.major ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          ))}
        </Svg>

        <Animated.View style={[StyleSheet.absoluteFill, needleStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Line {...needleGlow} stroke="#FFFFFF" strokeOpacity={0.15} strokeWidth={9} strokeLinecap="round" />
            <Line {...needleGlow} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={17} strokeLinecap="round" />
            <Polygon points={needlePoints} fill="#FFFFFF" stroke={SAFETY_GAUGE.track} strokeWidth={1.2} />
          </Svg>
        </Animated.View>

        <View style={[styles.hubRing, { left: cx - 14, top: cy - 14 }]} pointerEvents="none" />
        <View style={[styles.hub, { left: cx - 10, top: cy - 10 }]} pointerEvents="none" />

        <View style={[styles.scoreWrap, { top: cy + 24 }]} pointerEvents="none">
          <Text
            style={[
              styles.scoreText,
              { color: band.color, textShadowColor: band.color },
            ]}
          >
            {displayScore}
          </Text>
          <Text style={styles.scoreOutOf}>out of 100</Text>
        </View>
      </View>

      <View style={[styles.badgeWrap, { marginTop: -22 }]}>
        <Animated.View
          style={[styles.badgeGlow, { backgroundColor: band.color }, badgeGlowStyle]}
          pointerEvents="none"
        />
        <View style={[styles.badge, { backgroundColor: band.bg, borderColor: band.color }]}>
          <Text style={[styles.badgeText, { color: band.color }]}>{riskLabel.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  hubRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SAFETY_GAUGE.orange,
    backgroundColor: 'transparent',
  },
  hub: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SAFETY_GAUGE.track,
  },
  scoreWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 42,
    fontWeight: '900' as const,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textShadowRadius: 8,
    textShadowOpacity: 0.35,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreOutOf: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748B',
    marginTop: -2,
  },
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },
});
