package com.rork.porchivo.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Porchivo brand palette — mirrors the Expo app's design tokens
 * (constants/theme.ts lightPalette / darkPalette).
 */
@Immutable
data class PorchivoColors(
    val background: Color,
    val surface: Color,
    val elevated: Color,
    val border: Color,
    val accent: Color,
    val accentSoft: Color,
    val onAccent: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val success: Color,
    val successSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
    val warmOrange: Color,
    val warmOrangeSoft: Color,
    val gold: Color,
    val goldSoft: Color,
    val skyBlue: Color,
    val peach: Color,
)

val LightPorchivoColors = PorchivoColors(
    background = Color(0xFFF5F7FA),
    surface = Color(0xFFFFFFFF),
    elevated = Color(0xFFEBF0F8),
    border = Color(0xFFD8E4F0),
    accent = Color(0xFF3A7BD5),
    accentSoft = Color(0x1A3A7BD5),
    onAccent = Color(0xFFFFFFFF),
    textPrimary = Color(0xFF1A2B4A),
    textSecondary = Color(0x8C1A2B4A),
    textMuted = Color(0x611A2B4A),
    success = Color(0xFF1E9C6A),
    successSoft = Color(0x1A1E9C6A),
    danger = Color(0xFFE5484D),
    dangerSoft = Color(0x1AE5484D),
    warmOrange = Color(0xFFE8622A),
    warmOrangeSoft = Color(0x1AE8622A),
    gold = Color(0xFFC8941E),
    goldSoft = Color(0xFFFFF8E6),
    skyBlue = Color(0xFFEBF2FF),
    peach = Color(0xFFFFF0E6),
)

val DarkPorchivoColors = PorchivoColors(
    background = Color(0xFF0D1B3E),
    surface = Color(0xFF132040),
    elevated = Color(0xFF1A2B52),
    border = Color(0xFF1E2F58),
    accent = Color(0xFF4A8FE8),
    accentSoft = Color(0x264A8FE8),
    onAccent = Color(0xFFFFFFFF),
    textPrimary = Color(0xFFE8EEF8),
    textSecondary = Color(0xA6E8EEF8),
    textMuted = Color(0x66E8EEF8),
    success = Color(0xFF44D882),
    successSoft = Color(0x1F44D882),
    danger = Color(0xFFFF5555),
    dangerSoft = Color(0x1FFF5555),
    warmOrange = Color(0xFFF07840),
    warmOrangeSoft = Color(0x26F07840),
    gold = Color(0xFFE8C84A),
    goldSoft = Color(0x26E8C84A),
    skyBlue = Color(0xFF1A2B52),
    peach = Color(0x26F07840),
)

val LocalPorchivoColors = staticCompositionLocalOf { LightPorchivoColors }
