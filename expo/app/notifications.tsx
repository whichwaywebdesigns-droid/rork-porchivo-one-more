import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Bell,
  BellOff,
  PackageCheck,
  Truck,
  CheckCheck,
  ChevronRight,
  Inbox,
  Check,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { palette, radius, space, type as typeScale, elevation, tabularNums } from '@/constants/theme';
import { useNotifications } from '@/store/NotificationsContext';
import { DeliveryNotification, NotificationType } from '@/types';
import { log } from "@/lib/logger";

type NotifFilter = 'all' | 'unread';

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNotifConfig(t: NotificationType): { icon: React.ReactNode; bg: string; accent: string; label: string } {
  switch (t) {
    case 'package_delivered':
      return { icon: <PackageCheck size={18} color={palette.sage} />, bg: palette.sageSoft, accent: palette.sage, label: 'Delivered' };
    case 'partner_pickup_alert':
      return { icon: <Bell size={18} color={palette.emberDeep} />, bg: palette.emberSoft, accent: palette.emberDeep, label: 'Pickup Alert' };
    case 'tracking_added':
      return { icon: <Truck size={18} color={palette.navy} />, bg: palette.sky, accent: palette.navy, label: 'Tracking' };
    case 'package_out_for_delivery':
      return { icon: <Truck size={18} color={palette.navy} />, bg: palette.sky, accent: palette.navy, label: 'Out for Delivery' };
    case 'partner_completed':
      return { icon: <CheckCheck size={18} color={palette.sage} />, bg: palette.sageSoft, accent: palette.sage, label: 'Completed' };
    case 'package_picked_up':
      return { icon: <CheckCheck size={18} color={palette.gold} />, bg: palette.goldSoft, accent: palette.gold, label: 'Picked Up' };
    default:
      return { icon: <Bell size={18} color={palette.slate500} />, bg: palette.slate100, accent: palette.slate500, label: 'Notification' };
  }
}

function groupNotificationsByDate(notifications: DeliveryNotification[]): { title: string; data: DeliveryNotification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, DeliveryNotification[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Earlier': [],
  };

  for (const notif of notifications) {
    const d = new Date(notif.createdAt);
    if (d >= today) {
      groups['Today'].push(notif);
    } else if (d >= yesterday) {
      groups['Yesterday'].push(notif);
    } else if (d >= weekAgo) {
      groups['This Week'].push(notif);
    } else {
      groups['Earlier'].push(notif);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([title, data]) => ({ title, data }));
}

const NotificationCard = React.memo(({ notif, onPress, index }: {
  notif: DeliveryNotification;
  onPress: (n: DeliveryNotification) => void;
  index: number;
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const config = getNotifConfig(notif.type);

  useEffect(() => {
    const delay = Math.min(index * 40, 200);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
        onPress={() => onPress(notif)}
        activeOpacity={0.7}
        testID={`notif-card-${notif.id}`}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: config.bg }]}>
          {config.icon}
        </View>
        <View style={styles.notifBody}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
              {notif.title}
            </Text>
            <Text style={styles.notifTime}>{formatNotifTime(notif.createdAt)}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
          <View style={styles.notifFooter}>
            <View style={[styles.typePill, { backgroundColor: config.bg }]}>
              <Text style={[styles.typePillText, { color: config.accent }]}>{config.label}</Text>
            </View>
            {!notif.read && <View style={styles.unreadDot} />}
          </View>
        </View>
        <ChevronRight size={16} color={colors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const [filter, setFilter] = useState<NotifFilter>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, filter]);

  const sections = useMemo(() => groupNotificationsByDate(filtered), [filtered]);
  const flatData = useMemo(() => {
    const result: (DeliveryNotification | { type: 'header'; title: string })[] = [];
    for (const section of sections) {
      result.push({ type: 'header', title: section.title });
      for (const item of section.data) {
        result.push(item);
      }
    }
    return result;
  }, [sections]);

  const handlePress = useCallback((notif: DeliveryNotification) => {
    log('[Notifications] Tapped notification:', notif.id);
    markNotificationRead(notif.id);
    if (notif.shipmentId) {
      router.push({ pathname: '/shipment-detail' as any, params: { id: notif.shipmentId } });
    } else {
      router.push('/alerts' as any);
    }
  }, [markNotificationRead, router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: DeliveryNotification | { type: 'header'; title: string }; index: number }) => {
    if ('type' in item && item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }
    return <NotificationCard notif={item as DeliveryNotification} onPress={handlePress} index={index} />;
  }, [handlePress, styles]);

  const keyExtractor = useCallback((item: DeliveryNotification | { type: 'header'; title: string }, index: number) => {
    if ('type' in item && item.type === 'header') return `header-${item.title}`;
    return (item as DeliveryNotification).id;
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Notifications',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerRight: () => unreadNotificationCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={markAllNotificationsRead}
            activeOpacity={0.7}
            testID="mark-all-read-btn"
          >
            <Check size={14} color={colors.primary} />
            <Text style={styles.markAllBtnText}>Read All</Text>
          </TouchableOpacity>
        ) : null,
      }} />

      <View style={styles.headerArea}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Bell size={18} color={colors.secondary} />
            <View>
              <Text style={styles.summaryValue}>{unreadNotificationCount}</Text>
              <Text style={styles.summaryLabel}>Unread</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Inbox size={18} color={colors.primary} />
            <View>
              <Text style={styles.summaryValue}>{notifications.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'unread'] as NotifFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
              testID={`notif-filter-${f}`}
            >
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
                {f === 'all' ? 'All' : `Unread (${unreadNotificationCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <BellOff size={36} color={colors.slateLighter} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'unread'
                ? 'You have no unread notifications. Nice!'
                : 'When your packages have updates, you\'ll see them here.'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerArea: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    summaryCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.elevated,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.slate,
      ...tabularNums,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.slateLighter,
      fontWeight: '500' as const,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterPill: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.elevated,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slateLight,
    },
    filterPillTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },
    sectionHeader: {
      paddingTop: 16,
      paddingBottom: 8,
      paddingHorizontal: 4,
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.slateLight,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    notifCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: space.md + 2,
      borderRadius: radius.lg,
      marginBottom: 6,
      gap: space.md,
      ...elevation.low,
    },
    notifCardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    notifIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBody: {
      flex: 1,
    },
    notifTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    notifTitle: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.slate,
      flex: 1,
      marginRight: 8,
    },
    notifTitleUnread: {
      fontWeight: '700' as const,
    },
    notifTime: {
      fontSize: 11,
      color: colors.slateLighter,
      fontWeight: '500' as const,
      ...tabularNums,
    },
    notifMessage: {
      fontSize: 13,
      color: colors.slateLight,
      lineHeight: 18,
      marginBottom: 6,
    },
    notifFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    typePillText: {
      fontSize: 10,
      fontWeight: '700' as const,
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.skyBlue,
    },
    markAllBtnText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
  });
}
