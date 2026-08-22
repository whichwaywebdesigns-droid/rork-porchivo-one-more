import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Package,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Inbox,
  ChevronRight,
  MapPin,
  Hash,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { StaffIntakeLockoutNotice } from '@/components/BillingGraceBanner';
import { supabase } from '@/lib/supabase';
import {
  PackageBoardItem,
  PackageLogStatus,
  PKG_STATUS_LABELS,
  packageBoardRowToItem,
  carrierMeta,
} from '@/types/organization';

// ─── Status filter config ─────────────────────────────────────────────────────

type FilterKey = 'all' | PackageLogStatus;

interface FilterTab {
  key: FilterKey;
  label: string;
  rpcValue: string | null;
  icon: React.ReactNode;
  accentFn: (colors: ReturnType<typeof useColors>) => string;
}

function buildFilters(Colors: ReturnType<typeof useColors>): FilterTab[] {
  return [
    {
      key: 'all',
      label: 'All',
      rpcValue: null,
      icon: <Package size={13} color={Colors.primary} />,
      accentFn: (c) => c.primary,
    },
    {
      key: 'received',
      label: 'Received',
      rpcValue: 'received',
      icon: <Inbox size={13} color={Colors.secondary} />,
      accentFn: (c) => c.secondary,
    },
    {
      key: 'ready_for_pickup',
      label: 'Ready',
      rpcValue: 'ready_for_pickup',
      icon: <Clock size={13} color={Colors.gold} />,
      accentFn: (c) => c.gold,
    },
    {
      key: 'picked_up',
      label: 'Picked Up',
      rpcValue: 'picked_up',
      icon: <CheckCircle size={13} color={Colors.success} />,
      accentFn: (c) => c.success,
    },
    {
      key: 'exception',
      label: 'Exception',
      rpcValue: 'exception',
      icon: <AlertTriangle size={13} color={Colors.danger} />,
      accentFn: (c) => c.danger,
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBorderColor(
  status: PackageLogStatus,
  Colors: ReturnType<typeof useColors>
): string {
  switch (status) {
    case 'received':           return Colors.secondary;
    case 'ready_for_pickup':   return Colors.gold;
    case 'picked_up':          return Colors.success;
    case 'exception':          return Colors.danger;
    case 'returned_to_sender': return Colors.slateLighter;
    default:                   return Colors.border;
  }
}

function statusBadgeColors(
  status: PackageLogStatus,
  Colors: ReturnType<typeof useColors>
): { bg: string; text: string } {
  switch (status) {
    case 'received':           return { bg: Colors.secondary + '20', text: Colors.secondary };
    case 'ready_for_pickup':   return { bg: Colors.gold + '20',      text: Colors.gold };
    case 'picked_up':          return { bg: Colors.success + '20',   text: Colors.success };
    case 'exception':          return { bg: Colors.danger + '20',    text: Colors.danger };
    case 'returned_to_sender': return { bg: Colors.slateLighter + '20', text: Colors.slateLighter };
    default:                   return { bg: Colors.border, text: Colors.slateLight };
  }
}

// ─── Status action options ────────────────────────────────────────────────────

function nextStatusOptions(current: PackageLogStatus): PackageLogStatus[] {
  switch (current) {
    case 'received':           return ['ready_for_pickup', 'exception'];
    case 'ready_for_pickup':   return ['picked_up', 'exception'];
    case 'picked_up':          return ['returned_to_sender'];
    case 'exception':          return ['received', 'returned_to_sender'];
    case 'returned_to_sender': return [];
    default:                   return [];
  }
}

const STATUS_ACTION_LABELS: Partial<Record<PackageLogStatus, string>> = {
  ready_for_pickup: 'Mark Ready',
  picked_up:        'Mark Picked Up',
  returned_to_sender: 'Mark Returned',
  exception:        'Flag Exception',
  received:         'Re-receive',
};

// ─── Package Card ─────────────────────────────────────────────────────────────

function PackageCard({
  item,
  index,
  onStatusChange,
  isUpdating,
}: {
  item: PackageBoardItem;
  index: number;
  onStatusChange: (id: string, status: PackageLogStatus) => void;
  isUpdating: boolean;
}) {
  const Colors = useColors();
  const [expanded, setExpanded] = useState<boolean>(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay: index * 45,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }, [entranceAnim, index]);

  const toggleExpand = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 60, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    const toValue = expanded ? 0 : 1;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
    setExpanded((prev) => !prev);
  }, [expanded, scaleAnim, slideAnim]);

  const meta = carrierMeta(item.carrier);
  const borderColor = statusBorderColor(item.status, Colors);
  const badge = statusBadgeColors(item.status, Colors);
  const actions = nextStatusOptions(item.status);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: Colors.border,
          borderLeftColor: borderColor,
          transform: [
            { scale: scaleAnim },
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
          opacity: entranceAnim,
        },
      ]}
    >
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
        {/* Top row */}
        <View style={styles.cardTop}>
          {/* Carrier badge */}
          <View style={[styles.carrierBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
            <Text style={[styles.carrierAbbrev, { color: meta.color }]}>{meta.abbrev}</Text>
          </View>

          <View style={styles.cardMain}>
            {/* Unit + status row */}
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardUnit, { color: Colors.slate }]}>
                {item.unitNumber ? `Unit ${item.unitNumber}` : 'Unassigned'}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {PKG_STATUS_LABELS[item.status]}
                </Text>
              </View>
            </View>

            {/* Carrier + time */}
            <View style={styles.cardMeta}>
              <Text style={[styles.cardCarrier, { color: Colors.slateLight }]}>{meta.label}</Text>
              <Text style={[styles.cardDot, { color: Colors.slateLighter }]}>·</Text>
              <Text style={[styles.cardTime, { color: Colors.slateLighter }]}>
                {timeAgo(item.receivedAt)}
              </Text>
            </View>

            {/* Description if present */}
            {item.description ? (
              <Text style={[styles.cardDesc, { color: Colors.slateLighter }]} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>

          <ChevronRight
            size={16}
            color={Colors.slateLighter}
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded ? (
        <View style={[styles.expandedSection, { borderTopColor: Colors.border }]}>
          {/* Detail rows */}
          {item.trackingNumber ? (
            <View style={styles.detailRow}>
              <Hash size={13} color={Colors.slateLighter} />
              <Text style={[styles.detailText, { color: Colors.slateLight }]} numberOfLines={1}>
                {item.trackingNumber}
              </Text>
            </View>
          ) : null}
          {item.locationInOffice ? (
            <View style={styles.detailRow}>
              <MapPin size={13} color={Colors.slateLighter} />
              <Text style={[styles.detailText, { color: Colors.slateLight }]}>
                {item.locationInOffice}
              </Text>
            </View>
          ) : null}
          {item.exceptionReason ? (
            <View style={[styles.exceptionBanner, { backgroundColor: Colors.danger + '12', borderColor: Colors.danger + '30' }]}>
              <AlertTriangle size={13} color={Colors.danger} />
              <Text style={[styles.exceptionText, { color: Colors.danger }]}>{item.exceptionReason}</Text>
            </View>
          ) : null}
          {item.notes && !item.exceptionReason ? (
            <Text style={[styles.notesText, { color: Colors.slateLight }]}>{item.notes}</Text>
          ) : null}

          {/* Logged by */}
          <Text style={[styles.loggedBy, { color: Colors.slateLighter }]}>
            Logged by {item.loggedByName}
          </Text>

          {/* Action buttons */}
          {actions.length > 0 && !isUpdating ? (
            <View style={styles.actionRow}>
              {actions.map((nextStatus) => {
                const isDestructive = nextStatus === 'exception' || nextStatus === 'returned_to_sender';
                const actionColor = isDestructive ? Colors.danger : Colors.primary;
                return (
                  <TouchableOpacity
                    key={nextStatus}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: actionColor + '14',
                        borderColor: actionColor + '40',
                        flex: actions.length > 1 ? 1 : undefined,
                      },
                    ]}
                    onPress={() => onStatusChange(item.id, nextStatus)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.actionBtnText, { color: actionColor }]}>
                      {STATUS_ACTION_LABELS[nextStatus] ?? PKG_STATUS_LABELS[nextStatus]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : isUpdating ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Filter Tab ───────────────────────────────────────────────────────────────

function FilterTabItem({
  tab,
  isActive,
  count,
  onPress,
}: {
  tab: FilterTab;
  isActive: boolean;
  count: number | undefined;
  onPress: () => void;
}) {
  const Colors = useColors();
  const accent = tab.accentFn(Colors);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 60, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={[
          styles.filterTab,
          {
            backgroundColor: isActive ? accent + '18' : Colors.surface,
            borderColor: isActive ? accent + '55' : Colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {tab.icon}
        <Text style={[styles.filterTabText, { color: isActive ? accent : Colors.slateLight }]}>
          {tab.label}
        </Text>
        {count !== undefined && count > 0 ? (
          <View style={[styles.filterCount, { backgroundColor: accent }]}>
            <Text style={styles.filterCountText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterKey }) {
  const Colors = useColors();
  const bounceAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 1200, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  const message =
    filter === 'all'
      ? 'No packages logged yet'
      : filter === 'exception'
      ? 'No exceptions — all clear'
      : filter === 'picked_up'
      ? 'No pickups recorded yet'
      : `No packages in "${PKG_STATUS_LABELS[filter as PackageLogStatus]}"`;

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        {filter === 'exception' ? (
          <CheckCircle size={48} color={Colors.success} strokeWidth={1.5} />
        ) : (
          <Package size={48} color={Colors.slateLighter} strokeWidth={1.5} />
        )}
      </Animated.View>
      <Text style={[styles.emptyText, { color: Colors.slateLight }]}>{message}</Text>
      {filter === 'all' ? (
        <Text style={[styles.emptyHint, { color: Colors.slateLighter }]}>
          Tap the + button to log your first package
        </Text>
      ) : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PackageOpsBoardScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgStaff, updatePackageStatus, isUpdatingPackageStatus } = useOrganization();
  // Billing grace period — staff status updates lock ONLY at stage 3 (day 30+).
  // Intentionally NOT gated during stages 1-2 (see useSubscriptionGate.ts):
  // package intake is core value and residents' actual mail, so it stays live
  // through the entire 30-day window regardless of billing state.
  const { isStaffIntakeLocked } = useSubscriptionGate();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filters = useMemo(() => buildFilters(Colors), [Colors]);

  // ── Board packages query ──────────────────────────────────────────────────
  const { data: packages = [], isLoading } = useQuery<PackageBoardItem[]>({
    queryKey: ['org-package-board', activeOrg?.id, activeFilter],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_packages_board', {
        p_org_id: activeOrg.id,
        p_status: activeFilter === 'all' ? null : activeFilter,
        p_limit: 60,
        p_offset: 0,
      });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(packageBoardRowToItem);
    },
    enabled: !!activeOrg?.id && isOrgStaff,
    staleTime: 1000 * 30,
  });

  // ── Per-status counts ─────────────────────────────────────────────────────
  const { data: counts = [] } = useQuery<{ status: string; count: number }[]>({
    queryKey: ['org-package-board-counts', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_package_board_counts', {
        p_org_id: activeOrg.id,
      });
      if (error) return [];
      return (data ?? []) as { status: string; count: number }[];
    },
    enabled: !!activeOrg?.id && isOrgStaff,
    staleTime: 1000 * 30,
  });

  const countMap = useMemo<Partial<Record<FilterKey, number>>>(() => {
    const map: Partial<Record<FilterKey, number>> = {};
    let total = 0;
    for (const row of counts) {
      map[row.status as FilterKey] = row.count;
      total += row.count;
    }
    map['all'] = total;
    return map;
  }, [counts]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-package-board', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-package-board-counts', activeOrg?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  // ── Status update ─────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (packageId: string, newStatus: PackageLogStatus) => {
      // Billing grace stage 3 (day 30+): the ONLY point where staff intake stops
      if (isStaffIntakeLocked) return;
      if (newStatus === 'exception') {
        Alert.prompt(
          'Flag Exception',
          'Describe the issue with this package:',
          async (reason) => {
            setUpdatingId(packageId);
            try {
              await updatePackageStatus({ packageId, newStatus, exceptionReason: reason ?? null });
            } catch {
              Alert.alert('Error', 'Could not update package status.');
            } finally {
              setUpdatingId(null);
            }
          },
          'plain-text',
          '',
          'default'
        );
        return;
      }

      const actionLabel = STATUS_ACTION_LABELS[newStatus] ?? PKG_STATUS_LABELS[newStatus];
      Alert.alert(actionLabel, 'Update this package status?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingId(packageId);
            try {
              await updatePackageStatus({ packageId, newStatus });
            } catch {
              Alert.alert('Error', 'Could not update package status.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]);
    },
    [updatePackageStatus, isStaffIntakeLocked]
  );

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const exceptionCount = countMap['exception'] ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Package Board</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name}
          </Text>
        </View>

        {/* Exception pulse badge */}
        {exceptionCount > 0 ? (
          <View style={[styles.exceptionPill, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '40' }]}>
            <AlertTriangle size={12} color={Colors.danger} />
            <Text style={[styles.exceptionPillText, { color: Colors.danger }]}>{exceptionCount}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={[styles.filtersWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
      >
        {filters.map((tab) => (
          <FilterTabItem
            key={tab.key}
            tab={tab}
            isActive={activeFilter === tab.key}
            count={countMap[tab.key]}
            onPress={() => setActiveFilter(tab.key)}
          />
        ))}
      </ScrollView>

      {/* ── Package list ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.slateLighter }]}>Loading packages…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {/* ── Billing grace — staff lockout notice (stage 3 ONLY) ────────── */}
          <StaffIntakeLockoutNotice />

          {packages.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            packages.map((pkg, i) => (
              <PackageCard
                key={pkg.id}
                item={pkg}
                index={i}
                onStatusChange={handleStatusChange}
                isUpdating={updatingId === pkg.id && isUpdatingPackageStatus}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── FAB: Log Package ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 24,
            backgroundColor: Colors.primary,
            shadowColor: Colors.primary,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push('/log-package')}
          style={styles.fabInner}
          activeOpacity={0.85}
          disabled={isStaffIntakeLocked}
        >
          <Plus size={22} color="#fff" strokeWidth={2.5} />
          <Text style={styles.fabLabel}>Log Package</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },

  exceptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  exceptionPillText: { fontSize: 12, fontWeight: '700' as const },

  filtersWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontWeight: '600' as const },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, fontWeight: '800' as const, color: '#fff' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  list: { paddingHorizontal: 16, paddingTop: 14 },

  // ── Package card ──────────────────────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  carrierBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierAbbrev: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.3 },
  cardMain: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardUnit: { fontSize: 15, fontWeight: '700' as const },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' as const },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  cardCarrier: { fontSize: 12 },
  cardDot: { fontSize: 12 },
  cardTime: { fontSize: 12 },
  cardDesc: { fontSize: 12, marginTop: 3, fontStyle: 'italic' },

  // ── Expanded section ──────────────────────────────────────────────────────
  expandedSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailText: { fontSize: 12, flex: 1 },
  exceptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  exceptionText: { fontSize: 12, flex: 1, fontWeight: '600' as const },
  notesText: { fontSize: 12, fontStyle: 'italic', marginBottom: 6, lineHeight: 17 },
  loggedBy: { fontSize: 11, marginBottom: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' as const },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 14,
  },
  emptyText: { fontSize: 16, fontWeight: '600' as const },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
  },
  fabLabel: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
});
