import React, { useRef, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Plus, Package, ChevronRight, PackageCheck, Clock3, LayoutGrid, Search, X, Filter, AlertTriangle } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { palette, radius, space, elevation, tabularNums } from '@/constants/theme';
import { usePackages } from '@/store/PackagesContext';
import { TrackedPackage, PackageTrackingStatus } from '@/types';
import CarrierIcon from '@/components/CarrierIcon';
import { ListSkeleton } from '@/components/SkeletonLoader';
import { useQueryClient } from '@tanstack/react-query';
import StatusPill from '@/components/ui/StatusPill';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { log } from "@/lib/logger";

export type PackageFilter = 'all' | 'pending' | 'delivered';

const DELIVERED_STATUSES: PackageTrackingStatus[] = ['delivered', 'picked_up', 'returned'];

function isDelivered(pkg: TrackedPackage): boolean {
  return DELIVERED_STATUSES.includes(pkg.currentStatus);
}

function isPending(pkg: TrackedPackage): boolean {
  return !DELIVERED_STATUSES.includes(pkg.currentStatus);
}

function formatDeliveryDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Whole-day difference between an estimated delivery date and today.
 * Positive = days remaining, 0 = arrives today, negative = overdue.
 */
function getDaysRemaining(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ms = startOfDay(date).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Human-readable days-remaining label for a pending package.
 * Returns null when the date is missing or invalid.
 */
function getDaysRemainingLabel(dateStr: string): { text: string; tone: 'success' | 'accent' | 'neutral' | 'danger' } | null {
  if (!dateStr) return null;
  const days = getDaysRemaining(dateStr);
  if (Number.isNaN(days)) return null;
  if (days === 0) return { text: 'Arriving today', tone: 'accent' };
  if (days === 1) return { text: '1 day remaining', tone: 'success' };
  if (days > 1) {
    if (days <= 2) return { text: `${days} days remaining`, tone: 'success' };
    return { text: `${days} days remaining`, tone: 'neutral' };
  }
  if (days === -1) return { text: '1 day overdue', tone: 'danger' };
  return { text: `${Math.abs(days)} days overdue`, tone: 'danger' };
}

/**
 * Format a package's arrival timestamp as a specific date + time string.
 * Shown underneath each card to give visibility into delivery history.
 */
function formatArrivalDateTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`;
}

function PackageCard({ pkg, onPress }: { pkg: TrackedPackage; onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID={`package-card-${pkg.id}`}
      >
        <View style={styles.cardTop}>
          <CarrierIcon carrier={pkg.carrier} size={42} />
          <View style={styles.cardInfo}>
            <Text style={styles.packageName} numberOfLines={1}>{pkg.name}</Text>
            <Text style={[styles.carrierLabel, tabularNums]}>{pkg.carrier} · #{pkg.trackingNumber.slice(-8)}</Text>
          </View>
          <StatusPill status={pkg.currentStatus} hasTracking size="sm" />
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryLabel}>
              {pkg.deliveredTimestamp ? 'Arrived' : 'Expected'}
            </Text>
            <Text style={styles.deliveryDate}>{formatDeliveryDate(pkg.expectedDeliveryDate)}</Text>
            {!pkg.deliveredTimestamp && (() => {
              const label = getDaysRemainingLabel(pkg.expectedDeliveryDate);
              if (!label) return null;
              const toneColor =
                label.tone === 'danger' ? colors.danger :
                label.tone === 'success' ? colors.success :
                label.tone === 'accent' ? colors.primary :
                colors.slateLight;
              return (
                <View style={styles.daysRemainingRow}>
                  {label.tone === 'danger' ? (
                    <AlertTriangle size={11} color={toneColor} strokeWidth={2.2} />
                  ) : null}
                  <Text style={[styles.daysRemainingText, { color: toneColor }]} numberOfLines={1}>
                    {label.text}
                  </Text>
                </View>
              );
            })()}
          </View>
          <View style={styles.addressBadge}>
            <Text style={styles.addressText}>
              {pkg.addressNickname === 'Other' && pkg.customAddressLabel ? pkg.customAddressLabel : pkg.addressNickname}
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <ChevronRight size={18} color={colors.slateLighter} />
          </View>
        </View>

        {pkg.deliveredTimestamp ? (
          <Text style={styles.arrivalTimestamp} numberOfLines={1}>
            {formatArrivalDateTime(pkg.deliveredTimestamp)}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const MemoizedPackageCard = React.memo(PackageCard);

export default function PackagesScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { packages, isLoading } = usePackages();
  const queryClient = useQueryClient();
  const fabScale = useRef(new Animated.Value(1)).current;
  const [filter, setFilter] = useState<PackageFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const counts = useMemo(() => {
    let delivered = 0;
    let pending = 0;
    for (const p of packages) {
      if (isDelivered(p)) delivered += 1;
      else pending += 1;
    }
    return { all: packages.length, pending, delivered };
  }, [packages]);

  const filteredPackages = useMemo(() => {
    const byStatus = (() => {
      switch (filter) {
        case 'delivered':
          return packages.filter(isDelivered);
        case 'pending':
          return packages.filter(isPending);
        default:
          return packages;
      }
    })();

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;

    // Search by recipient (package name), carrier, tracking number, or address.
    return byStatus.filter((p) => {
      const recipient = p.name.toLowerCase();
      const carrier = p.carrier.toLowerCase();
      const tracking = p.trackingNumber.toLowerCase();
      const address = (p.addressNickname === 'Other' && p.customAddressLabel
        ? p.customAddressLabel
        : p.addressNickname).toLowerCase();
      return (
        recipient.includes(q) ||
        carrier.includes(q) ||
        tracking.includes(q) ||
        address.includes(q)
      );
    });
  }, [packages, filter, searchQuery]);

  const filterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All' },
      { value: 'pending' as const, label: 'Pending' },
      { value: 'delivered' as const, label: 'Delivered' },
    ],
    [],
  );

  const handleFabPressIn = () => {
    Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };
  const handleFabPressOut = () => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };

  const renderItem = useCallback(({ item }: { item: TrackedPackage }) => (
    <MemoizedPackageCard
      pkg={item}
      onPress={() => router.push({ pathname: '/package-detail' as any, params: { id: item.id } })}
    />
  ), [router]);

  const renderFilterEmpty = useCallback(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const config = hasSearch
      ? {
          icon: <Search size={36} color={colors.primary} strokeWidth={1.6} />,
          title: 'No matching packages',
          body: `No packages match "${searchQuery.trim()}". Try a different recipient, carrier, or tracking number.`,
        }
      : filter === 'delivered'
        ? {
            icon: <PackageCheck size={36} color={colors.primary} strokeWidth={1.6} />,
            title: 'No delivered packages',
            body: 'Delivered and picked-up packages will appear here.',
          }
        : filter === 'pending'
          ? {
              icon: <Clock3 size={36} color={colors.primary} strokeWidth={1.6} />,
              title: 'Nothing pending',
              body: 'Packages on the way or awaiting pickup will show up here.',
            }
          : {
              icon: <LayoutGrid size={36} color={colors.primary} strokeWidth={1.6} />,
              title: 'No packages in this view',
              body: 'Try a different filter or add a new package.',
            };
    return (
      <View style={styles.filterEmptyWrap}>
        <View style={styles.filterEmptyIconWrap}>
          {config.icon}
        </View>
        <Text style={styles.filterEmptyTitle}>{config.title}</Text>
        <Text style={styles.filterEmptyBody}>{config.body}</Text>
      </View>
    );
  }, [filter, colors, searchQuery]);

  const keyExtractor = useCallback((item: TrackedPackage) => item.id, []);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['tracked_packages'] });
    } catch (e) {
      log('[Packages] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'My Packages' }} />
        <View style={styles.filterBarWrap}>
          <SegmentedControl<PackageFilter>
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            testID="packages-filter"
          />
        </View>
        <ListSkeleton count={3} type="package" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Packages' }} />

      <View style={styles.filterBarWrap}>
        <SegmentedControl<PackageFilter>
          options={filterOptions}
          value={filter}
          counts={counts}
          onChange={setFilter}
          testID="packages-filter"
        />
      </View>

      {packages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Package size={36} color={colors.primary} strokeWidth={1.6} />}
            title="No packages yet"
            body="Start tracking your deliveries to keep them safe."
            ctaLabel="Add your first package"
            onCta={() => router.push('/add-package' as any)}
            tone="sky"
          />
        </View>
      ) : (
        <>
          <View style={styles.searchBarWrap}>
            <View style={[styles.searchBar, searchQuery.length > 0 && styles.searchBarActive]}>
              <Search size={16} color={searchQuery.length > 0 ? colors.primary : colors.slateLighter} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by recipient, carrier, or tracking #"
                placeholderTextColor={colors.slateLighter}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                testID="packages-search-input"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID="packages-search-clear"
                >
                  <X size={16} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {(filter !== 'all' || searchQuery.length > 0) && (
              <View style={styles.activeFilterRow} pointerEvents="none">
                <Filter size={11} color={colors.primary} strokeWidth={2.4} />
                <Text style={styles.activeFilterText} numberOfLines={1}>
                  {filter !== 'all' && searchQuery.length > 0
                    ? `${filter[0].toUpperCase() + filter.slice(1)} · “${searchQuery.trim()}”`
                    : filter !== 'all'
                      ? `${filter[0].toUpperCase() + filter.slice(1)} packages`
                      : `Search: “${searchQuery.trim()}”`}
                </Text>
              </View>
            )}
          </View>

          <FlatList
            data={filteredPackages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderFilterEmpty}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          />
        </>
      )}

      <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-package' as any)}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
          activeOpacity={1}
          testID="add-package-fab"
        >
          <Plus size={26} color={colors.white} strokeWidth={2.5} />
          <Text style={styles.fabLabel}>Add Package</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    filterBarWrap: {
      paddingHorizontal: space.lg,
      paddingTop: 6,
      paddingBottom: 10,
    },
    searchBarWrap: {
      paddingHorizontal: space.lg,
      paddingBottom: 6,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchBarActive: {
      borderColor: colors.primary,
      backgroundColor: colors.skyBlue,
    },
    activeFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    activeFilterText: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.primary,
      letterSpacing: 0.1,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.slate,
      paddingVertical: 0,
    },
    arrivalTimestamp: {
      fontSize: 12,
      color: colors.slateLight,
      fontWeight: '500' as const,
      marginTop: 8,
      paddingLeft: 1,
    },
    daysRemainingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    daysRemainingText: {
      fontSize: 12,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
    },
    filterEmptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: 40,
    },
    filterEmptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    filterEmptyTitle: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: colors.slate,
      marginBottom: 6,
    },
    filterEmptyBody: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingTop: 12,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      marginHorizontal: space.lg,
      marginBottom: space.md,
      padding: space.lg,
      ...elevation.low,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardInfo: {
      flex: 1,
    },
    packageName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 2,
    },
    carrierLabel: {
      fontSize: 13,
      color: colors.slateLight,
      fontWeight: '500' as const,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 0.2,
    },
    cardDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    deliveryInfo: {
      flex: 1,
    },
    deliveryLabel: {
      fontSize: 11,
      color: colors.slateLighter,
      fontWeight: '500' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    deliveryDate: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.slate,
      marginTop: 1,
    },
    addressBadge: {
      backgroundColor: colors.skyBlue,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 8,
    },
    addressText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    chevronWrap: {
      padding: 2,
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
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 24,
      marginTop: 20,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
    emptyButtonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '600' as const,
    },
    fabWrap: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      left: 20,
    },
    fab: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    fabLabel: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700' as const,
    },
  });
}
