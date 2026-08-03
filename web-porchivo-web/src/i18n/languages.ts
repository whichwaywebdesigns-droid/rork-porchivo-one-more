/**
 * Porchivo — Language Registry
 *
 * Single source of truth for the languages offered in the language selector.
 * Every entry has an accurate BCP-47 code, English name, endonym (native name),
 * a representative flag, and text direction.
 *
 * Only locales with bundled, hand-written UI translations are listed here — the
 * picker offers exactly what the site can actually render. English and Spanish
 * lead; additional locales follow.
 */

export interface LanguageMeta {
  /** BCP-47 language code (used by i18next, <html lang>, Intl) */
  code: string;
  /** English name of the language */
  englishName: string;
  /** Endonym — the language's name in its own script */
  nativeName: string;
  /** Representative flag emoji */
  flag: string;
  /** Right-to-left script */
  rtl?: boolean;
  /** True when hand-written UI translations are bundled (always true here) */
  translated?: boolean;
}

/**
 * Locales offered in the picker. Each one ships hand-written UI translations.
 * English and Spanish lead; additional locales follow.
 */
export const LANGUAGES: LanguageMeta[] = [
  { code: "en", englishName: "English", nativeName: "English", flag: "🇺🇸", translated: true },
  { code: "es", englishName: "Spanish", nativeName: "Español", flag: "🇪🇸", translated: true },
  { code: "zh", englishName: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", translated: true },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", translated: true },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", flag: "🇸🇦", rtl: true, translated: true },
  { code: "pt", englishName: "Portuguese", nativeName: "Português", flag: "🇧🇷", translated: true },
  { code: "fr", englishName: "French", nativeName: "Français", flag: "🇫🇷", translated: true },
  { code: "de", englishName: "German", nativeName: "Deutsch", flag: "🇩🇪", translated: true },
  { code: "ja", englishName: "Japanese", nativeName: "日本語", flag: "🇯🇵", translated: true },
  { code: "ru", englishName: "Russian", nativeName: "Русский", flag: "🇷🇺", translated: true },
  { code: "ko", englishName: "Korean", nativeName: "한국어", flag: "🇰🇷", translated: true },
  { code: "it", englishName: "Italian", nativeName: "Italiano", flag: "🇮🇹", translated: true },
];

/** Quick lookup map by code */
export const LANGUAGE_MAP: Record<string, LanguageMeta> = LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code] = lang;
    return acc;
  },
  {} as Record<string, LanguageMeta>,
);

/** Language codes that ship hand-written UI translations */
export const SUPPORTED_LANGUAGE_CODES: string[] = LANGUAGES.filter((l) => l.translated).map(
  (l) => l.code,
);

export const DEFAULT_LANGUAGE = "en";

/** Resolve a meta entry, falling back to English for unknown codes */
export function getLanguageMeta(code: string): LanguageMeta {
  return LANGUAGE_MAP[code] ?? LANGUAGE_MAP[code.split("-")[0]] ?? LANGUAGE_MAP[DEFAULT_LANGUAGE];
}
