/**
 * Porchivo — Notification Preferences Hook
 *
 * Provides reactive access to notification preferences via context hook.
 * Wraps the AsyncStorage-based preferences with React state so UI
 * components can toggle preferences and see instant updates.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  NotificationPreferences,
  DeliverySound,
  DEFAULT_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
  updatePreference as updatePref,
} from '@/lib/notificationPreferences';
import { log } from '@/lib/logger';

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    void getNotificationPreferences().then((loaded) => {
      setPrefs(loaded);
      setLoaded(true);
    });
  }, []);

  const togglePref = useCallback(
    async (key: keyof Omit<NotificationPreferences, 'deliverySound'>) => {
      const newValue = !prefs[key];
      // Optimistic update
      setPrefs((prev) => ({ ...prev, [key]: newValue }));
      try {
        const updated = await updatePref(key, newValue);
        setPrefs(updated);
        log('[NotifPrefsHook] Toggled', key, '→', newValue);
      } catch (e) {
        // Revert on error
        setPrefs((prev) => ({ ...prev, [key]: !newValue }));
        log('[NotifPrefsHook] Toggle error:', e);
      }
    },
    [prefs],
  );

  const setDeliverySound = useCallback(
    async (sound: DeliverySound) => {
      setPrefs((prev) => ({ ...prev, deliverySound: sound }));
      try {
        const updated = await updatePref('deliverySound', sound);
        setPrefs(updated);
        log('[NotifPrefsHook] Set deliverySound →', sound);
      } catch (e) {
        log('[NotifPrefsHook] setDeliverySound error:', e);
      }
    },
    [],
  );

  const setAll = useCallback(async (newPrefs: NotificationPreferences) => {
    setPrefs(newPrefs);
    await saveNotificationPreferences(newPrefs);
  }, []);

  return { prefs, loaded, togglePref, setDeliverySound, setAll };
}
