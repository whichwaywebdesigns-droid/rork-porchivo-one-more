/**
 * Porchivo — Language Provider (Expo / React Native).
 *
 * Wraps the i18n init with a context hook that:
 * 1. On first launch, auto-detects the device's system language and sets it.
 * 2. On subsequent launches, restores the user's saved preference.
 * 3. Exposes `setLanguage(code)` to change the language and persist the choice.
 *
 * Persisted via AsyncStorage — the user's manual selection always wins
 * over system detection on future launches.
 */

import { useEffect, useState, useCallback } from 'react';
import { I18nextProvider } from 'react-i18next';
import createContextHook from '@nkzw/create-context-hook';

import i18n, {
  resolveInitialLanguage,
  changeLanguage as persistLanguageChange,
  LANGUAGE_STORAGE_KEY,
} from './index';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  getLanguageMeta,
  isRTL as checkIsRTL,
  type LanguageMeta,
} from './languages';

interface LanguageContextValue {
  /** Current language code (e.g. 'en', 'es'). */
  language: string;
  /** Language metadata for the current language. */
  languageMeta: LanguageMeta;
  /** All supported languages. */
  languages: LanguageMeta[];
  /** Whether the current language is RTL. */
  rtl: boolean;
  /** Whether the initial language resolution is still loading. */
  isReady: boolean;
  /** True if the current language was auto-detected from the system (not manually chosen). */
  fromSystem: boolean;
  /** Change the language and persist the choice. */
  setLanguage: (code: string) => Promise<void>;
}

export const [LanguageProvider, useLanguage] = createContextHook(
  (): LanguageContextValue => {
    const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
    const [isReady, setIsReady] = useState(false);
    const [fromSystem, setFromSystem] = useState(false);

    // Resolve the initial language on mount.
    useEffect(() => {
      let mounted = true;
      void (async () => {
        const { code, fromSystem: detected } = await resolveInitialLanguage();
        if (!mounted) return;
        setLanguageState(code);
        setFromSystem(detected);
        // Sync i18next with the resolved language.
        if (i18n.language !== code) {
          await i18n.changeLanguage(code);
        }
        setIsReady(true);
      })();
      return () => {
        mounted = false;
      };
    }, []);

    // Listen for language changes from other sources (e.g. language selector).
    useEffect(() => {
      const handler = (lng: string) => {
        setLanguageState(lng);
        setFromSystem(false);
      };
      i18n.on('languageChanged', handler);
      return () => {
        i18n.off('languageChanged', handler);
      };
    }, []);

    const setLanguage = useCallback(async (code: string) => {
      await persistLanguageChange(code);
      setLanguageState(code);
      setFromSystem(false);
    }, []);

    const meta = getLanguageMeta(language);
    const rtl = checkIsRTL(language);

    return {
      language,
      languageMeta: meta,
      languages: LANGUAGES,
      rtl,
      isReady,
      fromSystem,
      setLanguage,
    };
  },
);

export { LANGUAGE_STORAGE_KEY };
export { LanguageProvider as LanguageProviderWrapped };

/**
 * Full language provider that wraps the context hook with I18nextProvider.
 * Use this in the root layout.
 */
export function LanguageRootProvider({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageProvider>
  );
}
