import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { NotificationType } from '@/types';
import { DbNotification } from '@/types/database';
import { dbNotificationToNotification } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import {
  registerForPushNotifications,
  savePushTokenToSupabase,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  setBadgeCount,
} from '@/lib/notifications';
import { router } from 'expo-router';
import { useApp } from '@/store/AppContext';
import { log } from "../lib/logger";

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const { session, user, isOnboarded } = useApp();
  const queryClient = useQueryClient();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListenerRef = useRef<ReturnType<typeof addNotificationReceivedListener> | null>(null);
  const responseListenerRef = useRef<ReturnType<typeof addNotificationResponseListener> | null>(null);

  useEffect(() => {
    if (!session?.user?.id || !isOnboarded) return;

    log('[NotificationsContext] Registering for push notifications...');
    void registerForPushNotifications().then((token) => {
      if (token) {
        log('[NotificationsContext] Push token obtained (masked):', `\u2026${token.slice(-8)}`);
        setExpoPushToken(token);
        void savePushTokenToSupabase(session.user.id, token);
      }
    });

    notificationListenerRef.current = addNotificationReceivedListener((notification) => {
      log('[NotificationsContext] Notification received:', notification.request.content.title);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    responseListenerRef.current = addNotificationResponseListener((response) => {
      log('[NotificationsContext] Notification tapped:', response.notification.request.content.data);
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      // Staff ticket AI-draft push → deep-link into the staff support queue,
      // passing the ticket id so the queue can auto-open that ticket's review modal.
      if (data?.ticketId && data?.type === 'staff_ticket_ai_draft') {
        router.push({
          pathname: '/staff-support-queue' as any,
          params: { ticketId: String(data.ticketId) },
        });
        return;
      }
      if (data?.shipmentId) {
        router.push({ pathname: '/shipment-detail' as any, params: { id: data.shipmentId as string } });
      }
    });

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
    };
  }, [session?.user?.id, isOnboarded, queryClient]);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      log('[NotificationsContext] Fetching notifications from Supabase...');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        log('[NotificationsContext] Notifications fetch error:', error.message);
        throw error;
      }
      log('[NotificationsContext] Fetched', data?.length ?? 0, 'notifications');
      return (data as DbNotification[]).map(dbNotificationToNotification);
    },
    enabled: !!session?.user?.id,
  });

  const notifications = notificationsQuery.data ?? [];
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  /**
   * Creates a DB notification record via the create_notification security-definer
   * RPC. The RPC verifies both caller and recipient are shipment participants.
   * The DB insert fires the on_notification_created pg_net trigger, which sends
   * the Expo push notification — no edge function round-trip needed.
   */
  const createNotification = useCallback(async (
    shipmentId: string,
    type: NotificationType,
    title: string,
    message: string,
    recipientId: string,
    recipientRole: 'homeowner' | 'partner',
  ) => {
    log('[NotificationsContext] Creating notification via RPC:', type, 'for', recipientRole);
    try {
      const { error } = await supabase.rpc('create_notification', {
        p_shipment_id: shipmentId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_recipient_id: recipientId,
        p_recipient_role: recipientRole,
      });
      if (error) {
        log('[NotificationsContext] create_notification RPC error:', error.message);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    } catch (err) {
      log('[NotificationsContext] create_notification error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const markNotificationRead = useCallback((notificationId: string) => {
    log('[NotificationsContext] Marking notification read:', notificationId);
    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .then(({ error }) => {
        if (error) log('[NotificationsContext] Mark read error:', error.message);
        else void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
  }, [queryClient]);

  const markAllNotificationsRead = useCallback(() => {
    if (!session?.user?.id) return;
    log('[NotificationsContext] Marking all notifications read');
    void supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', session.user.id)
      .eq('read', false)
      .then(({ error }) => {
        if (error) log('[NotificationsContext] Mark all read error:', error.message);
        else void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
  }, [session?.user?.id, queryClient]);

  const myNotifications = useMemo(() =>
    notificationsRef.current.filter(n => n.recipientId === user?.id).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, user?.id]
  );

  const unreadNotificationCount = useMemo(() => {
    return notificationsRef.current.filter(n => !n.read && n.recipientId === user?.id).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, user?.id]);

  useEffect(() => {
    setBadgeCount(unreadNotificationCount).catch(() => {});
  }, [unreadNotificationCount]);

  return useMemo(() => ({
    notifications: myNotifications,
    unreadNotificationCount,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    expoPushToken,
  }), [
    myNotifications,
    unreadNotificationCount,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    expoPushToken,
  ]);
});
