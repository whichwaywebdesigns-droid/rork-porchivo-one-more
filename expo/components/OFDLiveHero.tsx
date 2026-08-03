import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Truck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radius, space, tabularNums, type as typeScale } from '@/constants/theme';
import { Shipment } from '@/types';
import CarrierIcon from './CarrierIcon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface OFDLiveHeroProps {
  shipments: Shipment[];
  onPress: (shipmentId: string) => void;
}

function getOFDShipment(shipments: Shipment[]): Shipment | null {
  const ofd = shipments.find(
    (s) =>
      s.deliveryStatus === 'out_for_delivery' &&
      s.status !== 'completed' &&
      s.status !== 'cancelled',
  );
  return ofd ?? null;
}

export default React.memo(function OFDLiveHero({ shipments, onPress }: OFDLiveHeroProps) {
  const shipment = useMemo(() => getOFDShipment(shipments), [shipments]);

  const pulse = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shipment) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shipment, pulse]);

  if (!shipment) return null;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const handleIn = () =>
    Animated.spring(press, { toValue: 0.982, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const handleOut = () =>
    Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const tail = shipment.trackingNumber ? `#${shipment.trackingNumber.slice(-8)}` : '';
  const eta = 'Today';

  return (
    <AnimatedPressable
      onPress={() => onPress(shipment.id)}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[styles.wrap, { transform: [{ scale: press }] }]}
      testID="ofd-live-hero"
      accessibilityRole="button"
      accessibilityLabel={`${shipment.carrier} package out for delivery, tap for live tracking`}
    >
        {/* Electric accent gradient */}
        <LinearGradient
          colors={[palette.accentGlowStrong, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' as const }]}
        />

        <View style={styles.live}>
          <View style={styles.dotWrap}>
            <Animated.View
              style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          </View>
          <Text style={styles.liveLabel}>LIVE · OUT FOR DELIVERY</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <CarrierIcon carrier={shipment.carrier} size={38} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {shipment.carrier} is on the way
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              <Text style={styles.subStrong}>Arriving {eta}</Text>
              {tail ? (
                <Text style={[styles.tail, tabularNums]}>  ·  {tail}</Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.cta}>
            <Truck size={14} color={palette.onAccent} strokeWidth={2.4} />
            <ChevronRight size={16} color={palette.onAccent} strokeWidth={2.5} />
          </View>
        </View>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    marginBottom: space.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.borderGlow,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.md,
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute' as const,
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  liveLabel: {
    ...typeScale.micro,
    color: palette.accent,
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
  },
  subStrong: {
    color: palette.textSecondary,
    fontWeight: '600' as const,
  },
  tail: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: palette.accent,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
