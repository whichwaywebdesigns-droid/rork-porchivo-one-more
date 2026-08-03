/**
 * store/ThemeContext.tsx — backward-compatibility bridge.
 *
 * The canonical theme system now lives in:
 *   providers/ThemeProvider.tsx  — provider + context
 *   hooks/useTheme.ts            — useTheme() hook
 *   constants/theme.ts           — tokens, types, nav themes
 *
 * This file re-exports under the original names so every existing import
 * continues to work without touching each consuming screen.
 */

export { ThemeProvider } from '@/providers/ThemeProvider';
export { useTheme }      from '@/hooks/useTheme';
