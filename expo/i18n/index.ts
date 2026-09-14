/**
 * Porchivo — i18n entry (Expo / React Native).
 *
 * Language resolution priority (highest wins):
 * 1. Signed-in user's `profiles.preferred_language` — adopted at sign-in /
 *    app start with a restored session (profile wins over everything).
 * 2. The user's saved preference (AsyncStorage) — a manual in-app selection;
 *    always overrides device settings.
 * 3. Device system language (expo-localization) — first launch only:
 *    exact match ('es-US' → 'es-US'), then base language
 *    ('es-MX' → 'es-US'), then the default.
 * 4. DEFAULT_LOCALE ('en-US') — the guaranteed fallback.
 * The app language is NEVER derived from GPS, IP, or store country.
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t, i18n } = useTranslation();
 *   t('settings.title');
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from './config';
import {
  DEFAULT_LOCALE,
  detectDeviceLocale,
  mapStoredPreference,
  resolveLocale,
  type EnabledLocale,
} from './localeRegistry';

/** AsyncStorage key for the persisted language preference. */
export const LANGUAGE_STORAGE_KEY = 'porchivo.language';

/**
 * Resolve the initial language on app start.
 *
 * A saved (manual) preference always wins. Without one, the device language
 * is matched against enabled locales (exact tag → base language → default)
 * and persisted so subsequent launches are stable.
 */
export async function resolveInitialLanguage(): Promise<{
  code: EnabledLocale;
  fromSystem: boolean;
}> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved) {
      const mapped = mapStoredPreference(saved);
      if (mapped) return { code: mapped, fromSystem: false };
    }
  } catch {
    // Storage unavailable — fall through to device detection.
  }

  const detected = resolveLocale(detectDeviceLocale());
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, detected);
  } catch {
    // Non-fatal: the choice still applies for this session.
  }
  return { code: detected, fromSystem: true };
}

/** Change the app language and persist the choice (manual selection). */
export async function changeLanguage(code: EnabledLocale): Promise<void> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
}

/**
 * RTL is never enabled today — no enabled locale is right-to-left. When an
 * RTL locale (ar) ships, follow the extension point documented in
 * ./localeRegistry before flipping this.
 */
export function isCurrentRTL(): boolean {
  return false;
}

export { DEFAULT_LOCALE } from './localeRegistry';
export default i18n;
