/**
 * Porchivo — Notification Preferences
 *
 * User-configurable toggles that control which push notifications are sent.
 * Stored locally in AsyncStorage for instant access and no DB migration needed.
 *
 * The create_notification RPC and the DB delivery_status trigger both check
 * these preferences before dispatching a push — though the DB trigger uses
 * a profiles column (notification_prefs jsonb) for server-side reads.
 *
 * Client-side: ShipmentsContext checks shouldSend() before calling
 * createNotification(), so no DB row is created for muted types.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from './logger';

const PREFS_KEY = 'porchivo_notification_prefs_v1';

/** Sound options for delivery status notifications. */
export type DeliverySound = 'default' | 'chime' | 'silent';

export interface NotificationPreferences {
  /** Out-for-delivery alerts — "your package is on the truck" */
  outForDeliveryAlerts: boolean;
  /** Delivered alerts — "your package arrived at your porch" */
  deliveredAlerts: boolean;
  /** Porch Partner pickup/handoff alerts */
  partnerPickupAlerts: boolean;
  /** Tracking number added alerts (partner notifications) */
  trackingAddedAlerts: boolean;
  /** Neighborhood theft / community alerts */
  communityAlerts: boolean;
  /** Sound played when a delivery status notification fires */
  deliverySound: DeliverySound;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  outForDeliveryAlerts: true,
  deliveredAlerts: true,
  partnerPickupAlerts: true,
  trackingAddedAlerts: true,
  communityAlerts: true,
  deliverySound: 'default',
};

/**
 * Notification types that map to preference toggles.
 * Returns the preference key that gates this notification type,
 * or null if the type is not user-configurable (always sent).
 */
export function typeToPreference(
  type: string,
): keyof Omit<NotificationPreferences, 'deliverySound'> | null {
  switch (type) {
    case 'package_out_for_delivery':
      return 'outForDeliveryAlerts';
    case 'package_delivered':
      return 'deliveredAlerts';
    case 'partner_pickup_alert':
    case 'partner_completed':
    case 'package_picked_up':
      return 'partnerPickupAlerts';
    case 'tracking_added':
      return 'trackingAddedAlerts';
    default:
      return null;
  }
}

/**
 * Loads the user's notification preferences from AsyncStorage.
 * Merges with defaults so new keys get sensible values on upgrade.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (e) {
    log('[NotifPrefs] Error reading preferences:', e);
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Saves notification preferences to AsyncStorage.
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    log('[NotifPrefs] Preferences saved');
  } catch (e) {
    log('[NotifPrefs] Error saving preferences:', e);
  }
}

/**
 * Updates a single preference key (boolean toggle or delivery sound).
 */
export async function updatePreference(
  key: keyof NotificationPreferences,
  value: boolean | DeliverySound,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  const updated = { ...current, [key]: value };
  await saveNotificationPreferences(updated);
  return updated;
}

/**
 * Checks whether a notification of the given type should be sent,
 * based on the user's preferences.
 */
export async function shouldSendNotification(
  type: string,
): Promise<boolean> {
  const prefKey = typeToPreference(type);
  if (!prefKey) return true; // Not user-configurable → always send

  const prefs = await getNotificationPreferences();
  return prefs[prefKey] as boolean;
}

/**
 * Returns the user's preferred delivery notification sound,
 * or 'default' if not set.
 */
export async function getDeliverySound(): Promise<DeliverySound> {
  const prefs = await getNotificationPreferences();
  return prefs.deliverySound ?? 'default';
}
