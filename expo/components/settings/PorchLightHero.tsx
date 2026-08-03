/**
 * PorchLightHero — decorative wall-sconce lantern header for the settings screen.
 *
 * Architecture:
 *  - Entire lantern built from layered Views, borders, and expo-linear-gradient.
 *  - No external image assets required.
 *  - glowOpacity + glowScale spring-animate when isDark changes.
 *  - A sinusoidal breathe loop animates the ambient glow while the lamp is on,
 *    creating a subtle "live flame" effect.
 *  - useReducedMotion skips all animation and jumps to final values.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeTokens } from '@/constants/theme';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PorchLightHeroProps {
  isDark: boolean;
  tokens: ThemeTokens;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const HERO_H = 216;

// ── Component ─────────────────────────────────────────────────────────────────

export function PorchLightHero({ isDark, tokens }: PorchLightHeroProps) {
  const reducedMotion = useReducedMotion();

  // Glow presence: 0 = fully off, 1 = fully lit
  const glowOpacity = useSharedValue<number>(isDark ? 0.2 : 1.0);
  const glowScale = useSharedValue<number>(isDark ? 0.78 : 1.0);

  // Breathing — subtle sinusoidal scale for the orb while the lamp is on
  const breathe = useSharedValue<number>(1.0);

  useEffect(() => {
    const opTarget = isDark ? 0.2 : 1.0;
    const scTarget = isDark ? 0.78 : 1.0;

    if (reducedMotion) {
      glowOpacity.value = opTarget;
      glowScale.value = scTarget;
    } else {
      glowOpacity.value = withSpring(opTarget, {
        mass: 0.9,
        damping: 22,
        stiffness: 140,
      });
      glowScale.value = withSpring(scTarget, {
        mass: 0.9,
        damping: 22,
        stiffness: 140,
      });
    }
  }, [isDark, reducedMotion, glowOpacity, glowScale]);

  // Breathing loop — only runs when light is on and motion is allowed
  useEffect(() => {
    if (reducedMotion) return;

    if (!isDark) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.14, {
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.88, {
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(1.0, { duration: 700 });
    }
  }, [isDark, reducedMotion, breathe]);

  // Glow orb — scale and opacity driven by both glow state + breathing
  const glowOrbStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value * breathe.value }],
  }));

  // Bulb — slightly pulses with breathe
  const bulbStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * glowOpacity.value,
    transform: [{ scale: 0.92 + 0.08 * breathe.value }],
  }));

  // Ambient floor spill fades with glow
  const spillStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.65,
  }));

  const metalColor = tokens.lampMetal;
  const wallBg = isDark ? '#081224' : '#D8DDE9';

  // Lamp colours extracted for use in gradient tuples (TS requires explicit tuple)
  const lampLt = tokens.lampLight;

  return (
    <View style={[styles.hero, { backgroundColor: wallBg }]}>
      {/* ── Backdrop ambient gradient (full area) ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.glowBackdrop, glowOrbStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[`${lampLt}00`, `${lampLt}28`, `${lampLt}4A`, `${lampLt}28`, `${lampLt}00`] as const}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* ── Radial orb centred behind lantern ── */}
      <Animated.View style={[styles.orbWrap, glowOrbStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${lampLt}88`, `${lampLt}44`, `${lampLt}18`, `${lampLt}00`] as const}
          style={styles.orbGradient}
        />
      </Animated.View>

      {/* ── Lantern assembly (flex column, centred) ── */}
      <View style={styles.lanternCol}>
        {/* Mounting bracket */}
        <View style={[styles.bracket, { backgroundColor: metalColor }]}>
          <View style={[styles.screw, styles.screwL, { backgroundColor: wallBg }]} />
          <View style={[styles.screw, styles.screwR, { backgroundColor: wallBg }]} />
        </View>

        {/* Suspension rod */}
        <View style={[styles.rod, { backgroundColor: metalColor }]} />

        {/* Lantern top cap */}
        <View style={[styles.topCap, { backgroundColor: metalColor }]}>
          <View
            style={[
              styles.topCapSheen,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.22)' },
            ]}
          />
        </View>

        {/* Glass body row */}
        <View style={[styles.glassRow, { borderColor: metalColor }]}>
          {/* Left strut */}
          <View style={[styles.vertStrut, { backgroundColor: metalColor }]} />

          {/* Glass interior */}
          <View style={styles.glassInterior}>
            {/* Warm glass tint */}
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: tokens.lampGlass }]}
            />

            {/* Horizontal glazing bars */}
            <View
              style={[styles.hBar, { backgroundColor: metalColor, top: '32%' }]}
            />
            <View
              style={[styles.hBar, { backgroundColor: metalColor, top: '66%' }]}
            />

            {/* Bulb + glow rings */}
            <Animated.View style={[styles.bulbWrap, bulbStyle]}>
              {/* Outer glow ring */}
              <View
                style={[
                  styles.glowRing,
                  { borderColor: `${lampLt}50` },
                ]}
              />
              {/* Bulb */}
              <View
                style={[
                  styles.bulb,
                  {
                    backgroundColor: lampLt,
                    shadowColor: lampLt,
                  },
                ]}
              >
                {/* Specular highlight */}
                <View style={styles.bulbFlare} />
              </View>
            </Animated.View>
          </View>

          {/* Right strut */}
          <View style={[styles.vertStrut, { backgroundColor: metalColor }]} />
        </View>

        {/* Bottom cap */}
        <View style={[styles.bottomCap, { backgroundColor: metalColor }]} />

        {/* Hanging finial */}
        <View style={[styles.finial, { backgroundColor: metalColor }]} />
      </View>

      {/* ── Ambient floor spill (light fanning down from lantern) ── */}
      <Animated.View style={[styles.spillWrap, spillStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${lampLt}2A`, `${lampLt}0A`, `${lampLt}00`] as const}
          style={{ flex: 1 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: {
    height: HERO_H,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowBackdrop: {
    // Covers full hero — animated opacity driven by glowOrbStyle
  },
  orbWrap: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: HERO_H / 2 - 80,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },

  // ── Lantern column ────────────────────────────────────────────────────────
  lanternCol: {
    alignItems: 'center',
  },
  bracket: {
    width: 54,
    height: 11,
    borderRadius: 4,
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  screw: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.55,
  },
  screwL: {},
  screwR: {},
  rod: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  topCap: {
    width: 68,
    height: 14,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    overflow: 'hidden' as const,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCapSheen: {
    width: '60%',
    height: 3,
    borderRadius: 2,
  },

  // ── Glass body ───────────────────────────────────────────────────────────
  glassRow: {
    width: 62,
    height: 60,
    flexDirection: 'row' as const,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    overflow: 'hidden' as const,
  },
  vertStrut: {
    width: 4,
    alignSelf: 'stretch' as const,
  },
  glassInterior: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  hBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },

  // ── Bulb ─────────────────────────────────────────────────────────────────
  bulbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  glowRing: {
    position: 'absolute' as const,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
  },
  bulb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 10,
  },
  bulbFlare: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.72)',
    position: 'absolute' as const,
    top: 4,
    left: 4,
  },

  // ── Bottom ────────────────────────────────────────────────────────────────
  bottomCap: {
    width: 68,
    height: 11,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  finial: {
    width: 9,
    height: 16,
    borderRadius: 5,
    marginTop: -1,
  },

  // ── Ambient spill ─────────────────────────────────────────────────────────
  spillWrap: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
});
