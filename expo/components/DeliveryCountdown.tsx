import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Timer, AlertTriangle } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { tabularNums } from '@/constants/theme';
import { PackageTrackingStatus } from '@/types';

const DELIVERED_STATUSES: PackageTrackingStatus[] = ['delivered', 'picked_up', 'returned'];

interface CountdownState {
  text: string;
  tone: 'neutral' | 'amber' | 'danger';
  pulse: boolean;
  overdue: boolean;
}

/**
 * Compute the live countdown text, colour tone, and pulse flag
 * for a given target timestamp relative to "now".
 */
function computeCountdown(targetMs: number, nowMs: number): CountdownState {
  const diff = targetMs - nowMs;
  if (diff <= 0) {
    return { text: 'Overdue', tone: 'danger', pulse: true, overdue: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return { text: `${days}d ${hours}h`, tone: 'neutral', pulse: false, overdue: false };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m`, tone: 'amber', pulse: false, overdue: false };
  }
  if (minutes > 0) {
    return { text: `${minutes}m ${seconds}s`, tone: 'danger', pulse: true, overdue: false };
  }
  return { text: `${seconds}s`, tone: 'danger', pulse: true, overdue: false };
}

/** End-of-day (23:59:59.999) for the given ISO date string. */
function getEndOfDayMs(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Live-ticking countdown pill shown on active package cards.
 * Renders nothing once the package is delivered/picked up/returned.
 *
 * Colour shifts from blue (>24h) → amber (<24h) → red (<1h or overdue).
 * Pulses (scale) when the delivery is under 1 hour away or overdue.
 */
export function DeliveryCountdown({
  expectedDeliveryDate,
  currentStatus,
  deliveredTimestamp,
}: {
  expectedDeliveryDate: string;
  currentStatus: PackageTrackingStatus;
  deliveredTimestamp?: string | null;
}) {
  const colors = useColors();
  const [now, setNow] = useState<number>(Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const isDelivered = DELIVERED_STATUSES.includes(currentStatus) || !!deliveredTimestamp;
  const targetMs = useMemo(() => getEndOfDayMs(expectedDeliveryDate), [expectedDeliveryDate]);

  const state = useMemo(() => computeCountdown(targetMs, now), [targetMs, now]);

  // Tick every second while the package is still active.
  useEffect(() => {
    if (isDelivered) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isDelivered]);

  // Start / stop the pulse animation when urgency changes.
  useEffect(() => {
    pulseAnimRef.current?.stop();
    pulseAnimRef.current = null;

    if (state.pulse) {
      pulseAnim.setValue(1);
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      );
      anim.start();
      pulseAnimRef.current = anim;
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      pulseAnimRef.current?.stop();
    };
  }, [state.pulse, pulseAnim]);

  if (isDelivered) return null;

  const toneColor =
    state.tone === 'danger' ? colors.danger :
    state.tone === 'amber' ? colors.secondary :
    colors.primary;

  const bgColor =
    state.tone === 'danger' ? colors.dangerLight :
    state.tone === 'amber' ? colors.secondaryLight :
    colors.primaryLight;

  return (
    <Animated.View
      style={[
        styles.pill,
        { backgroundColor: bgColor },
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {state.overdue ? (
        <AlertTriangle size={11} color={toneColor} strokeWidth={2.4} />
      ) : (
        <Timer size={11} color={toneColor} strokeWidth={2.4} />
      )}
      <Text style={[styles.text, { color: toneColor }, tabularNums]} numberOfLines={1}>
        {state.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
