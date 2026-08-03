import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { log, warn } from "./logger";

// expo-notifications has limited web support — setting a handler or attaching
// listeners on web produces warnings and has no effect. All web paths no-op.
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    log('[Notifications] Failed to set notification handler:', e);
  }
}

/** Masks a push token for logging — never log full tokens (device-spam vector). */
function maskToken(token: string): string {
  return token.length > 10 ? `\u2026${token.slice(-8)}` : '\u2026';
}

export async function registerForPushNotifications(): Promise<string | null> {
  log('[Notifications] Registering for push notifications...');

  if (Platform.OS === 'web') {
    log('[Notifications] Web platform — skipping push token registration');
    return null;
  }

  if (!Device.isDevice) {
    log('[Notifications] Not a physical device — push notifications require a real device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  log('[Notifications] Existing permission status:', existingStatus);

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    log('[Notifications] Requested permission, new status:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    log('[Notifications] Permission not granted');
    return null;
  }

  try {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? 'itw0s622ahx9uel9v4pjt';
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    log('[Notifications] Got push token:', maskToken(token));

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2D6A4F',
      });
      log('[Notifications] Android notification channel set');
    }

    return token;
  } catch (error) {
    log('[Notifications] Error getting push token:', error);
    return null;
  }
}

export async function savePushTokenToSupabase(userId: string, token: string): Promise<void> {
  log('[Notifications] Saving push token to Supabase for user:', userId);
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);

  if (error) {
    log('[Notifications] Error saving push token:', error.message);
  } else {
    log('[Notifications] Push token saved successfully');
  }
}

/**
 * SECURITY: This function is DISABLED on the client.
 *
 * Sending push notifications directly from the client to the Expo Push API
 * is a critical security vulnerability:
 *   1. Push tokens for all users are stored in `profiles` table.
 *   2. Any authenticated user can read all push tokens (if RLS allows it).
 *   3. Any user who can call this function can spam any other user.
 *
 * Push notifications MUST only be dispatched from:
 *   - Supabase Edge Functions (server-side, with auth verification)
 *   - Database triggers (`supabase/push-notification-trigger.sql`)
 *
 * If you need to trigger a notification from the client, call the
 * create_notification security-definer RPC, which verifies both the
 * caller and recipient are shipment participants before inserting.
 * The DB insert fires the on_notification_created pg_net trigger for push.
 *
 * Example:
 *   const { error } = await supabase.rpc('create_notification', {
 *     p_shipment_id: shipmentId,
 *     p_type: 'partner_pickup_alert',
 *     p_title: 'Time to pick up!',
 *     p_message: 'Package delivered to porch.',
 *     p_recipient_id: partnerId,
 *     p_recipient_role: 'partner',
 *   });
 */
export async function sendPushNotification(
  _expoPushToken: string,
  _title: string,
  _body: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  if (__DEV__) {
    warn(
      '[Notifications] sendPushNotification() is disabled on the client for security reasons. ' +
      'Use a Supabase Edge Function to dispatch push notifications server-side.',
    );
  }
  // No-op: push dispatch must happen server-side only.
}

const noopSubscription = { remove: () => {} };

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): { remove: () => void } {
  if (isWeb) return noopSubscription;
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): { remove: () => void } {
  if (isWeb) return noopSubscription;
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds: number = 1,
): Promise<string> {
  if (isWeb) return '';
  log('[Notifications] Scheduling local notification:', title);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
  log('[Notifications] Scheduled notification id:', id);
  return id;
}
