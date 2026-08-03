/**
 * ThemeProvider — global theme state for Porchivo.
 *
 * Architecture:
 *  - Stores user preference ('light' | 'dark' | 'system') in AsyncStorage.
 *  - Resolves the active theme by combining preference + device colour scheme.
 *  - Exposes tokens, resolvedTheme, preference, setPreference, isDark, toggleTheme.
 *  - Wraps @react-navigation/native ThemeProvider so navigation chrome inherits
 *    the resolved theme automatically.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import createContextHook from '@nkzw/create-context-hook';

import {
  getTokens,
  navDarkTheme,
  navLightTheme,
  ThemePreference,
  ThemeTokens,
  ResolvedTheme,
} from '@/constants/theme';

const STORAGE_KEY = 'porchivo_theme_pref';

// ── Context value ─────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  preference:    ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  resolvedTheme: ResolvedTheme;
  tokens:        ThemeTokens;
  isDark:        boolean;
  toggleTheme:   () => void;
}

export const [_ThemeContextInner, useThemeContext] =
  createContextHook((): ThemeContextValue => {
    const deviceScheme = useColorScheme();
    const [preference, setPreferenceState] = useState<ThemePreference>('system');

    // Rehydrate persisted preference on mount
    useEffect(() => {
      void AsyncStorage.getItem(STORAGE_KEY).then((val) => {
        if (val === 'light' || val === 'dark' || val === 'system') {
          setPreferenceState(val);
        }
      });
    }, []);

    const setPreference = useCallback(
      async (pref: ThemePreference): Promise<void> => {
        setPreferenceState(pref);
        await AsyncStorage.setItem(STORAGE_KEY, pref);
      },
      [],
    );

    const resolvedTheme: ResolvedTheme =
      preference === 'system'
        ? deviceScheme === 'dark' ? 'dark' : 'light'
        : preference;

    const isDark       = resolvedTheme === 'dark';
    const tokens       = getTokens(resolvedTheme);

    // Convenience toggle: light ↔ dark, never writes 'system'
    const toggleTheme = useCallback((): void => {
      void setPreference(isDark ? 'light' : 'dark');
    }, [isDark, setPreference]);

    return { preference, setPreference, resolvedTheme, tokens, isDark, toggleTheme };
  });

// ── Nav bridge — reads resolved theme, applies to @react-navigation/native ────

function NavThemeBridge({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeContext();
  return (
    <NavThemeProvider value={isDark ? navDarkTheme : navLightTheme}>
      {children}
    </NavThemeProvider>
  );
}

// ── Public provider ───────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <_ThemeContextInner>
      <NavThemeBridge>{children}</NavThemeBridge>
    </_ThemeContextInner>
  );
}
