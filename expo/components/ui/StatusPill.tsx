import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Bell, Check, Clock, Package, RotateCcw, Truck } from 'lucide-react-native';
import { palette, radius, space } from '@/constants/theme';
import { getStatusToken, StatusToken } from '@/lib/statusTokens';

interface StatusPillProps {
  status?: string | null;
  hasTracking?: boolean;
  token?: StatusToken;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

function IconFor({ icon, color, size }: { icon: StatusToken['icon']; color: string; size: number }) {
  switch (icon) {
    case 'check':
      return <Check size={size} color={color} strokeWidth={2.4} />;
    case 'bell':
      return <Bell size={size} color={color} strokeWidth={2.2} />;
    case 'rotate':
      return <RotateCcw size={size} color={color} strokeWidth={2.2} />;
    case 'box':
      return <Package size={size} color={color} strokeWidth={2.2} />;
    case 'clock':
      return <Clock size={size} color={color} strokeWidth={2.2} />;
    default:
      return <Truck size={size} color={color} strokeWidth={2.2} />;
  }
}

export default function StatusPill({
  status,
  hasTracking,
  token,
  showIcon = true,
  size = 'md',
  style,
}: StatusPillProps) {
  const t = token ?? getStatusToken(status, !!hasTracking);
  const pulse = useRef(new Animated.Value(0)).current;
  const isLive = !!t.live;

  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  const dotOpacity = isLive ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) : 1;
  const iconSize = size === 'sm' ? 11 : 13;
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      {isLive ? (
        <Animated.View style={[styles.liveDot, { backgroundColor: t.fg, opacity: dotOpacity }]} />
      ) : showIcon ? (
        <IconFor icon={t.icon} color={t.fg} size={iconSize} />
      ) : null}
      <Text style={[styles.label, { color: t.fg, fontSize }]} numberOfLines={1}>
        {t.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md - 2,
    paddingVertical: 5,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  label: {
    fontWeight: '600',
    color: palette.slate700,
  },
});
