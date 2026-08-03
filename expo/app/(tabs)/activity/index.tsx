import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Check, Heart, Bell, Truck, PackageCheck, CheckCheck, Plus } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { useNotifications } from '@/store/NotificationsContext';
import ShipmentCard from '@/components/ShipmentCard';

import { Shipment, DeliveryNotification } from '@/types';

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ActivityScreen() {
  const router = useRouter();
  const { user, isPartner } = useApp();
  const { activeShipments, completedShipments } = useShipments();
  const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback((shipment: Shipment) => {
    router.push({ pathname: '/shipment-detail' as any, params: { id: shipment.id } });
  }, [router]);

  const handleComplete = useCallback((shipment: Shipment) => {
    router.push({ pathname: '/shipment-detail' as any, params: { id: shipment.id } });
  }, [router]);

  const recentNotifications = useMemo(() => notifications.slice(0, 10), [notifications]);

  const handleNotifPress = useCallback((notif: DeliveryNotification) => {
    markNotificationRead(notif.id);
    router.push({ pathname: '/shipment-detail' as any, params: { id: notif.shipmentId } });
  }, [markNotificationRead, router]);

  const sections = [
    { title: 'In Progress', data: activeShipments },
    { title: 'Completed', data: completedShipments },
  ].filter(s => s.data.length > 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Activity',
      }} />
      {recentNotifications.length > 0 && (
        <View style={styles.notifSection}>
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderLeft}>
              <Bell size={16} color={colors.primary} />
              {unreadNotificationCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadNotificationCount}</Text>
                </View>
              )}
            </View>
            {unreadNotificationCount > 0 && (
              <TouchableOpacity onPress={markAllNotificationsRead} activeOpacity={0.7}>
                <Text style={styles.markAllRead}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal={false} style={styles.notifList}>
            {recentNotifications.map((notif) => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                onPress={() => handleNotifPress(notif)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.notifIconWrap,
                  { backgroundColor: notif.type === 'package_delivered' || notif.type === 'partner_pickup_alert'
                    ? colors.success + '18'
                    : notif.type === 'tracking_added'
                    ? colors.skyBlue
                    : colors.peach
                  },
                ]}>
                  {notif.type === 'package_delivered' ? (
                    <PackageCheck size={16} color={colors.success} />
                  ) : notif.type === 'partner_pickup_alert' ? (
                    <Bell size={16} color={colors.success} />
                  ) : notif.type === 'tracking_added' ? (
                    <Truck size={16} color={colors.primary} />
                  ) : (
                    <CheckCheck size={16} color={colors.secondary} />
                  )}
                </View>
                <View style={styles.notifBody}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                  <Text style={styles.notifTimestamp}>{formatNotifTime(notif.createdAt)}</Text>
                </View>
                {!notif.read && <View style={styles.notifDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View>
            <ShipmentCard
              shipment={item}
              onPress={() => handlePress(item)}
              variant={item.homeownerId === user?.id ? 'homeowner' : 'partner'}
            />
            {item.status === 'accepted' && item.partnerId === user?.id && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleComplete(item)}
                  activeOpacity={0.85}
                >
                  <Check size={16} color={colors.white} />
                  <Text style={styles.completeButtonText}>Mark as Completed</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.status === 'completed' && item.homeownerId === user?.id && (
              <View style={styles.nudgeCard}>
                <Heart size={16} color={colors.secondary} />
                <Text style={styles.nudgeText}>Thank your Porch Partner for keeping your package safe!</Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Bell size={36} color={colors.slateLighter} />
            </View>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>When you create or accept shipments, your activity will show up here.</Text>
            <TouchableOpacity
              style={styles.emptyCtaButton}
              onPress={() => router.push('/(tabs)/create' as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create a shipment"
            >
              <Plus size={16} color={colors.white} />
              <Text style={styles.emptyCtaText}>Create a Shipment</Text>
            </TouchableOpacity>
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
    listContent: {
      paddingBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.slate,
    },
    sectionCount: {
      fontSize: 13,
      color: colors.slateLight,
      fontWeight: '500' as const,
      backgroundColor: colors.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      overflow: 'hidden',
    },
    actionRow: {
      paddingHorizontal: 16,
      marginTop: -4,
      marginBottom: 12,
    },
    completeButton: {
      backgroundColor: colors.success,
      borderRadius: 10,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    completeButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600' as const,
    },
    nudgeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.peach,
      marginHorizontal: 16,
      marginTop: -4,
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
    },
    nudgeText: {
      fontSize: 13,
      color: colors.secondary,
      fontWeight: '500' as const,
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    emptyCtaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 20,
    },
    emptyCtaText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '600' as const,
    },
    notifSection: {
      marginBottom: 4,
    },
    notifHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 10,
    },
    notifHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    notifHeaderTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.slate,
    },
    unreadBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: 'center',
    },
    unreadBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: colors.white,
    },
    markAllRead: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500' as const,
    },
    notifList: {
      paddingHorizontal: 16,
    },
    notifCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    notifCardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: colors.secondary,
    },
    notifIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    notifBody: {
      flex: 1,
    },
    notifTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 2,
    },
    notifMessage: {
      fontSize: 13,
      color: colors.slateLight,
      lineHeight: 18,
      marginBottom: 4,
    },
    notifTimestamp: {
      fontSize: 11,
      color: colors.slateLighter,
    },
    notifDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.secondary,
      marginTop: 6,
    },
  });
}
