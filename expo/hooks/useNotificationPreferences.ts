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
    async (key: keyof NotificationPreferences) => {
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

  const setAll = useCallback(async (newPrefs: NotificationPreferences) => {
    setPrefs(newPrefs);
    await saveNotificationPreferences(newPrefs);
  }, []);

  return { prefs, loaded, togglePref, setAll };
}
