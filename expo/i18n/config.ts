/**
 * Porchivo — i18next configuration (Expo / React Native).
 *
 * Wires the translation resources (./locales/*.json) into a single i18next
 * instance. Only enabled locales from ./localeRegistry are registered —
 * planned locales have no resources and never resolve, so a device set to
 * an unshipped language falls back to en-US automatically.
 *
 * Key conventions:
 * - Semantic nested keys (`settings.language`, `errors.generic`) — English
 *   text is never used as a key.
 * - Pluralization via i18next JSON v4 suffixes: `packages.count_one` /
 *   `packages.count_other`, queried with `t('packages.count', { count: n })`.
 * - Interpolation: `t('login.notMe', { name })` — `escapeValue: false` is
 *   correct for React (React already escapes rendered strings).
 *
 * The `en-US` dictionary is the canonical key set: `types.ts` augments
 * i18next with its shape (typed `t()` calls) and `es-US` is structurally
 * checked against it below, so a missing Spanish key fails compilation.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import esUSRaw from './locales/es-US.json';
import { DEFAULT_LOCALE, enabledLocaleCodes } from './localeRegistry';

// Structural check: es-US.json must carry every en-US.json key (compile
// error on any missing key). Raw import retained for the resources map.
const esUS: typeof enUS = esUSRaw;

import './types';

export const resources = {
  'en-US': { translation: enUS },
  'es-US': { translation: esUS },
} as const;

// Initialized at module scope (same pattern as the previous inline-resource
// setup) so every import of this module sees a ready i18next instance. The
// LanguageProvider resolves the user's real preference on mount and calls
// changeLanguage() before the gate lifts — no first-paint flash.
void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: enabledLocaleCodes(),
  // Full BCP-47 tags only — regional variants (es-US) are first-class
  // locales, not collapsed to bare languages.
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
