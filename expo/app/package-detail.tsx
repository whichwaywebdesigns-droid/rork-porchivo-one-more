import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  Share,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/store/AppContext';
import {
  ShoppingCart,
  Truck,
  Navigation,
  PackageCheck,
  HandHeart,
  UserCheck,
  RotateCcw,
  Trash2,
  ChevronLeft,
  UserPlus,
  Phone,
  MessageSquare,
  X,
  Star,
  Package,
  MapPin,
  CheckCircle,
  ShieldAlert,
  ChevronRight,
  Gift,
  Share2,
  StickyNote,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { usePackages } from '@/store/PackagesContext';
import { useDrivers } from '@/store/DriversContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { useShipments } from '@/store/ShipmentsContext';
import { Image as RNImage } from 'react-native';
import { PackageTrackingStatus, Driver, PorchPartner } from '@/types';
import CarrierIcon from '@/components/CarrierIcon';
import { canAssignDriver, calculateMockDistance } from '@/lib/driverAssignment';
import LiveTrackingTimeline from '@/components/LiveTrackingTimeline';
import { Ship24Milestone } from '@/lib/ship24';
import { log } from "@/lib/logger";

const STATUS_STEPS: { status: PackageTrackingStatus; label: string; icon: typeof ShoppingCart }[] = [
  { status: 'ordered', label: 'Ordered', icon: ShoppingCart },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation },
  { status: 'delivered', label: 'Delivered', icon: PackageCheck },
  { status: 'picked_up', label: 'Picked Up', icon: UserCheck },
  { status: 'returned', label: 'Returned', icon: RotateCcw },
];

const STATUS_COLORS: Record<PackageTrackingStatus, string> = {
  ordered: '#6B7280',
  shipped: '#2563EB',
  out_for_delivery: '#D97706',
  delivered: '#059669',
  picked_up: '#7C3AED',
  returned: '#DC2626',
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function AvatarCircle({ name, size = 40 }: { name: string; size?: number }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorList = ['#1D4F91', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
  const colorIndex = name.charCodeAt(0) % colorList.length;
  const bg = colorList[colorIndex];

  return (
    <View style={[styles.driverAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.driverAvatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function DriverPickerRow({
  driver,
  index,
  onSelect,
}: {
  driver: Driver;
  index: number;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const distance = calculateMockDistance(index);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.pickerRow}
        onPress={onSelect}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        activeOpacity={1}
      >
        <AvatarCircle name={driver.name} size={44} />
        <View style={styles.pickerInfo}>
          <Text style={styles.pickerName}>{driver.name}</Text>
          <View style={styles.pickerMeta}>
            <View style={styles.distanceBadge}>
              <MapPin size={11} color={colors.primary} />
              <Text style={styles.distanceText}>{distance} mi</Text>
            </View>
            <Text style={styles.pickerStops}>{driver.activeStops} active stops</Text>
          </View>
        </View>
        <View style={styles.pickerRating}>
          <Star size={12} color="#F59E0B" fill="#F59E0B" />
          <Text style={styles.pickerRatingText}>{driver.rating}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PartnerPickerRow({
  partner,
  onSelect,
}: {
  partner: PorchPartner;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.pickerRow}
        onPress={onSelect}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        activeOpacity={1}
      >
        <AvatarCircle name={partner.name} size={44} />
        <View style={styles.pickerInfo}>
          <View style={styles.pickerNameRow}>
            <Text style={styles.pickerName}>{partner.name}</Text>
            {partner.isVolunteer && (
              <View style={styles.volunteerBadge}>
                <Gift size={10} color={colors.success} />
                <Text style={styles.volunteerBadgeText}>Free</Text>
              </View>
            )}
          </View>
          <View style={styles.pickerMeta}>
            <View style={styles.distanceBadge}>
              <MapPin size={11} color={colors.primary} />
              <Text style={styles.distanceText}>{partner.distance} mi</Text>
            </View>
            <Text style={styles.pickerStops}>{partner.completedHolds} holds</Text>
          </View>
        </View>
        <View style={styles.pickerRating}>
          <Star size={12} color="#F59E0B" fill="#F59E0B" />
          <Text style={styles.pickerRatingText}>{partner.rating}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useApp();
  const { packages, deletePackage, assignDriverToPackage, unassignDriverFromPackage, assignPartnerToPackage: pkgAssignPartner, refreshPackage, refreshAllPackages, ship24Enabled, updatePersonalNotes } = usePackages();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { getRankedDrivers, getDriverForPackage, assignDriverToPackage: driverCtxAssign, unassignDriverFromPackage: driverCtxUnassign } = useDrivers();
  const { activePartners, getPartnerById, getHoldForPackage, assignPartnerToPackage, unassignPartnerFromPackage, markPickedUp, markReturned } = usePorchPartners();
  const { shipments } = useShipments();
  const [photoViewerVisible, setPhotoViewerVisible] = useState<boolean>(false);
  const [showDriverPicker, setShowDriverPicker] = useState<boolean>(false);
  const [showPartnerPicker, setShowPartnerPicker] = useState<boolean>(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const pkg = useMemo(() => packages.find((p) => p.id === id), [packages, id]);

  const [notesDraft, setNotesDraft] = useState<string>('');
  const [notesSaved, setNotesSaved] = useState<boolean>(false);
  const saveNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotesDraft(pkg?.personalNotes ?? '');
  }, [pkg?.id, pkg?.personalNotes]);

  const handleNotesChange = useCallback((text: string) => {
    setNotesDraft(text);
    setNotesSaved(false);
    if (saveNotesTimer.current) clearTimeout(saveNotesTimer.current);
    if (!pkg) return;
    saveNotesTimer.current = setTimeout(() => {
      updatePersonalNotes(pkg.id, text);
      setNotesSaved(true);
    }, 800);
  }, [pkg, updatePersonalNotes]);

  useEffect(() => {
    return () => {
      if (saveNotesTimer.current) clearTimeout(saveNotesTimer.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (!pkg) return;
    setIsRefreshing(true);
    try {
      await refreshPackage(pkg.id);
    } finally {
      setIsRefreshing(false);
    }
  }, [pkg, refreshPackage]);
  const assignedDriver = useMemo(() => (pkg ? getDriverForPackage(pkg.id) : undefined), [pkg, getDriverForPackage]);
  const assignedPartner = useMemo(() => (pkg?.porchPartnerId ? getPartnerById(pkg.porchPartnerId) : undefined), [pkg?.porchPartnerId, getPartnerById]);
  const hold = useMemo(() => (pkg ? getHoldForPackage(pkg.id) : undefined), [pkg, getHoldForPackage]);

  const deliveryPhotoUrl = useMemo(() => {
    if (!pkg?.trackingNumber) return null;
    const match = shipments.find(
      (s) => s.trackingNumber === pkg.trackingNumber && s.completionPhotoUrl,
    );
    return match?.completionPhotoUrl ?? null;
  }, [shipments, pkg?.trackingNumber]);

  const rankedDrivers = useMemo(() => {
    if (!pkg) return [];
    return getRankedDrivers(pkg);
  }, [pkg, getRankedDrivers]);

  if (!pkg) {
    return (
      <View style={styles.notFound}>
        <Stack.Screen options={{ title: 'Package Detail' }} />
        <Text style={styles.notFoundText}>Package not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.slate} strokeWidth={2} />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeColor = STATUS_COLORS[pkg.currentStatus];
  const currentIndex = STATUS_STEPS.findIndex((s) => s.status === pkg.currentStatus);
  const showAssignButton = canAssignDriver(pkg) && !assignedDriver;

  const handleDelete = () => {
    Alert.alert(
      'Delete Package',
      `Remove "${pkg.name}" from your tracking list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (pkg.driverId) {
              driverCtxUnassign(pkg.id);
              unassignDriverFromPackage(pkg.id);
            }
            if (pkg.porchPartnerId) {
              unassignPartnerFromPackage(pkg.id);
            }
            deletePackage(pkg.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleAssignDriver = (driver: Driver) => {
    Alert.alert(
      'Assign Driver',
      `Assign this package to ${driver.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            log('[PackageDetail] Assigning driver', driver.id, 'to package', pkg.id);
            assignDriverToPackage(pkg.id, driver.id);
            driverCtxAssign(driver.id, pkg.id);
            setShowDriverPicker(false);
            Alert.alert('Driver Assigned', `${driver.name} has been assigned to deliver "${pkg.name}".`);
          },
        },
      ],
    );
  };

  const handleContact = async (phone: string | undefined | null, type: 'call' | 'sms') => {
    if (!phone) {
      Alert.alert('No phone number', 'No phone number is available.');
      return;
    }
    const cleaned = phone.replace(/[^0-9+]/g, '');
    const url = type === 'call' ? `tel:${cleaned}` : `sms:${cleaned}`;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Unavailable', `${type === 'call' ? 'Calls' : 'Messages'} are not supported on web.`);
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable', `${type === 'call' ? 'Calls' : 'Messages'} are not supported on this device.`);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      log('[package-detail] contact error', e);
      Alert.alert('Error', 'Could not open the app.');
    }
  };

  const handleUnassignDriver = () => {
    if (!assignedDriver) return;
    Alert.alert(
      'Unassign Driver',
      `Remove ${assignedDriver.name} from this package?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => {
            driverCtxUnassign(pkg.id);
            unassignDriverFromPackage(pkg.id);
          },
        },
      ],
    );
  };

  const handleAssignPartner = (partner: PorchPartner) => {
    Alert.alert(
      'Assign Partner',
      `Assign this package to ${partner.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            log('[PackageDetail] Assigning partner', partner.id, 'to package', pkg.id);
            pkgAssignPartner(pkg.id, partner.id);
            const street = user?.address ? user.address.split(',')[0] : 'your block';
            assignPartnerToPackage(pkg.id, partner.id, user?.id ?? '', `Neighbor on ${street}`);
            setShowPartnerPicker(false);
            Alert.alert('Partner Assigned', `${partner.name} will hold your package.`);
          },
        },
      ],
    );
  };

  const handleUnassignPartner = () => {
    Alert.alert('Remove Partner', 'Unassign this Porch Partner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          unassignPartnerFromPackage(pkg.id);
          pkgAssignPartner(pkg.id, null);
        },
      },
    ]);
  };

  const handleShare = useCallback(async () => {
    const statusLabel = STATUS_STEPS.find((s) => s.status === pkg.currentStatus)?.label ?? pkg.currentStatus;
    const deliveryDate = formatDate(pkg.expectedDeliveryDate);
    const message =
      `Porchivo — ${pkg.name}\n` +
      `Carrier: ${pkg.carrier}\n` +
      `Status: ${statusLabel}\n` +
      `Expected delivery: ${deliveryDate}\n` +
      `Tracking #: ${pkg.trackingNumber}`;

    try {
      await Share.share({
        message,
        title: `Porchivo — ${pkg.name}`,
      });
    } catch (e) {
      log('[package-detail] share error', e);
    }
  }, [pkg]);

  const renderPickerDriver = ({ item, index }: { item: Driver; index: number }) => (
    <DriverPickerRow driver={item} index={index} onSelect={() => handleAssignDriver(item)} />
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Package Detail',
          presentation: 'modal',
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <CarrierIcon carrier={pkg.carrier} size={52} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{pkg.name}</Text>
              <Text style={styles.heroCarrier}>{pkg.carrier}</Text>
            </View>
            <TouchableOpacity
              onPress={handleShare}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
              accessibilityLabel="Share tracking status"
              accessibilityRole="button"
            >
              <Share2 size={20} color={colors.slateLight} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Tracking</Text>
              <Text style={styles.metaValue} selectable>{pkg.trackingNumber}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Expected</Text>
              <Text style={styles.metaValue}>{formatDate(pkg.expectedDeliveryDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Status</Text>
                <View style={[styles.statusChip, { backgroundColor: activeColor + '18' }]}>
                  <Text style={[styles.statusChipText, { color: activeColor }]}>
                    {STATUS_STEPS.find((s) => s.status === pkg.currentStatus)?.label}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Address</Text>
                <Text style={styles.metaValue}>
                  {pkg.addressNickname === 'Other' && pkg.customAddressLabel
                    ? pkg.customAddressLabel
                    : pkg.addressNickname}
                </Text>
              </View>
            </View>
          </View>

          {pkg.notesForPartner ? (
            <>
              <View style={styles.heroDivider} />
              <View style={styles.notesSection}>
                <Text style={styles.metaLabel}>Notes for Porch Partner</Text>
                <Text style={styles.notesText}>{pkg.notesForPartner}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.personalNotesCard}>
          <View style={styles.personalNotesHeader}>
            <View style={styles.personalNotesIconWrap}>
              <StickyNote size={16} color={colors.primary} />
            </View>
            <Text style={styles.personalNotesTitle}>Personal Notes</Text>
            {notesSaved && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            )}
          </View>
          <TextInput
            style={styles.personalNotesInput}
            value={notesDraft}
            onChangeText={handleNotesChange}
            placeholder="Add your own notes about this package — what's inside, who it's for, where to store it..."
            placeholderTextColor={colors.slateLighter}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
          />
        </View>

        {assignedPartner ? (
          <View style={styles.partnerCard}>
            <View style={styles.assignedDriverHeader}>
              <Text style={styles.assignedDriverTitle}>Porch Partner</Text>
            </View>
            <View style={styles.assignedDriverContent}>
              <AvatarCircle name={assignedPartner.name} size={48} />
              <View style={styles.assignedDriverInfo}>
                <Text style={styles.assignedDriverName}>{assignedPartner.name}</Text>
                <View style={styles.assignedDriverMeta}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.assignedDriverRating}>{assignedPartner.rating}</Text>
                  <Text style={styles.assignedDriverDot}>·</Text>
                  <Text style={styles.assignedDriverStops}>{assignedPartner.completedHolds} holds</Text>
                </View>
              </View>
            </View>
            {hold && (
              <View style={styles.holdStatusRow}>
                <View style={[
                  styles.holdStatusBadge,
                  {
                    backgroundColor:
                      hold.status === 'picked_up' ? '#F5F3FF' :
                      hold.status === 'returned' ? '#ECFDF5' : '#FFFBEB',
                  },
                ]}>
                  {hold.status === 'picked_up' ? (
                    <HandHeart size={12} color="#7C3AED" />
                  ) : hold.status === 'returned' ? (
                    <CheckCircle size={12} color="#059669" />
                  ) : (
                    <Package size={12} color="#D97706" />
                  )}
                  <Text style={[
                    styles.holdStatusText,
                    {
                      color:
                        hold.status === 'picked_up' ? '#7C3AED' :
                        hold.status === 'returned' ? '#059669' : '#D97706',
                    },
                  ]}>
                    {hold.status === 'picked_up'
                      ? 'Partner is holding'
                      : hold.status === 'returned'
                      ? 'Returned to you'
                      : 'Awaiting pickup'}
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.assignedDriverActions}>
              {hold?.status === 'pending' && (
                <TouchableOpacity
                  style={styles.driverActionBtn}
                  onPress={() => {
                    Alert.alert('Confirm', 'Mark as picked up by partner?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Picked Up', onPress: () => markPickedUp(pkg.id) },
                    ]);
                  }}
                >
                  <HandHeart size={16} color={colors.secondary} />
                  <Text style={[styles.driverActionText, { color: colors.secondary }]}>Picked Up</Text>
                </TouchableOpacity>
              )}
              {hold?.status === 'picked_up' && (
                <TouchableOpacity
                  style={styles.driverActionBtn}
                  onPress={() => {
                    Alert.alert('Confirm', 'Mark as returned to owner?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Returned', onPress: () => markReturned(pkg.id) },
                    ]);
                  }}
                >
                  <RotateCcw size={16} color={colors.success} />
                  <Text style={[styles.driverActionText, { color: colors.success }]}>Returned</Text>
                </TouchableOpacity>
              )}
              {hold?.status !== 'returned' && (
                <>
                  <View style={styles.driverActionDivider} />
                  <TouchableOpacity style={styles.driverActionBtn} onPress={handleUnassignPartner}>
                    <X size={16} color={colors.danger} />
                    <Text style={[styles.driverActionText, { color: colors.danger }]}>Remove</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ) : pkg.currentStatus !== 'returned' ? (
          <TouchableOpacity
            style={styles.assignPartnerBtn}
            onPress={() => setShowPartnerPicker(true)}
            testID="assign-partner-btn"
          >
            <HandHeart size={18} color={colors.secondary} />
            <Text style={styles.assignPartnerText}>Assign Porch Partner</Text>
          </TouchableOpacity>
        ) : null}

        {assignedDriver ? (
          <View style={styles.assignedDriverCard}>
            <View style={styles.assignedDriverHeader}>
              <Text style={styles.assignedDriverTitle}>Assigned Driver</Text>
            </View>
            <View style={styles.assignedDriverContent}>
              <AvatarCircle name={assignedDriver.name} size={48} />
              <View style={styles.assignedDriverInfo}>
                <Text style={styles.assignedDriverName}>{assignedDriver.name}</Text>
                <View style={styles.assignedDriverMeta}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.assignedDriverRating}>{assignedDriver.rating}</Text>
                  <Text style={styles.assignedDriverDot}>·</Text>
                  <Text style={styles.assignedDriverStops}>{assignedDriver.activeStops} stops</Text>
                </View>
              </View>
            </View>
            <View style={styles.assignedDriverActions}>
              <TouchableOpacity style={styles.driverActionBtn} onPress={() => handleContact(assignedDriver.phone, 'call')} testID="pkg-driver-call">
                <Phone size={16} color={colors.primary} />
                <Text style={styles.driverActionText}>Call</Text>
              </TouchableOpacity>
              <View style={styles.driverActionDivider} />
              <TouchableOpacity style={styles.driverActionBtn} onPress={() => handleContact(assignedDriver.phone, 'sms')} testID="pkg-driver-message">
                <MessageSquare size={16} color={colors.primary} />
                <Text style={styles.driverActionText}>Message</Text>
              </TouchableOpacity>
              <View style={styles.driverActionDivider} />
              <TouchableOpacity style={styles.driverActionBtn} onPress={handleUnassignDriver}>
                <X size={16} color={colors.danger} />
                <Text style={[styles.driverActionText, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : showAssignButton ? (
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => setShowDriverPicker(true)}
            testID="assign-driver-btn"
          >
            <UserPlus size={20} color={colors.white} />
            <Text style={styles.assignButtonText}>Assign Driver</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.riskCta}
          onPress={() => router.push({ pathname: '/porch-risk' as any, params: { id: pkg.id } })}
          activeOpacity={0.85}
          testID="open-porch-risk"
        >
          <View style={styles.riskCtaIcon}>
            <ShieldAlert size={20} color={colors.primary} />
          </View>
          <View style={styles.riskCtaText}>
            <Text style={styles.riskCtaTitle}>Check porch risk</Text>
            <Text style={styles.riskCtaSub}>See risk level & secure plan for this delivery</Text>
          </View>
          <ChevronRight size={18} color={colors.slateLighter} />
        </TouchableOpacity>

        {deliveryPhotoUrl && pkg.currentStatus === 'delivered' ? (
          <View style={styles.proofCard}>
            <View style={styles.proofHeader}>
              <View style={styles.proofIconWrap}>
                <PackageCheck size={16} color={colors.success} />
              </View>
              <View style={styles.proofHeaderText}>
                <Text style={styles.proofTitle}>Delivery Confirmation Photo</Text>
                <Text style={styles.proofSubText}>Your Porch Partner captured this photo when marking the delivery complete.</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPhotoViewerVisible(true)}
            >
              <View style={styles.proofPhotoWrap}>
                <RNImage
                  source={{ uri: deliveryPhotoUrl }}
                  style={styles.proofPhoto}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {pkg.trackingNumber ? (
          <View style={{ marginTop: 20 }}>
            <LiveTrackingTimeline
              configured={ship24Enabled}
              milestone={(pkg.liveMilestone as Ship24Milestone | null) ?? null}
              events={pkg.liveEvents ?? []}
              lastPolledAt={pkg.lastPolledAt}
              isRefreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                try {
                  await refreshPackage(pkg.id);
                } finally {
                  setIsRefreshing(false);
                }
              }}
            />
          </View>
        ) : null}

        <Text style={styles.timelineTitle}>Delivery Timeline</Text>

        <View style={styles.timeline}>
          {STATUS_STEPS.map((step, index) => {
            const event = pkg.statusHistory.find((e) => e.status === step.status);
            const isCompleted = event?.completed ?? false;
            const isCurrent = step.status === pkg.currentStatus;
            const isLast = index === STATUS_STEPS.length - 1;
            const stepColor = isCompleted || isCurrent ? STATUS_COLORS[step.status] : '#D1D5DB';
            const Icon = step.icon;

            return (
              <View key={step.status} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineIcon,
                      {
                        backgroundColor: isCompleted || isCurrent ? stepColor + '20' : '#F3F4F6',
                        borderColor: isCompleted || isCurrent ? stepColor : '#D1D5DB',
                      },
                    ]}
                  >
                    <Icon
                      size={18}
                      color={isCompleted || isCurrent ? stepColor : '#9CA3AF'}
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor:
                            index < currentIndex ? STATUS_COLORS[STATUS_STEPS[index + 1]?.status ?? 'ordered'] : '#E5E7EB',
                        },
                      ]}
                    />
                  )}
                </View>

                <View style={[styles.timelineContent, isLast && { paddingBottom: 0 }]}>
                  <Text
                    style={[
                      styles.timelineLabel,
                      {
                        color: isCompleted || isCurrent ? '#1F2937' : '#9CA3AF',
                        fontWeight: isCurrent ? '700' as const : '500' as const,
                      },
                    ]}
                  >
                    {step.label}
                    {isCurrent && (
                      <Text style={[styles.currentBadge, { color: stepColor }]}> · Current</Text>
                    )}
                  </Text>
                  {event?.timestamp && (
                    <Text style={styles.timelineTime}>{formatTimestamp(event.timestamp)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          testID="delete-package"
        >
          <Trash2 size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Remove Package</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={photoViewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.photoViewer}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setPhotoViewerVisible(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={24} color={colors.white} />
          </TouchableOpacity>
          {deliveryPhotoUrl && (
            <RNImage
              source={{ uri: deliveryPhotoUrl }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showPartnerPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPartnerPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <View style={styles.pickerHandle} />
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowPartnerPicker(false)}
            >
              <X size={20} color={colors.slate} />
            </TouchableOpacity>
          </View>
          <Text style={styles.pickerTitle}>Select a Porch Partner</Text>
          <Text style={styles.pickerSubtitle}>Choose a trusted neighbor to hold your package</Text>
          <FlatList
            data={activePartners}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PartnerPickerRow partner={item} onSelect={() => handleAssignPartner(item)} />
            )}
            contentContainerStyle={styles.pickerList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <HandHeart size={40} color={colors.slateLighter} />
                <Text style={styles.pickerEmptyText}>No partners available</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <Modal
        visible={showDriverPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDriverPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <View style={styles.pickerHandle} />
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowDriverPicker(false)}
            >
              <X size={20} color={colors.slate} />
            </TouchableOpacity>
          </View>
          <Text style={styles.pickerTitle}>Select a Driver</Text>
          <Text style={styles.pickerSubtitle}>
            Sorted by fewest stops & closest distance
          </Text>
          <FlatList
            data={rankedDrivers}
            keyExtractor={(item) => item.id}
            renderItem={renderPickerDriver}
            contentContainerStyle={styles.pickerList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Package size={40} color={colors.slateLighter} />
                <Text style={styles.pickerEmptyText}>No available drivers right now</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  notFound: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundText: {
    fontSize: 17,
    color: colors.slateLight,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  heroCarrier: {
    fontSize: 14,
    color: colors.slateLight,
    fontWeight: '500' as const,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
  },
  heroMeta: {
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  notesSection: {
    gap: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  personalNotesCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginTop: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  personalNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  personalNotesIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalNotesTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  savedBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savedBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.success,
  },
  personalNotesInput: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    minHeight: 80,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  assignButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.white,
  },
  assignPartnerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.white,
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  assignPartnerText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.secondary,
  },
  partnerCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  holdStatusRow: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  holdStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  holdStatusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  assignedDriverCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  assignedDriverHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
  },
  assignedDriverTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  assignedDriverContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  assignedDriverInfo: {
    flex: 1,
    gap: 4,
  },
  assignedDriverName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  assignedDriverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignedDriverRating: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
  },
  assignedDriverDot: {
    fontSize: 13,
    color: colors.slateLighter,
  },
  assignedDriverStops: {
    fontSize: 13,
    color: colors.slateLight,
  },
  assignedDriverActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  driverActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  driverActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  driverActionDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
  },
  driverAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: colors.white,
    fontWeight: '700' as const,
  },
  timelineTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 28,
    marginBottom: 16,
    marginLeft: 4,
  },
  timeline: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineStep: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 44,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  timelineLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  timelineTime: {
    fontSize: 12,
    color: colors.slateLight,
    marginTop: 2,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.dangerLight,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  pickerModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickerHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 12,
  },
  pickerCloseBtn: {
    position: 'absolute' as const,
    right: 20,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 8,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: colors.slateLight,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  pickerInfo: {
    flex: 1,
    gap: 4,
  },
  pickerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  volunteerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  volunteerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: colors.success,
  },
  pickerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  pickerStops: {
    fontSize: 12,
    color: colors.slateLight,
    fontWeight: '500' as const,
  },
  pickerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickerRatingText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#374151',
  },
  pickerEmpty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  pickerEmptyText: {
    fontSize: 15,
    color: colors.slateLight,
  },
  riskCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  riskCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskCtaText: { flex: 1 },
  riskCtaTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  riskCtaSub: {
    fontSize: 12,
    color: colors.slateLight,
  },
  proofCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginTop: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  proofHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  proofIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofHeaderText: {
    flex: 1,
    gap: 3,
  },
  proofTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  proofSubText: {
    fontSize: 12,
    color: colors.slateLight,
    lineHeight: 17,
  },
  proofPhotoWrap: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    backgroundColor: colors.borderLight,
  },
  proofPhoto: {
    width: '100%',
    height: 220,
  },
  photoViewer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute' as const,
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
  });
}
