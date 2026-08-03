import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { palette, radius, space, tabularNums } from '@/constants/theme';
import { Shipment } from '@/types';
import StatusBadge from './StatusBadge';
import CarrierIcon from './CarrierIcon';
import StatusPill from './ui/StatusPill';

interface ShipmentCardProps {
  shipment: Shipment;
  onPress: () => void;
  onAccept?: () => void;
  showDistance?: boolean;
  variant?: 'homeowner' | 'partner';
}

export default React.memo(function ShipmentCard({
  shipment,
  onPress,
  onAccept,
  showDistance,
  variant = 'homeowner',
}: ShipmentCardProps) {
  const scale = useSharedValue(1);
  const acceptScale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.972, { damping: 22, stiffness: 340 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [scale]);

  const handleAcceptPressIn = useCallback(() => {
    acceptScale.value = withSpring(0.94, { damping: 22, stiffness: 340 });
  }, [acceptScale]);

  const handleAcceptPressOut = useCallback(() => {
    acceptScale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [acceptScale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const acceptStyle = useAnimatedStyle(() => ({
    transform: [{ scale: acceptScale.value }],
  }));

  const distances = ['0.2 mi', '0.5 mi', '0.8 mi', '1.1 mi', '1.5 mi'];
  const idHash = shipment.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const mockDistance = distances[idHash % distances.length] ?? '0.5 mi';

  return (
    <Animated.View style={[{ marginHorizontal: space.lg, marginBottom: space.md }, cardStyle]}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID={`shipment-card-${shipment.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${shipment.carrier} shipment, status ${shipment.status}`}
      >
        {/* Subtle top accent line */}
        <View style={styles.accentLine} />

        <View style={styles.cardHeader}>
          <View style={styles.carrierRow}>
            <View style={styles.carrierIconWrap}>
              <CarrierIcon carrier={shipment.carrier} size={34} />
            </View>
            <View style={styles.carrierInfo}>
              <Text style={styles.carrierName}>{shipment.carrier}</Text>
              <Text style={styles.packages}>{shipment.packagesExpected}</Text>
            </View>
          </View>
          <StatusBadge status={shipment.status} />
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <StatusPill status={shipment.deliveryStatus} hasTracking={!!shipment.trackingNumber} />
          {shipment.trackingNumber && (
            <Text style={[styles.trackingLabel, tabularNums]} numberOfLines={1}>
              #{shipment.trackingNumber.slice(-8)}
            </Text>
          )}
        </View>

        {variant === 'partner' && showDistance && (
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <MapPin size={13} color={palette.warmOrange} />
              <Text style={[styles.detailText, { color: palette.warmOrange }]}>
                {mockDistance} away
              </Text>
            </View>
          </View>
        )}

        {variant === 'partner' && (
          <View style={styles.partnerInfo}>
            <View style={styles.homeownerBubble}>
              <Text style={styles.homeownerInitial}>{shipment.homeownerName?.[0] ?? '?'}</Text>
            </View>
            <Text style={styles.homeownerName}>{shipment.homeownerName}</Text>
          </View>
        )}

        {variant === 'homeowner' && shipment.partnerName && (
          <View style={styles.partnerInfo}>
            <View style={[styles.homeownerBubble, { backgroundColor: palette.warmOrangeGlow }]}>
              <Text style={[styles.homeownerInitial, { color: palette.warmOrange }]}>
                {shipment.partnerName?.[0] ?? '?'}
              </Text>
            </View>
            <Text style={styles.homeownerName}>Partner: {shipment.partnerName}</Text>
          </View>
        )}

        {shipment.notes ? (
          <Text style={styles.notes} numberOfLines={2}>{shipment.notes}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          {onAccept && shipment.status === 'open' ? (
            <Animated.View style={[styles.acceptButtonWrap, acceptStyle]}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                onPressIn={handleAcceptPressIn}
                onPressOut={handleAcceptPressOut}
                activeOpacity={1}
                testID={`accept-btn-${shipment.id}`}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={styles.viewDetails}>
              <Text style={styles.viewDetailsText}>View details</Text>
              <ChevronRight size={15} color={palette.accent} strokeWidth={2.5} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: palette.borderDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: palette.borderGlow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  carrierIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierInfo: {
    flex: 1,
  },
  carrierName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    letterSpacing: -0.1,
  },
  packages: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: palette.borderDark,
    marginVertical: 11,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  trackingLabel: {
    fontSize: 11,
    color: palette.textMuted,
    marginLeft: space.sm,
    fontWeight: '600' as const,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  homeownerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeownerInitial: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.accent,
  },
  homeownerName: {
    fontSize: 12,
    color: palette.textSecondary,
    fontWeight: '500' as const,
  },
  notes: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 8,
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
  },
  acceptButtonWrap: {
    flex: 1,
  },
  acceptButton: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  acceptButtonText: {
    color: palette.onAccent,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    color: palette.accent,
    fontWeight: '600' as const,
  },
});
