import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Search,
  Car,
  Truck as TruckIcon,
  Bike,
  X,
  Phone,
  Mail,
  Star,
  Package,
  ChevronRight,
  Zap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDrivers } from '@/store/DriversContext';
import { usePackages } from '@/store/PackagesContext';
import { Driver, DriverStatus, VehicleType } from '@/types';
import { log } from "@/lib/logger";

const STATUS_CONFIG: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#059669', bg: '#ECFDF5' },
  busy: { label: 'Busy', color: '#D97706', bg: '#FFFBEB' },
  offline: { label: 'Offline', color: '#6B7280', bg: '#F3F4F6' },
};

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = {
  car: Car,
  van: TruckIcon,
  truck: TruckIcon,
  bike: Bike,
  scooter: Bike,
};

const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
  bike: 'Bike',
  scooter: 'Scooter',
};

function DriverAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = ['#1D4F91', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bg = colors[colorIndex];

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function DriverCard({
  driver,
  onPress,
}: {
  driver: Driver;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = STATUS_CONFIG[driver.status];
  const VehicleIcon = VEHICLE_ICONS[driver.vehicleType];

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.driverCard}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID={`driver-card-${driver.id}`}
      >
        <DriverAvatar name={driver.name} size={50} />
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>{driver.name}</Text>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
          </View>
          <View style={styles.cardMeta}>
            <View style={styles.cardMetaItem}>
              <VehicleIcon size={13} color={Colors.slateLight} />
              <Text style={styles.cardMetaText}>{VEHICLE_LABELS[driver.vehicleType]}</Text>
            </View>
            <View style={styles.cardMetaDivider} />
            <View style={styles.cardMetaItem}>
              <Package size={13} color={Colors.slateLight} />
              <Text style={styles.cardMetaText}>{driver.activeStops} stops</Text>
            </View>
            <View style={styles.cardMetaDivider} />
            <View style={styles.cardMetaItem}>
              <Star size={13} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.cardMetaText}>{driver.rating}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        <ChevronRight size={18} color={Colors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function DriverDetailModal({
  driver,
  visible,
  onClose,
  packageIds,
  allPackageNames,
}: {
  driver: Driver | null;
  visible: boolean;
  onClose: () => void;
  packageIds: string[];
  allPackageNames: Record<string, string>;
}) {
  if (!driver) return null;

  const config = STATUS_CONFIG[driver.status];
  const VehicleIcon = VEHICLE_ICONS[driver.vehicleType];

  const handleCall = async () => {
    if (!driver.phone) {
      Alert.alert('No phone number', 'This driver has no phone number on file.');
      return;
    }
    const url = `tel:${driver.phone.replace(/[^0-9+]/g, '')}`;
    try {
      const supported = Platform.OS === 'web' ? false : await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable', 'Phone calls are not supported on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      log('[drivers] call error', e);
      Alert.alert('Error', 'Could not start a call.');
    }
  };

  const handleMessage = async () => {
    if (!driver.phone) {
      Alert.alert('No phone number', 'This driver has no phone number on file.');
      return;
    }
    const url = Platform.select({
      ios: `sms:${driver.phone.replace(/[^0-9+]/g, '')}`,
      android: `sms:${driver.phone.replace(/[^0-9+]/g, '')}?body=`,
      default: `sms:${driver.phone.replace(/[^0-9+]/g, '')}`,
    }) as string;
    try {
      const supported = Platform.OS === 'web' ? false : await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable', 'Text messages are not supported on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      log('[drivers] sms error', e);
      Alert.alert('Error', 'Could not open messages.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHandle} />
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} testID="close-driver-detail">
            <X size={20} color={Colors.slate} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.detailHeader}>
            <DriverAvatar name={driver.name} size={72} />
            <Text style={styles.detailName}>{driver.name}</Text>
            <View style={[styles.detailStatusBadge, { backgroundColor: config.bg }]}>
              <View style={[styles.detailStatusDot, { backgroundColor: config.color }]} />
              <Text style={[styles.detailStatusText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{driver.completedDeliveries}</Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{driver.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{driver.activeStops}</Text>
              <Text style={styles.statLabel}>Active Stops</Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Info</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <VehicleIcon size={18} color={Colors.primary} />
                <Text style={styles.infoText}>{VEHICLE_LABELS[driver.vehicleType]}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Phone size={18} color={Colors.primary} />
                <Text style={styles.infoText}>{driver.phone}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Mail size={18} color={Colors.primary} />
                <Text style={styles.infoText}>{driver.email}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Today's Assigned Packages</Text>
            {packageIds.length === 0 ? (
              <View style={styles.emptyAssignments}>
                <Package size={32} color={Colors.slateLighter} />
                <Text style={styles.emptyText}>No packages assigned today</Text>
              </View>
            ) : (
              <View style={styles.assignmentsList}>
                {packageIds.map((pkgId) => (
                  <View key={pkgId} style={styles.assignmentItem}>
                    <View style={styles.assignmentDot} />
                    <Text style={styles.assignmentText}>
                      {allPackageNames[pkgId] ?? pkgId}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleCall} testID="driver-call-btn">
              <Phone size={18} color={Colors.white} />
              <Text style={styles.actionBtnPrimaryText}>Call Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleMessage} testID="driver-message-btn">
              <Mail size={18} color={Colors.primary} />
              <Text style={styles.actionBtnSecondaryText}>Message</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function DriversScreen() {
  const { drivers, isLoading, getPackagesForDriver } = useDrivers();
  const { packages } = usePackages();
  const [search, setSearch] = useState<string>('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.toLowerCase();
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.vehicleType.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q)
    );
  }, [drivers, search]);

  const packageNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    packages.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [packages]);

  const handleDriverPress = useCallback((driver: Driver) => {
    setSelectedDriver(driver);
    setShowDetail(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedDriver(null);
  }, []);

  const selectedDriverPackages = useMemo(() => {
    if (!selectedDriver) return [];
    return getPackagesForDriver(selectedDriver.id);
  }, [selectedDriver, getPackagesForDriver]);

  const availableCount = useMemo(() => drivers.filter((d) => d.status === 'available').length, [drivers]);
  const busyCount = useMemo(() => drivers.filter((d) => d.status === 'busy').length, [drivers]);

  const renderDriver = useCallback(({ item }: { item: Driver }) => (
    <DriverCard driver={item} onPress={() => handleDriverPress(item)} />
  ), [handleDriverPress]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{
          title: 'Drivers',
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
        }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Drivers',
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
      }} />

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.summaryText}>{availableCount} Available</Text>
        </View>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#D97706' }]} />
          <Text style={styles.summaryText}>{busyCount} Busy</Text>
        </View>
        <View style={styles.summaryItem}>
          <Zap size={14} color={Colors.primary} />
          <Text style={styles.summaryText}>{drivers.length} Total</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.slateLighter} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drivers..."
          placeholderTextColor={Colors.slateLighter}
          value={search}
          onChangeText={setSearch}
          testID="driver-search-input"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredDrivers}
        keyExtractor={(item) => item.id}
        renderItem={renderDriver}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <TruckIcon size={48} color={Colors.slateLighter} />
            <Text style={styles.emptyTitle}>No Drivers Found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different search term' : 'No drivers registered yet'}
            </Text>
          </View>
        }
      />

      <DriverDetailModal
        driver={selectedDriver}
        visible={showDetail}
        onClose={handleCloseDetail}
        packageIds={selectedDriverPackages}
        allPackageNames={packageNameMap}
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
  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  cardMetaDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 12,
  },
  modalCloseBtn: {
    position: 'absolute' as const,
    right: 20,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  detailHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
  },
  detailName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#1F2937',
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  detailStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.slateLight,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 10,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 44,
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500' as const,
  },
  emptyAssignments: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.slateLight,
  },
  assignmentsList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assignmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  assignmentText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#374151',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.skyBlue,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});
