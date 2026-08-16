/**
 * Porchivo — Language Registry
 *
 * Single source of truth for languages offered in the app language selector.
 * Mirrors the web platform's language list.
 */

import { getLocales } from 'expo-localization';

export interface LanguageMeta {
  /** BCP-47 language code */
  code: string;
  /** English name of the language */
  englishName: string;
  /** Endonym — the language's name in its own script */
  nativeName: string;
  /** Representative flag emoji */
  flag: string;
  /** Right-to-left script */
  rtl?: boolean;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh', englishName: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'fr', englishName: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', englishName: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
];

export const LANGUAGE_MAP: Record<string, LanguageMeta> = LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code] = lang;
    return acc;
  },
  {} as Record<string, LanguageMeta>,
);

export const DEFAULT_LANGUAGE = 'en';

export function getLanguageMeta(code: string): LanguageMeta {
  return LANGUAGE_MAP[code] ?? LANGUAGE_MAP[code.split('-')[0]] ?? LANGUAGE_MAP[DEFAULT_LANGUAGE];
}

export function isRTL(code: string): boolean {
  return getLanguageMeta(code)?.rtl ?? false;
}

/**
 * Detect the device's system language and match it to a supported language.
 * Uses expo-localization's getLocales() which returns the user's preferred
 * languages in priority order. Falls back to DEFAULT_LANGUAGE if none match.
 *
 * Called once on first launch (when no saved preference exists) to set the
 * app's default language to match the device.
 */
export function detectSystemLanguage(): string {
  try {
    const locales = getLocales();
    for (const locale of locales) {
      const code = locale.languageCode;
      if (code && LANGUAGE_MAP[code]) {
        return code;
      }
    }
  } catch {
    // expo-localization may not be available in all environments
  }
  return DEFAULT_LANGUAGE;
}
