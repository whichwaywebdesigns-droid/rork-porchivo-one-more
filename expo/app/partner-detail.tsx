import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  MapPin,
  Star,
  CheckCircle,
  Calendar,
  HandHeart,
  Package,
  Clock,
  RotateCcw,
  Gift,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { usePackages } from '@/store/PackagesContext';
import { PackageHold } from '@/types';
import CarrierIcon from '@/components/CarrierIcon';

function PartnerAvatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorList = ['#1D4F91', '#059669', '#D97706', '#7C3AED', '#0891B2', '#DC2626'];
  const colorIndex = name.charCodeAt(0) % colorList.length;
  const bg = colorList[colorIndex];

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function PartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getPartnerById, getHoldsForPartner, markPickedUp, markReturned } = usePorchPartners();
  const { packages } = usePackages();

  const partner = useMemo(() => getPartnerById(id ?? ''), [id, getPartnerById]);
  const allHolds = useMemo(() => getHoldsForPartner(id ?? ''), [id, getHoldsForPartner]);

  const activeHolds = useMemo(
    () => allHolds.filter((h) => h.status === 'pending' || h.status === 'picked_up'),
    [allHolds],
  );

  const completedHolds = useMemo(
    () => allHolds.filter((h) => h.status === 'returned'),
    [allHolds],
  );

  const handlePickUp = useCallback(
    (packageId: string) => {
      Alert.alert('Confirm Pickup', 'Mark this package as picked up from the porch?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Picked Up', onPress: () => markPickedUp(packageId) },
      ]);
    },
    [markPickedUp],
  );

  const handleReturn = useCallback(
    (packageId: string) => {
      Alert.alert('Confirm Return', 'Mark this package as returned to the owner?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Returned', onPress: () => markReturned(packageId) },
      ]);
    },
    [markReturned],
  );

  if (!partner) {
    return (
      <View style={styles.notFound}>
        <Stack.Screen options={{ title: 'Partner Detail' }} />
        <Text style={styles.notFoundText}>Partner not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: partner.name, presentation: 'modal' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <PartnerAvatar name={partner.name} size={80} />
          <Text style={styles.profileName}>{partner.name}</Text>
          <Text style={styles.profileStreet}>{partner.street}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Star size={18} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.statValue}>{partner.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <CheckCircle size={18} color={Colors.success} />
              <Text style={styles.statValue}>{partner.completedHolds}</Text>
              <Text style={styles.statLabel}>Holds</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <MapPin size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{partner.distance} mi</Text>
              <Text style={styles.statLabel}>Away</Text>
            </View>
          </View>

          {partner.isVolunteer ? (
            <View style={styles.volunteerBanner}>
              <Gift size={16} color={Colors.success} />
              <Text style={styles.volunteerBannerText}>
                Volunteer Partner — holds packages for free
              </Text>
            </View>
          ) : null}

          <View style={styles.joinedRow}>
            <Calendar size={14} color={Colors.slateLighter} />
            <Text style={styles.joinedText}>Partner since {formatDate(partner.joinedAt)}</Text>
          </View>
        </View>

        {activeHolds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Holds</Text>
            {activeHolds.map((hold) => (
              <HoldItem
                key={hold.packageId}
                hold={hold}
                packages={packages}
                onPickUp={() => handlePickUp(hold.packageId)}
                onReturn={() => handleReturn(hold.packageId)}
              />
            ))}
          </View>
        )}

        {completedHolds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed</Text>
            {completedHolds.slice(0, 5).map((hold) => (
              <HoldItem
                key={hold.packageId}
                hold={hold}
                packages={packages}
                onPickUp={() => {}}
                onReturn={() => {}}
              />
            ))}
          </View>
        )}

        {activeHolds.length === 0 && completedHolds.length === 0 && (
          <View style={styles.emptyHolds}>
            <Package size={36} color={Colors.slateLighter} />
            <Text style={styles.emptyHoldsText}>No package holds yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HoldItem({
  hold,
  packages: pkgs,
  onPickUp,
  onReturn,
}: {
  hold: PackageHold;
  packages: { id: string; carrier: string; name: string; expectedDeliveryDate: string }[];
  onPickUp: () => void;
  onReturn: () => void;
}) {
  const pkg = pkgs.find((p) => p.id === hold.packageId);
  if (!pkg) return null;

  const statusConfig = {
    pending: { label: 'Awaiting Pickup', color: '#D97706', bg: '#FFFBEB', icon: Clock },
    picked_up: { label: 'Holding', color: '#7C3AED', bg: '#F5F3FF', icon: HandHeart },
    returned: { label: 'Returned', color: '#059669', bg: '#ECFDF5', icon: CheckCircle },
  };

  const config = statusConfig[hold.status];
  const StatusIcon = config.icon;

  return (
    <View style={styles.holdItem}>
      <View style={styles.holdItemTop}>
        <CarrierIcon carrier={pkg.carrier as any} size={34} />
        <View style={styles.holdItemInfo}>
          <Text style={styles.holdItemName} numberOfLines={1}>{pkg.name}</Text>
          <Text style={styles.holdItemCarrier}>{hold.homeownerNickname}</Text>
        </View>
        <View style={[styles.holdPill, { backgroundColor: config.bg }]}>
          <StatusIcon size={10} color={config.color} />
          <Text style={[styles.holdPillText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {hold.status === 'pending' && (
        <TouchableOpacity style={styles.holdActionBtn} onPress={onPickUp}>
          <HandHeart size={14} color={Colors.white} />
          <Text style={styles.holdActionText}>Picked Up</Text>
        </TouchableOpacity>
      )}
      {hold.status === 'picked_up' && (
        <TouchableOpacity style={[styles.holdActionBtn, { backgroundColor: Colors.success }]} onPress={onReturn}>
          <RotateCcw size={14} color={Colors.white} />
          <Text style={styles.holdActionText}>Returned</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  notFound: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundText: {
    fontSize: 17,
    color: Colors.slateLight,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  profileStreet: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  volunteerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F9F0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 16,
    width: '100%',
  },
  volunteerBannerText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#059669',
  },
  joinedText: {
    fontSize: 13,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
    marginLeft: 4,
  },
  holdItem: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  holdItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  holdItemInfo: {
    flex: 1,
  },
  holdItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  holdItemCarrier: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 1,
  },
  holdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  holdPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  holdActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.secondary,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  holdActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  emptyHolds: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 10,
  },
  emptyHoldsText: {
    fontSize: 15,
    color: Colors.slateLight,
  },
});
