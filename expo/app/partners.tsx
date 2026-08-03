import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  Users,
  MapPin,
  Star,
  ChevronRight,
  Package,
  HandHeart,
  UserPlus,
  CheckCircle,
  Clock,
  RotateCcw,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { palette, radius, space, elevation, tabularNums } from '@/constants/theme';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { usePackages } from '@/store/PackagesContext';
import { useApp } from '@/store/AppContext';
import { PorchPartner, PackageHold, TrackedPackage } from '@/types';
import CarrierIcon from '@/components/CarrierIcon';
import { sendSMSInvite } from '@/utils/invite';
import { log } from "@/lib/logger";

function PartnerAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorList = [palette.navy, palette.sage, palette.gold, palette.emberDeep, palette.navySoft, palette.rose];
  const colorIndex = name.charCodeAt(0) % colorList.length;
  const bg = colorList[colorIndex];

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function PartnerCard({
  partner,
  onPress,
}: {
  partner: PorchPartner;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.partnerCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        activeOpacity={1}
        testID={`partner-card-${partner.id}`}
      >
        <PartnerAvatar name={partner.name} size={50} />
        <View style={styles.partnerInfo}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <View style={styles.partnerMeta}>
            <View style={styles.distanceBadge}>
              <MapPin size={11} color={colors.primary} />
              <Text style={styles.distanceText}>{partner.distance} mi</Text>
            </View>
            <Text style={styles.partnerStreet}>{partner.street}</Text>
          </View>
          <View style={styles.partnerStats}>
            <View style={styles.statItem}>
              <Star size={12} color={palette.gold} fill={palette.gold} />
              <Text style={styles.statText}>{partner.rating}</Text>
            </View>
            <View style={styles.statDot} />
            <View style={styles.statItem}>
              <CheckCircle size={12} color={colors.success} />
              <Text style={styles.statText}>{partner.completedHolds} holds</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={18} color={colors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const MemoizedPartnerCard = React.memo(PartnerCard);

function HoldCard({
  hold,
  pkg,
  onPickUp,
  onReturn,
}: {
  hold: PackageHold;
  pkg: TrackedPackage | undefined;
  onPickUp: () => void;
  onReturn: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (!pkg) return null;

  const statusConfig = {
    pending: { label: 'Awaiting Pickup', color: palette.gold, bg: palette.goldSoft, icon: Clock },
    picked_up: { label: 'Holding', color: palette.navy, bg: palette.sky, icon: HandHeart },
    returned: { label: 'Returned', color: palette.sage, bg: palette.sageSoft, icon: CheckCircle },
  };

  const config = statusConfig[hold.status];
  const StatusIcon = config.icon;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.holdCard}>
        <View style={styles.holdTop}>
          <CarrierIcon carrier={pkg.carrier} size={38} />
          <View style={styles.holdInfo}>
            <Text style={styles.holdName} numberOfLines={1}>
              {hold.homeownerNickname}
            </Text>
            <Text style={styles.holdCarrier}>{pkg.carrier} · {pkg.name}</Text>
          </View>
          <View style={[styles.holdStatusPill, { backgroundColor: config.bg }]}>
            <StatusIcon size={11} color={config.color} />
            <Text style={[styles.holdStatusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        {hold.status === 'pending' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPickUp}
            testID={`pickup-${hold.packageId}`}
          >
            <HandHeart size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>Picked Up from Porch</Text>
          </TouchableOpacity>
        )}

        {hold.status === 'picked_up' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.returnButton]}
            onPress={onReturn}
            testID={`return-${hold.packageId}`}
          >
            <RotateCcw size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>Returned to Owner</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export default function PartnersScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isHomeowner, isPartner } = useApp();
  const { activePartners, holds, markPickedUp, markReturned } = usePorchPartners();
  const { packages } = usePackages();
  const [inviting, setInviting] = useState<boolean>(false);

  const myHolds = useMemo(() => {
    return holds.filter(
      (h) => h.status === 'pending' || h.status === 'picked_up',
    );
  }, [holds]);

  const upcomingForPartner = useMemo(() => {
    return holds.filter(
      (h) => h.status === 'pending',
    );
  }, [holds]);

  const handlePickUp = useCallback(
    (packageId: string) => {
      Alert.alert(
        'Confirm Pickup',
        'Mark this package as picked up from the porch?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Picked Up',
            onPress: () => {
              log('[Partners] Marking picked up:', packageId);
              markPickedUp(packageId);
            },
          },
        ],
      );
    },
    [markPickedUp],
  );

  const handleReturn = useCallback(
    (packageId: string) => {
      Alert.alert(
        'Confirm Return',
        'Mark this package as returned to the owner?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Returned',
            onPress: () => {
              log('[Partners] Marking returned:', packageId);
              markReturned(packageId);
            },
          },
        ],
      );
    },
    [markReturned],
  );

  const handleInvite = useCallback(async () => {
    if (!user || inviting) return;
    setInviting(true);
    try {
      await sendSMSInvite(user.name, user.id);
    } finally {
      setInviting(false);
    }
  }, [user, inviting]);

  const renderPartner = useCallback(
    ({ item }: { item: PorchPartner }) => (
      <MemoizedPartnerCard
        partner={item}
        onPress={() =>
          router.push({ pathname: '/partner-detail' as any, params: { id: item.id } })
        }
      />
    ),
    [router],
  );

  const renderHeader = useCallback(() => {
    return (
      <View>
        {isPartner && myHolds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <HandHeart size={18} color={colors.secondary} />
              <Text style={styles.sectionTitle}>Packages I'm Holding</Text>
            </View>
            {myHolds.map((hold) => {
              const pkg = packages.find((p) => p.id === hold.packageId);
              return (
                <HoldCard
                  key={hold.packageId}
                  hold={hold}
                  pkg={pkg}
                  onPickUp={() => handlePickUp(hold.packageId)}
                  onReturn={() => handleReturn(hold.packageId)}
                />
              );
            })}
          </View>
        )}

        {isPartner && upcomingForPartner.length > 0 && myHolds.length === 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Upcoming Deliveries for Neighbors</Text>
            </View>
            {upcomingForPartner.map((hold) => {
              const pkg = packages.find((p) => p.id === hold.packageId);
              return (
                <HoldCard
                  key={hold.packageId}
                  hold={hold}
                  pkg={pkg}
                  onPickUp={() => handlePickUp(hold.packageId)}
                  onReturn={() => handleReturn(hold.packageId)}
                />
              );
            })}
          </View>
        )}

        {isHomeowner && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>My Trusted Partners</Text>
              <Text style={styles.sectionCount}>{activePartners.length}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }, [isPartner, isHomeowner, myHolds, upcomingForPartner, activePartners, packages, handlePickUp, handleReturn]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Porch Partners',
        headerStyle: { backgroundColor: palette.canvas },
        headerShadowVisible: false,
      }} />

      {activePartners.length === 0 && myHolds.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <HandHeart size={48} color={colors.slateLighter} />
          </View>
          <Text style={styles.emptyTitle}>No Porch Partners yet</Text>
          <Text style={styles.emptySubtitle}>
            Invite trusted neighbors to help keep your packages safe while you're away.
          </Text>
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite} testID="invite-btn">
            <UserPlus size={18} color={colors.white} />
            <Text style={styles.inviteButtonText}>Invite a Neighbor</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={isHomeowner ? activePartners : []}
            renderItem={renderPartner}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isHomeowner ? (
                <TouchableOpacity
                  style={styles.inviteRow}
                  onPress={handleInvite}
                  testID="invite-row"
                >
                  <View style={styles.inviteIconWrap}>
                    <UserPlus size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.inviteRowText}>Invite another neighbor</Text>
                  <ChevronRight size={16} color={colors.slateLighter} />
                </TouchableOpacity>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.slate,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.slateLighter,
    backgroundColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700' as const,
  },
  partnerInfo: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.slate,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  partnerStreet: {
    fontSize: 12,
    color: colors.slateLight,
    fontWeight: '500' as const,
  },
  partnerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: palette.slate700,
    fontWeight: '600' as const,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.slateLighter,
  },
  holdCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  holdTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holdInfo: {
    flex: 1,
  },
  holdName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.slate,
  },
  holdCarrier: {
    fontSize: 12,
    color: colors.slateLight,
    marginTop: 2,
  },
  holdStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  holdStatusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  returnButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.white,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  inviteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.slate,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.slateLight,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  });
}
