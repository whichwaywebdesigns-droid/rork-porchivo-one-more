/**
 * Porchivo — Language Provider (Expo / React Native).
 *
 * Wraps the i18n init with a context hook that:
 * 1. On mount, resolves the language (saved manual preference → device
 *    locale → en-US) behind a short invisible gate so no wrong-language
 *    text ever paints (see the gate in LanguageRootContent).
 * 2. On sign-in / session restore, reconciles with the user's profile:
 *    - A saved profile preference WINS over the local device choice.
 *    - With no profile preference, the local selection is pushed to
 *      `profiles.preferred_language` (powers Spanish Resend emails).
 * 3. Exposes `setLanguage(code)` — manual selections apply immediately
 *    (smooth fade-out → swap → fade-in) and persist to both storage and
 *    profile.
 *
 * Profile values are folded to the DB's canonical 'en' | 'es' (check
 * constraint shared with the email pipeline) via ./localeRegistry mappers —
 * no schema change, no competing column.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import i18n, {
  resolveInitialLanguage,
  changeLanguage as persistLanguageChange,
  LANGUAGE_STORAGE_KEY,
} from './index';
import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  getLocaleMeta,
  isRTLLocale,
  localeToProfileValue,
  profileValueToLocale,
  type EnabledLocale,
  type LocaleMeta,
} from './localeRegistry';
import { supabase } from '../lib/supabase';

/** Fade-out duration in ms. */
const FADE_OUT_MS = 200;
/** Pause while invisible before fading back in, in ms. */
const HOLD_MS = 60;
/** Fade-in duration in ms. */
const FADE_IN_MS = 280;

/** Best-effort push of the current locale to profiles.preferred_language. */
async function syncProfileLanguage(locale: string): Promise<void> {
  const value = localeToProfileValue(locale);
  if (!value) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: value })
      .eq('id', session.user.id);
    if (error) {
      console.warn('[language] profile sync failed:', error.message);
    }
  } catch (e) {
    console.warn(
      '[language] profile sync error:',
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Profile-wins reconciliation at sign-in / session restore. A valid profile
 * preference is adopted (and mirrored locally); without one, the local
 * choice is pushed to the profile so choices made while signed out survive.
 */
async function reconcileWithProfile(current: string): Promise<EnabledLocale | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('[language] profile read failed:', error.message);
      return null;
    }
    const stored = typeof data?.preferred_language === 'string' ? data.preferred_language : '';
    const fromProfile = stored ? profileValueToLocale(stored) : null;
    if (fromProfile) {
      if (fromProfile !== current) {
        await persistLanguageChange(fromProfile);
      }
      return fromProfile;
    }
    void syncProfileLanguage(current);
    return null;
  } catch (e) {
    console.warn(
      '[language] profile reconcile error:',
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

interface LanguageContextValue {
  /** Current enabled locale (e.g. 'en-US', 'es-US'). */
  language: EnabledLocale;
  /** Metadata for the current language. */
  languageMeta: LocaleMeta;
  /** Enabled languages only — planned locales never render in the picker. */
  languages: readonly LocaleMeta[];
  /** Whether the current language is RTL (always false today). */
  rtl: boolean;
  /** Whether the initial language resolution is still loading. */
  isReady: boolean;
  /** True if the current language was auto-detected from the system. */
  fromSystem: boolean;
  /** Whether a language transition (fade) is in progress. */
  isTransitioning: boolean;
  /** Animated opacity value — drive a wrapping Animated.View with this. */
  fadeAnim: Animated.Value;
  /** Change the language, persist locally + to the profile. Fades globally. */
  setLanguage: (code: EnabledLocale) => Promise<void>;
}

export const [LanguageProvider, useLanguage] = createContextHook(
  (): LanguageContextValue => {
    const [language, setLanguageState] = useState<EnabledLocale>(DEFAULT_LOCALE);
    const [isReady, setIsReady] = useState(false);
    const [fromSystem, setFromSystem] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Resolve the initial language on mount (saved → device → default).
    useEffect(() => {
      let mounted = true;
      void (async () => {
        const { code, fromSystem: detected } = await resolveInitialLanguage();
        if (!mounted) return;
        setLanguageState(code);
        setFromSystem(detected);
        if (i18n.language !== code) {
          await i18n.changeLanguage(code);
        }
        setIsReady(true);
      })();
      return () => {
        mounted = false;
      };
    }, []);

    // Track language changes initiated elsewhere (kept for safety).
    useEffect(() => {
      const handler = (lng: string) => {
        const mapped = getLocaleMeta(lng);
        if (mapped) setLanguageState(mapped.code);
        setFromSystem(false);
      };
      i18n.on('languageChanged', handler);
      return () => {
        i18n.off('languageChanged', handler);
      };
    }, []);

    // Profile reconciliation — runs once per auth session, AFTER bootstrap,
    // so the resolved preference (not the pre-bootstrap default) reconciles.
    useEffect(() => {
      if (!isReady) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          void reconcileWithProfile(i18n.language).then((adopted) => {
            if (adopted) setLanguageState(adopted);
          });
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }, [isReady]);

    const setLanguage = useCallback(
      async (code: EnabledLocale) => {
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
        // Manual choice: mirror to the profile (fire-and-forget).
        void syncProfileLanguage(code);

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
      },
      [fadeAnim, isTransitioning],
    );

    // Guaranteed non-null: the default locale is always in ENABLED_LOCALES.
    const meta = getLocaleMeta(language) ?? ENABLED_LOCALES[0];

    return {
      language,
      languageMeta: meta,
      languages: ENABLED_LOCALES,
      rtl: isRTLLocale(language),
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
 * Gate + transition host. While the initial language resolves (a single
 * AsyncStorage read — typically a few ms) the tree stays mounted but fully
 * transparent with touches disabled: no wrong-language first paint, and no
 * remount of the provider stack once resolution lands.
 */
function LanguageRootContent({ children }: { children: React.ReactNode }) {
  const { fadeAnim, isReady } = useLanguage();

  if (!isReady) {
    return (
      <I18nextProvider i18n={i18n}>
        <View style={{ flex: 1, opacity: 0 }} pointerEvents="none">
          {children}
        </View>
      </I18nextProvider>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {children}
      </Animated.View>
    </I18nextProvider>
  );
}
