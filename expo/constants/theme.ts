import { TextStyle, ViewStyle } from 'react-native';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Palette — raw colour values (Porchivo blue + orange + navy)
// ─────────────────────────────────────────────────────────────────────────────

export const lightPalette = {
  bg: '#F5F7FA',
  bgSurface: '#FFFFFF',
  bgElevated: '#EBF0F8',
  bgCard: '#FFFFFF',
  borderDark: '#D8E4F0',
  borderGlow: '#C5D8EE',

  accent: '#3A7BD5',
  accentDim: '#2A5FA8',
  accentGlow: 'rgba(58, 123, 213, 0.10)',
  accentGlowStrong: 'rgba(58, 123, 213, 0.18)',
  onAccent: '#FFFFFF',

  textPrimary: '#1A2B4A',
  textSecondary: 'rgba(26, 43, 74, 0.55)',
  textMuted: 'rgba(26, 43, 74, 0.38)',
  textDisabled: 'rgba(26, 43, 74, 0.22)',

  danger: '#E5484D',
  dangerGlow: 'rgba(229, 72, 77, 0.10)',
  successGreen: '#1E9C6A',
  successGlow: 'rgba(30, 156, 106, 0.10)',
  warmOrange: '#E8622A',
  warmOrangeGlow: 'rgba(232, 98, 42, 0.10)',
  gold: '#C8941E',
  goldGlow: 'rgba(200, 148, 30, 0.10)',

  ink: '#1A2B4A',
  navy: '#3A7BD5',
  navySoft: '#5B93E8',
  sky: '#EBF2FF',
  ember: '#E8622A',
  emberSoft: '#FFF0E6',
  emberDeep: '#C8511A',
  goldSoft: '#FFF8E6',
  sage: '#1E9C6A',
  sageSoft: '#E8F9F0',
  rose: '#E5484D',
  roseSoft: '#FDECEC',
  slate900: '#1A2B4A',
  slate700: '#374B6B',
  slate500: '#6B7F99',
  slate300: '#9CA8BB',
  slate200: '#D8E4F0',
  slate100: '#F0F4F8',
  canvas: '#F5F7FA',
  surface: '#FFFFFF',

  railBg: '#1A2B4A',
  railSurface: '#253554',
  railBorder: '#3A4B6E',
  railBorderSoft: '#4A5F88',
  railText: '#F0F4F8',
  railTextMuted: '#8099B8',
  railAccent: '#E8622A',
} as const;

export const darkPalette = {
  bg: '#0D1B3E',
  bgSurface: '#132040',
  bgElevated: '#1A2B52',
  bgCard: '#132040',
  borderDark: '#1E2F58',
  borderGlow: '#253666',

  accent: '#4A8FE8',
  accentDim: '#3A7BD5',
  accentGlow: 'rgba(74, 143, 232, 0.15)',
  accentGlowStrong: 'rgba(74, 143, 232, 0.25)',
  onAccent: '#FFFFFF',

  textPrimary: '#E8EEF8',
  textSecondary: 'rgba(232, 238, 248, 0.65)',
  textMuted: 'rgba(232, 238, 248, 0.40)',
  textDisabled: 'rgba(232, 238, 248, 0.22)',

  danger: '#FF5555',
  dangerGlow: 'rgba(255, 85, 85, 0.15)',
  successGreen: '#44D882',
  successGlow: 'rgba(68, 216, 130, 0.12)',
  warmOrange: '#F07840',
  warmOrangeGlow: 'rgba(240, 120, 64, 0.15)',
  gold: '#E8C84A',
  goldGlow: 'rgba(232, 200, 74, 0.15)',

  ink: '#E8EEF8',
  navy: '#4A8FE8',
  navySoft: '#6BA8F5',
  sky: '#1A2B52',
  ember: '#F07840',
  emberSoft: 'rgba(240, 120, 64, 0.15)',
  emberDeep: '#E8622A',
  goldSoft: 'rgba(232, 200, 74, 0.15)',
  sage: '#44D882',
  sageSoft: 'rgba(68, 216, 130, 0.12)',
  rose: '#FF5555',
  roseSoft: 'rgba(255, 85, 85, 0.12)',
  slate900: '#E8EEF8',
  slate700: '#B0BFDA',
  slate500: '#7088A8',
  slate300: '#3A4B6E',
  slate200: '#1E2F58',
  slate100: '#132040',
  canvas: '#0D1B3E',
  surface: '#132040',

  railBg: '#0A1428',
  railSurface: '#0F1D38',
  railBorder: '#1A2B52',
  railBorderSoft: '#253666',
  railText: '#E8EEF8',
  railTextMuted: '#7088A8',
  railAccent: '#F07840',
} as const;

export const palette = lightPalette;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Spacing, radii, typography, elevation — static design constants
// ─────────────────────────────────────────────────────────────────────────────

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const type = {
  display:    { fontSize: 38, fontWeight: '900', letterSpacing: -1.4, lineHeight: 42 } as TextStyle,
  displayMd:  { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, lineHeight: 33 } as TextStyle,
  title:      { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  headline:   { fontSize: 17, fontWeight: '600' } as TextStyle,
  body:       { fontSize: 15, fontWeight: '400', lineHeight: 22 } as TextStyle,
  caption:    { fontSize: 13, fontWeight: '500' } as TextStyle,
  overline:   { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' } as TextStyle,
  micro:      { fontSize: 10, fontWeight: '600', letterSpacing: 1.8, textTransform: 'uppercase' } as TextStyle,
} as const;

export const elevation: Record<'none' | 'low' | 'raised' | 'glow', ViewStyle> = {
  none:   { shadowOpacity: 0, elevation: 0 },
  low:    { shadowColor: '#1A2B4A', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 4 },  shadowRadius: 12, elevation: 4  },
  raised: { shadowColor: '#1A2B4A', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 10 },
  glow:   { shadowColor: '#3A7BD5', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 0 },  shadowRadius: 20, elevation: 8  },
};

export const tabularNums = { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] };

// ─────────────────────────────────────────────────────────────────────────────
// 3. Semantic token system — the global theme layer consumed by all components
// ─────────────────────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme   = 'light' | 'dark';

/** All style values referenced by components. Extend here — never hardcode. */
export interface ThemeTokens {
  // Surfaces
  background:  string;
  surface:     string;
  surfaceAlt:  string;
  card:        string;
  // Typography
  text:        string;
  textMuted:   string;
  // Borders
  border:      string;
  // Brand
  accent:      string;
  accentSoft:  string;
  // Status
  success:     string;
  warning:     string;
  danger:      string;
  // Effects
  shadow:      string;
  glow:        string;
  // Porch-light component tokens
  lampMetal:   string;
  lampGlass:   string;
  lampLight:   string;
  // Switch plate tokens
  switchPlate:       string;
  switchPlateBorder: string;
  switchRocker:      string;
  switchRockerOn:    string;
  switchLabel:       string;
}

export const lightTokens: ThemeTokens = {
  background:  '#F4F6FA',
  surface:     '#FFFFFF',
  surfaceAlt:  '#EDF0F5',
  card:        '#FFFFFF',

  text:        '#1A2B4A',
  textMuted:   'rgba(26,43,74,0.52)',

  border:      '#D6E0EE',

  accent:      '#3A7BD5',
  accentSoft:  'rgba(58,123,213,0.10)',

  success:     '#1E9C6A',
  warning:     '#D97706',
  danger:      '#E5484D',

  shadow:      'rgba(26,43,74,0.14)',
  glow:        'rgba(255,180,50,0.55)',

  lampMetal:   '#9CA3AF',
  lampGlass:   'rgba(255,220,150,0.30)',
  lampLight:   '#FFC857',

  switchPlate:       '#E8EDF5',
  switchPlateBorder: '#C2CCDB',
  switchRocker:      '#D0D8E8',
  switchRockerOn:    '#3A7BD5',
  switchLabel:       '#FFFFFF',
} as const;

export const darkTokens: ThemeTokens = {
  background:  '#0D1B3E',
  surface:     '#132040',
  surfaceAlt:  '#1A2B52',
  card:        '#132040',

  text:        '#E8EEF8',
  textMuted:   'rgba(232,238,248,0.50)',

  border:      '#1E2F58',

  accent:      '#4A8FE8',
  accentSoft:  'rgba(74,143,232,0.15)',

  success:     '#44D882',
  warning:     '#FBBF24',
  danger:      '#FF5555',

  shadow:      'rgba(0,0,0,0.55)',
  glow:        'rgba(255,160,30,0.35)',

  lampMetal:   '#4B5563',
  lampGlass:   'rgba(255,200,100,0.15)',
  lampLight:   '#E8A020',

  switchPlate:       '#1E2B45',
  switchPlateBorder: '#2D3D60',
  switchRocker:      '#253050',
  switchRockerOn:    '#4A8FE8',
  switchLabel:       '#FFFFFF',
} as const;

/** Returns the correct token set for the given resolved theme. */
export function getTokens(resolved: ResolvedTheme): ThemeTokens {
  return resolved === 'dark' ? darkTokens : lightTokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Navigation themes — maps semantic tokens → @react-navigation/native Theme
// ─────────────────────────────────────────────────────────────────────────────

export const navLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary:      lightTokens.accent,
    background:   lightTokens.background,
    card:         lightTokens.surface,
    text:         lightTokens.text,
    border:       lightTokens.border,
    notification: lightTokens.danger,
  },
};

export const navDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:      darkTokens.accent,
    background:   darkTokens.background,
    card:         darkTokens.surface,
    text:         darkTokens.text,
    border:       darkTokens.border,
    notification: darkTokens.danger,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Default export — legacy screens import `theme.space`, etc.
// ─────────────────────────────────────────────────────────────────────────────

const theme = { palette, space, radius, type, elevation, tabularNums };
export default theme;
