import { lightPalette, darkPalette } from './theme';
import { useTheme } from '@/store/ThemeContext';

export type AppColors = ReturnType<typeof getColors>;

export function getColors(isDark: boolean) {
  const p = isDark ? darkPalette : lightPalette;
  return {
    // Primary CTA — icon blue
    primary: p.accent,
    primaryLight: p.accentGlow,
    onPrimary: p.onAccent,

    // Secondary — icon orange
    secondary: p.warmOrange,
    secondaryLight: p.warmOrangeGlow,

    // Backgrounds
    background: p.bg,
    surface: p.bgSurface,
    elevated: p.bgElevated,

    // "White" — actual white in light, near-white in dark (for text on colored elements)
    white: isDark ? '#E8EEF8' : '#FFFFFF',

    // Tinted surfaces
    skyBlue: isDark ? p.sky : '#EBF2FF',
    peach: isDark ? p.emberSoft : '#FFF0E6',

    // Status
    success: p.successGreen,
    successLight: p.successGlow,
    danger: p.danger,
    dangerLight: p.dangerGlow,

    // Typography hierarchy
    slate: p.textPrimary,
    slateLight: p.textSecondary,
    slateLighter: p.textMuted,

    // Borders
    border: p.borderDark,
    borderLight: p.bgElevated,

    // Gold
    gold: p.gold,
    goldSoft: p.goldGlow,

    cardShadow: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(26, 43, 74, 0.10)',

    // Expose full palette for edge cases
    palette: p,
  } as const;
}

// Pre-built per-theme color objects. getColors() is deterministic given
// isDark, so module-level singletons give every useColors() caller a stable
// identity. Without this, each render returned a fresh object, which broke
// every useMemo/useCallback dependency chain downstream (notably FlatList
// ListHeaderComponents remounting on each parent re-render → scroll jumps).
const LIGHT_COLORS: AppColors = getColors(false);
const DARK_COLORS: AppColors = getColors(true);

/** Hook — returns reactive colors that update when the theme toggle changes. */
export function useColors(): AppColors {
  const { isDark } = useTheme();
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

// Static light-mode Colors (backward compat for screens not yet using useColors)
const Colors = getColors(false);
export default Colors;
