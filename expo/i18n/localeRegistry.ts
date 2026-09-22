/**
 * Porchivo — Locale Registry
 *
 * Single source of truth for the app locales Porchivo supports. Only locales
 * listed in ENABLED_LOCALES — each backed by a complete, reviewed translation
 * dictionary in ./locales/ — appear in the in-app language picker and can be
 * resolved from the device. Future locales are declared in PLANNED_LOCALES
 * purely for documentation; they are NEVER user-selectable until their
 * dictionaries are complete and the entry is explicitly moved to
 * ENABLED_LOCALES.
 *
 * ── How to add a new language (e.g. fr-CA) ─────────────────────────────────
 * 1. Create `./locales/fr-CA.json` — a complete, professionally reviewed
 *    dictionary with exactly the same key structure as en-US.json.
 * 2. In ./config.ts: import it, add `'fr-CA': { translation: frCA }` to
 *    `resources`, and include its code in the supportedLngs input.
 * 3. Move its entry from PLANNED_LOCALES into ENABLED_LOCALES.
 * 4. Add a `language.frenchCA` display key to every locale JSON.
 * Until step 3, the locale never renders in the picker regardless of the
 * device language — resolution falls through to the next candidate.
 *
 * ── RTL extension point (do NOT enable today) ──────────────────────────────
 * `ar` carries rtl: true for completeness. Enabling any RTL locale requires:
 * a full RTL test pass, I18nManager.allowRTL/forceRTL at native bootstrap
 * (which requires an app restart to take effect), a mirrored-layout audit of
 * every screen, and RTL-safe icon/animation direction. This codebase never
 * calls I18nManager — an RTL locale existing in the registry alone changes
 * nothing at runtime.
 */

import { getLocales } from 'expo-localization';

/** Locales with complete dictionaries that are live in the picker. */
export type EnabledLocale = 'en-US' | 'es-US';

export interface LocaleMeta {
  /** BCP-47 tag — matches the resource bundle key in ./config.ts */
  code: EnabledLocale;
  /** ISO-639 base language, used for base-language fallback matching */
  baseLanguage: string;
  /** Language name in English (secondary line in the picker) */
  englishName: string;
  /** Endonym — the language's own name (primary line in the picker) */
  nativeName: string;
  /** Right-to-left script. Only ever true for locales that are NOT enabled. */
  rtl?: boolean;
}

export interface PlannedLocaleMeta {
  code: string;
  baseLanguage: string;
  englishName: string;
  nativeName: string;
  rtl?: boolean;
}

export const DEFAULT_LOCALE: EnabledLocale = 'en-US';

/** Picker order. en-US first — it is the default and always present. */
export const ENABLED_LOCALES: readonly LocaleMeta[] = [
  {
    code: 'en-US',
    baseLanguage: 'en',
    englishName: 'English',
    nativeName: 'English (United States)',
  },
  {
    code: 'es-US',
    baseLanguage: 'es',
    englishName: 'Spanish',
    nativeName: 'Español (Estados Unidos)',
  },
];

/**
 * Documented roadmap — NOT shown in the picker, NOT resolvable from the
 * device, NOT wired to translation resources. Promote per the file-header
 * checklist when a reviewed dictionary lands.
 */
export const PLANNED_LOCALES: readonly PlannedLocaleMeta[] = [
  { code: 'fr-CA', baseLanguage: 'fr', englishName: 'French', nativeName: 'Français (Canada)' },
  { code: 'pt-BR', baseLanguage: 'pt', englishName: 'Portuguese', nativeName: 'Português (Brasil)' },
  { code: 'fr-FR', baseLanguage: 'fr', englishName: 'French', nativeName: 'Français (France)' },
  { code: 'de-DE', baseLanguage: 'de', englishName: 'German', nativeName: 'Deutsch (Deutschland)' },
  { code: 'ja-JP', baseLanguage: 'ja', englishName: 'Japanese', nativeName: '日本語 (日本)' },
  { code: 'ko-KR', baseLanguage: 'ko', englishName: 'Korean', nativeName: '한국어' },
  { code: 'zh-Hans', baseLanguage: 'zh', englishName: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-Hant', baseLanguage: 'zh', englishName: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'ar', baseLanguage: 'ar', englishName: 'Arabic', nativeName: 'العربية', rtl: true },
];

const ENABLED_LOCALE_CODES: readonly string[] = ENABLED_LOCALES.map((l) => l.code);

// Keyed by normalizeTag(code) — lookups in getLocaleMeta/resolveLocale pass
// normalized (lowercased) tags, so mixed-case keys like 'en-US' would never hit.
const LOCALE_MAP: Record<string, LocaleMeta> = ENABLED_LOCALES.reduce(
  (acc, lang) => {
    acc[normalizeTag(lang.code)] = lang;
    return acc;
  },
  {} as Record<string, LocaleMeta>,
);

/** Lowercase and normalize underscore region separators to BCP-47 hyphens. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

/** 'es-MX' → 'es' */
export function baseLanguageOf(tag: string): string {
  return normalizeTag(tag).split('-')[0] ?? '';
}

/**
 * Resolve a device/system locale against ENABLED_LOCALES.
 * Exact match first ('es-US' → 'es-US'), then base-language match
 * ('es-MX', 'es-419', 'es' → 'es-US'), otherwise the default ('en-US').
 * Never derives language from GPS, IP, or store country.
 */
export function resolveLocale(candidateTags: readonly string[]): EnabledLocale {
  for (const raw of candidateTags) {
    if (!raw) continue;
    const tag = normalizeTag(raw);
    if (LOCALE_MAP[tag]) return LOCALE_MAP[tag].code;
  }
  for (const raw of candidateTags) {
    if (!raw) continue;
    const base = baseLanguageOf(raw);
    const hit = ENABLED_LOCALES.find((l) => l.baseLanguage === base);
    if (hit) return hit.code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Device locale tags in priority order from expo-localization
 * (e.g. ['es-US', 'en-US']). Empty on failure — resolveLocale then
 * returns the default.
 */
export function detectDeviceLocale(): string[] {
  try {
    const locales = getLocales();
    return locales
      .map((l) => l.languageTag ?? l.languageCode ?? '')
      .filter((t): t is string => !!t);
  } catch {
    // expo-localization may be unavailable in some environments
    return [];
  }
}

/**
 * Map a previously persisted preference to an enabled locale.
 * Accepts current full tags ('en-US'/'es-US') and the legacy short codes the
 * first-generation picker stored ('en'/'es'/…). Legacy codes whose languages
 * were never fully translated return null — the caller falls through to
 * device detection / the default (they never reached the picker as real
 * translations).
 */
export function mapStoredPreference(saved: string): EnabledLocale | null {
  const tag = normalizeTag(saved);
  if (tag === 'en-us' || tag === 'en') return 'en-US';
  if (tag === 'es-us' || tag === 'es') return 'es-US';
  return null;
}

/**
 * App locale → `profiles.preferred_language` value. The DB column constrains
 * values to 'en' | 'es' (shared with the Resend email-language resolution),
 * so full BCP-47 tags are folded to the base language. Returns null for
 * locales the profile column cannot store.
 */
export function localeToProfileValue(locale: string): 'en' | 'es' | null {
  const base = baseLanguageOf(locale);
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  return null;
}

/** `profiles.preferred_language` value → app locale, if enabled. */
export function profileValueToLocale(value: string): EnabledLocale | null {
  const tag = normalizeTag(value);
  if (tag === 'en') return 'en-US';
  if (tag === 'es') return 'es-US';
  return null;
}

export function getLocaleMeta(code: string): LocaleMeta | undefined {
  return LOCALE_MAP[normalizeTag(code)];
}

/**
 * RTL check against the FULL registry (enabled + planned). Safe by design:
 * no enabled locale is RTL, so this always returns false today. See the
 * file-header RTL extension point before ever enabling one.
 */
export function isRTLLocale(code: string): boolean {
  const meta = getLocaleMeta(code);
  if (meta) return meta.rtl ?? false;
  return PLANNED_LOCALES.some((l) => l.code === normalizeTag(code) && !!l.rtl);
}

/** Codes i18next is configured to serve (keeps config.ts in sync). */
export function enabledLocaleCodes(): string[] {
  return [...ENABLED_LOCALE_CODES];
}
