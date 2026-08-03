/**
 * useTheme — primary hook for consuming global theme state.
 *
 * Returns: preference, setPreference, resolvedTheme, tokens, isDark, toggleTheme.
 *
 * Usage:
 *   import { useTheme } from '@/hooks/useTheme';
 *   const { isDark, tokens, setPreference } = useTheme();
 */

export { useThemeContext as useTheme } from '@/providers/ThemeProvider';
export type { ThemeContextValue }       from '@/providers/ThemeProvider';
