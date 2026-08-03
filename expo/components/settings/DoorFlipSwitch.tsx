/**
 * DoorFlipSwitch — a premium animated vertical rocker light switch.
 *
 * Architecture:
 *  - Pressable outer shell (plate) with bevel shadows.
 *  - Inner Animated.View (rocker) that rotates on the X axis like a
 *    physical rocker switch flipping on a wall plate.
 *  - Two halves (ON top / OFF bottom) share the same rocker panel;
 *    colour transitions are driven by interpolating the rotation value
 *    so the colour fade is synchronised with the physical movement.
 *  - Spring physics for a snappy, realistic press feel.
 *  - Reduced-motion: skips animation, jumps directly to target values.
 */

import React, { useCallback, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  AccessibilityRole,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ThemeTokens } from '@/constants/theme';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DoorFlipSwitchProps {
  value: boolean;
  onPress: () => void;
  label: string;
  tokens: ThemeTokens;
  /** Optional small icon rendered above the label */
  icon?: React.ReactNode;
  testID?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Rocker tilt angles (degrees). Negative = ON (top pressed in).
const ROT_ON = -9;
const ROT_OFF = 9;

const PLATE_W = 68;
const PLATE_H = 118;
const ROCKER_W = 48;
const ROCKER_H = 88;

const SPRING = { mass: 0.35, damping: 16, stiffness: 360 } as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DoorFlipSwitch({
  value,
  onPress,
  label,
  tokens,
  icon,
  testID,
}: DoorFlipSwitchProps) {
  const reducedMotion = useReducedMotion();

  // Primary rocker rotation (X axis)
  const rotX = useSharedValue<number>(value ? ROT_ON : ROT_OFF);

  // Brief press-depth scale
  const pressScale = useSharedValue<number>(1);

  // Sync rocker rotation when value changes
  useEffect(() => {
    const target = value ? ROT_ON : ROT_OFF;
    if (reducedMotion) {
      rotX.value = target;
    } else {
      rotX.value = withSpring(target, SPRING);
    }
  }, [value, reducedMotion, rotX]);

  // Animated rocker container — rotates around horizontal centre axis
  const rockerStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 320 },
      { rotateX: `${rotX.value}deg` },
    ],
  }));

  // ON-half brightness overlay: fully visible when ON, fades when OFF
  const onOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotX.value, [ROT_ON, ROT_OFF], [1, 0]),
  }));

  // OFF-half brightness overlay: dims when ON, subtle brightening when OFF
  const offOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotX.value, [ROT_ON, ROT_OFF], [0, 0.55]),
  }));

  // ON label text: bright when active, faint when not
  const onLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotX.value, [ROT_ON, ROT_OFF], [1, 0.3]),
  }));

  // OFF label text: bright when active, faint when not
  const offLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rotX.value, [ROT_ON, ROT_OFF], [0.3, 1]),
  }));

  // Outer plate scale for press feedback
  const plateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (reducedMotion) return;
    cancelAnimation(pressScale);
    pressScale.value = withTiming(0.94, { duration: 70 });
  }, [reducedMotion, pressScale]);

  const handlePressOut = useCallback(() => {
    if (reducedMotion) return;
    pressScale.value = withSequence(
      withSpring(1.03, { mass: 0.3, damping: 12, stiffness: 400 }),
      withSpring(1.0, { mass: 0.3, damping: 18, stiffness: 360 }),
    );
  }, [reducedMotion, pressScale]);

  return (
    <View style={styles.wrapper}>
      {/* Icon slot */}
      {icon != null && <View style={styles.iconSlot}>{icon}</View>}

      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={'switch' as AccessibilityRole}
        accessibilityLabel={`${label} theme`}
        accessibilityState={{ checked: value }}
        testID={testID}
        hitSlop={8}
      >
        {/* Outer plate */}
        <Animated.View
          style={[
            styles.plate,
            {
              width: PLATE_W,
              height: PLATE_H,
              backgroundColor: tokens.switchPlate,
              borderColor: tokens.switchPlateBorder,
              shadowColor: tokens.shadow,
            },
            plateStyle,
          ]}
        >
          {/* Inner bevel highlight (top-left edge) */}
          <View
            style={[
              styles.bevelHighlight,
              { borderColor: 'rgba(255,255,255,0.35)' },
            ]}
            pointerEvents="none"
          />

          {/* Rocker — the flipping panel */}
          <Animated.View
            style={[
              styles.rocker,
              {
                width: ROCKER_W,
                height: ROCKER_H,
                backgroundColor: tokens.switchRocker,
                borderColor: tokens.switchPlateBorder,
              },
              rockerStyle,
            ]}
          >
            {/* ── TOP HALF — ON ── */}
            <View style={styles.rockerHalf}>
              {/* Accent overlay fades in when ON */}
              <Animated.View
                style={[
                  styles.halfOverlay,
                  { backgroundColor: tokens.switchRockerOn },
                  onOverlayStyle,
                ]}
                pointerEvents="none"
              />
              <Animated.Text
                style={[
                  styles.rockerLabel,
                  { color: tokens.switchLabel },
                  onLabelStyle,
                ]}
              >
                ON
              </Animated.Text>
            </View>

            {/* Centre pivot divider */}
            <View
              style={[
                styles.divider,
                { backgroundColor: tokens.switchPlateBorder },
              ]}
            />

            {/* ── BOTTOM HALF — OFF ── */}
            <View style={styles.rockerHalf}>
              {/* Brightness overlay fades in when OFF */}
              <Animated.View
                style={[
                  styles.halfOverlay,
                  { backgroundColor: 'rgba(255,255,255,0.12)' },
                  offOverlayStyle,
                ]}
                pointerEvents="none"
              />
              <Animated.Text
                style={[
                  styles.rockerLabel,
                  { color: tokens.switchLabel },
                  offLabelStyle,
                ]}
              >
                OFF
              </Animated.Text>
            </View>

            {/* Top bevel (gives recessed appearance to pressed half) */}
            <View style={styles.rockerTopBevel} pointerEvents="none" />
            {/* Bottom bevel */}
            <View style={styles.rockerBottomBevel} pointerEvents="none" />
          </Animated.View>
        </Animated.View>
      </Pressable>

      {/* Label below plate */}
      <Text
        style={[
          styles.switchLabel,
          {
            color: value ? tokens.accent : tokens.textMuted,
            fontWeight: value ? ('700' as const) : ('500' as const),
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  iconSlot: {
    marginBottom: 2,
  },
  plate: {
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Outer drop shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'visible',
  },
  bevelHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9,
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.40)',
    borderLeftColor: 'rgba(255,255,255,0.25)',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  rocker: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    // Inner shadow to simulate bevel depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  rockerHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halfOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  divider: {
    height: 1.5,
    marginHorizontal: 0,
  },
  rockerLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
  },
  // Subtle bevel reflections on rocker edges
  rockerTopBevel: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  rockerBottomBevel: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  switchLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
