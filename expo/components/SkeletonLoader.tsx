import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors, AppColors } from '@/constants/colors';

function SkeletonPulse({ style }: { style?: object }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.bone,
        { opacity, backgroundColor: colors.border },
        style,
      ]}
    />
  );
}

export function ShipmentCardSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors]);

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.cardHeader}>
        <View style={styles.row}>
          <SkeletonPulse style={styles.iconCircle} />
          <View style={styles.textGroup}>
            <SkeletonPulse style={styles.titleBar} />
            <SkeletonPulse style={styles.subtitleBar} />
          </View>
        </View>
        <SkeletonPulse style={styles.badge} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <SkeletonPulse style={styles.pill} />
        <SkeletonPulse style={styles.trackingBar} />
      </View>
      <View style={[styles.row, { marginTop: 10 }]}>
        <SkeletonPulse style={styles.smallCircle} />
        <SkeletonPulse style={styles.nameBar} />
      </View>
    </View>
  );
}

export function PackageCardSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors]);

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.row}>
        <SkeletonPulse style={styles.iconSquare} />
        <View style={styles.textGroup}>
          <SkeletonPulse style={styles.titleBar} />
          <SkeletonPulse style={[styles.subtitleBar, { width: 140 }]} />
        </View>
        <SkeletonPulse style={styles.pill} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <View style={styles.textGroup}>
          <SkeletonPulse style={[styles.subtitleBar, { width: 60 }]} />
          <SkeletonPulse style={[styles.titleBar, { width: 80 }]} />
        </View>
        <SkeletonPulse style={[styles.pill, { width: 60 }]} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3, type = 'shipment' }: { count?: number; type?: 'shipment' | 'package' }) {
  const Card = type === 'package' ? PackageCardSkeleton : ShipmentCardSkeleton;
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    borderRadius: 6,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textGroup: {
    flex: 1,
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconSquare: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  smallCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  titleBar: {
    height: 14,
    width: 120,
    borderRadius: 4,
  },
  subtitleBar: {
    height: 10,
    width: 100,
    borderRadius: 4,
  },
  nameBar: {
    height: 12,
    width: 100,
    borderRadius: 4,
  },
  trackingBar: {
    height: 10,
    width: 70,
    borderRadius: 4,
  },
  badge: {
    height: 24,
    width: 64,
    borderRadius: 8,
  },
  pill: {
    height: 24,
    width: 80,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  listWrap: {
    paddingTop: 12,
  },
});
