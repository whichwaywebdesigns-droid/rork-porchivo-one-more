import React, { useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Navigation,
  CheckCircle,
  Package,
  Clock,
  MapPin,
  Truck,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDrivers } from '@/store/DriversContext';
import { usePackages } from '@/store/PackagesContext';
import { TrackedPackage, PackageTrackingStatus } from '@/types';
import CarrierIcon from '@/components/CarrierIcon';
import { log } from "@/lib/logger";

const STATUS_COLORS: Record<PackageTrackingStatus, string> = {
  ordered: '#6B7280',
  shipped: '#2563EB',
  out_for_delivery: '#D97706',
  delivered: '#059669',
  picked_up: '#7C3AED',
  returned: '#DC2626',
};

const STATUS_LABELS: Record<PackageTrackingStatus, string> = {
  ordered: 'Ordered',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
  returned: 'Returned',
};

function formatETAWindow(pkg: TrackedPackage): string {
  if (pkg.expectedDeliveryWindowStart && pkg.expectedDeliveryWindowEnd) {
    const start = new Date(pkg.expectedDeliveryWindowStart);
    const end = new Date(pkg.expectedDeliveryWindowEnd);
    const fmt = (d: Date) =>
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const d = new Date(pkg.expectedDeliveryDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AssignmentCard({
  pkg,
  onNavigate,
  onMarkDelivered,
}: {
  pkg: TrackedPackage;
  onNavigate: () => void;
  onMarkDelivered: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const statusColor = STATUS_COLORS[pkg.currentStatus];
  const isDelivered = pkg.currentStatus === 'delivered' || pkg.currentStatus === 'picked_up' || pkg.currentStatus === 'returned';

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardInner}
      >
        <View style={styles.cardTop}>
          <CarrierIcon carrier={pkg.carrier} size={42} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{pkg.name}</Text>
            <View style={styles.cardAddressRow}>
              <MapPin size={13} color={Colors.slateLight} />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {pkg.addressNickname === 'Other' && pkg.customAddressLabel
                  ? pkg.customAddressLabel
                  : `${pkg.addressNickname} address`}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {STATUS_LABELS[pkg.currentStatus]}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Clock size={13} color={Colors.slate} />
            <Text style={styles.metaChipText}>{formatETAWindow(pkg)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Package size={13} color={Colors.slate} />
            <Text style={styles.metaChipText}>{pkg.trackingNumber}</Text>
          </View>
        </View>

        {pkg.notesForPartner ? (
          <View style={styles.notesRow}>
            <Text style={styles.notesLabel}>Note:</Text>
            <Text style={styles.notesValue} numberOfLines={2}>{pkg.notesForPartner}</Text>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={onNavigate}
            testID={`navigate-${pkg.id}`}
          >
            <Navigation size={18} color={Colors.white} />
            <Text style={styles.navigateBtnText}>Navigate</Text>
          </TouchableOpacity>

          {!isDelivered ? (
            <TouchableOpacity
              style={styles.deliveredBtn}
              onPress={onMarkDelivered}
              testID={`mark-delivered-${pkg.id}`}
            >
              <CheckCircle size={18} color="#059669" />
              <Text style={styles.deliveredBtnText}>Mark Delivered</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBadge}>
              <CheckCircle size={16} color="#059669" />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MyAssignmentsScreen() {
  const { drivers, assignments, getPackagesForDriver } = useDrivers();
  const { packages, updatePackageStatus } = usePackages();

  const currentDriverId = useMemo(() => {
    if (drivers.length === 0) return null;
    const available = drivers.find((d) => d.status === 'available');
    return available?.id ?? drivers[0]?.id ?? null;
  }, [drivers]);

  const assignedPackageIds = useMemo(() => {
    if (!currentDriverId) return [];
    return getPackagesForDriver(currentDriverId);
  }, [currentDriverId, getPackagesForDriver]);

  const assignedPackages = useMemo(() => {
    return assignedPackageIds
      .map((id) => packages.find((p) => p.id === id))
      .filter((p): p is TrackedPackage => p !== undefined)
      .sort((a, b) => {
        const statusPriority: Record<PackageTrackingStatus, number> = {
          out_for_delivery: 0,
          shipped: 1,
          ordered: 2,
          delivered: 3,
          picked_up: 4,
          returned: 5,
        };
        return (statusPriority[a.currentStatus] ?? 99) - (statusPriority[b.currentStatus] ?? 99);
      });
  }, [assignedPackageIds, packages]);

  const pendingCount = useMemo(
    () => assignedPackages.filter((p) => p.currentStatus !== 'delivered' && p.currentStatus !== 'picked_up' && p.currentStatus !== 'returned').length,
    [assignedPackages]
  );

  const handleNavigate = useCallback((pkg: TrackedPackage) => {
    const address = pkg.addressNickname === 'Other' && pkg.customAddressLabel
      ? pkg.customAddressLabel
      : `${pkg.addressNickname} address`;

    const encoded = encodeURIComponent(address);

    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://app?daddr=${encoded}`).catch(() => {
        Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}`);
      });
    } else if (Platform.OS === 'android') {
      Linking.openURL(`google.navigation:q=${encoded}`).catch(() => {
        Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}`);
      });
    } else {
      Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}`).catch(() => {});
    }
  }, []);

  const handleMarkDelivered = useCallback((pkg: TrackedPackage) => {
    Alert.alert(
      'Confirm Delivery',
      `Mark "${pkg.name}" as delivered?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Delivered',
          onPress: () => {
            log('[MyAssignments] Marking package as delivered:', pkg.id);
            updatePackageStatus(pkg.id, 'delivered');
            Alert.alert('Delivered!', `"${pkg.name}" has been marked as delivered. The homeowner has been notified.`);
          },
        },
      ],
    );
  }, [updatePackageStatus]);

  const renderItem = useCallback(({ item }: { item: TrackedPackage }) => (
    <AssignmentCard
      pkg={item}
      onNavigate={() => handleNavigate(item)}
      onMarkDelivered={() => handleMarkDelivered(item)}
    />
  ), [handleNavigate, handleMarkDelivered]);

  const currentDriver = useMemo(() => {
    if (!currentDriverId) return null;
    return drivers.find((d) => d.id === currentDriverId) ?? null;
  }, [currentDriverId, drivers]);

  if (!currentDriver) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'My Assignments' }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Assignments' }} />

      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <Truck size={20} color={Colors.primary} />
          <Text style={styles.headerDriverName}>{currentDriver.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{pendingCount}</Text>
          <Text style={styles.headerCountLabel}>remaining</Text>
        </View>
      </View>

      <FlatList
        data={assignedPackages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Package size={56} color={Colors.slateLighter} />
            <Text style={styles.emptyTitle}>No Assignments Yet</Text>
            <Text style={styles.emptySubtitle}>
              Packages assigned to you will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.skyBlue,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDriverName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  headerCount: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  headerCountLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
    opacity: 0.7,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInner: {
    padding: 18,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  cardAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardAddress: {
    fontSize: 13,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.slate,
  },
  notesRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.slateLight,
  },
  notesValue: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  navigateBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  deliveredBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  deliveredBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#059669',
  },
  completedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  completedText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
