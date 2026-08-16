/**
 * Porchivo — Language Provider (Expo / React Native).
 *
 * Wraps the i18n init with a context hook that:
 * 1. On first launch, auto-detects the device's system language and sets it.
 * 2. On subsequent launches, restores the user's saved preference.
 * 3. Exposes `setLanguage(code)` to change the language and persist the choice.
 * 4. Applies a smooth fade-out → swap → fade-in transition when switching languages.
 *
 * Persisted via AsyncStorage — the user's manual selection always wins
 * over system detection on future launches.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
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

/** Fade-out duration in ms. */
const FADE_OUT_MS = 200;
/** Pause while invisible before fading back in, in ms. */
const HOLD_MS = 60;
/** Fade-in duration in ms. */
const FADE_IN_MS = 280;

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
  /** Whether a language transition (fade) is in progress. */
  isTransitioning: boolean;
  /** Animated opacity value — drive a wrapping Animated.View with this. */
  fadeAnim: Animated.Value;
  /** Change the language and persist the choice. Triggers a fade transition. */
  setLanguage: (code: string) => Promise<void>;
}

export const [LanguageProvider, useLanguage] = createContextHook(
  (): LanguageContextValue => {
    const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
    const [isReady, setIsReady] = useState(false);
    const [fromSystem, setFromSystem] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;

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
      if (isTransitioning) return;
      setIsTransitioning(true);

      // Phase 1 — fade out.
      await new Promise<void>((resolve) => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => resolve());
      });

      // Phase 2 — swap language while invisible.
      await persistLanguageChange(code);
      setLanguageState(code);
      setFromSystem(false);

      // Brief hold so the new text is fully settled before fading in.
      await new Promise((resolve) => setTimeout(resolve, HOLD_MS));

      // Phase 3 — fade back in.
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setIsTransitioning(false);
      });
    }, [fadeAnim, isTransitioning]);

    const meta = getLanguageMeta(language);
    const rtl = checkIsRTL(language);

    return {
      language,
      languageMeta: meta,
      languages: LANGUAGES,
      rtl,
      isReady,
      fromSystem,
      isTransitioning,
      fadeAnim,
      setLanguage,
    };
  },
);

export { LANGUAGE_STORAGE_KEY };
export { LanguageProvider as LanguageProviderWrapped };

/**
 * Full language provider that wraps the context hook with I18nextProvider
 * and applies the fade transition to the entire app tree.
 * Use this in the root layout.
 */
export function LanguageRootProvider({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LanguageRootContent>{children}</LanguageRootContent>
    </LanguageProvider>
  );
}

/**
 * Inner component that reads the fade animation value from the language
 * context and wraps the app tree in an Animated.View so the opacity
 * transition is applied globally.
 */
function LanguageRootContent({ children }: { children: React.ReactNode }) {
  const { fadeAnim } = useLanguage();

  return (
    <I18nextProvider i18n={i18n}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {children}
      </Animated.View>
    </I18nextProvider>
  );
}
