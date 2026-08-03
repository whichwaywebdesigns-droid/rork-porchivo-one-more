package com.rork.porchivo.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private val LightColorScheme = lightColorScheme(
    primary = LightPorchivoColors.accent,
    onPrimary = LightPorchivoColors.onAccent,
    secondary = LightPorchivoColors.warmOrange,
    onSecondary = LightPorchivoColors.onAccent,
    tertiary = LightPorchivoColors.success,
    background = LightPorchivoColors.background,
    onBackground = LightPorchivoColors.textPrimary,
    surface = LightPorchivoColors.surface,
    onSurface = LightPorchivoColors.textPrimary,
    surfaceVariant = LightPorchivoColors.elevated,
    onSurfaceVariant = LightPorchivoColors.textSecondary,
    outline = LightPorchivoColors.border,
    outlineVariant = LightPorchivoColors.border,
    error = LightPorchivoColors.danger,
)

private val DarkColorScheme = darkColorScheme(
    primary = DarkPorchivoColors.accent,
    onPrimary = DarkPorchivoColors.onAccent,
    secondary = DarkPorchivoColors.warmOrange,
    onSecondary = DarkPorchivoColors.onAccent,
    tertiary = DarkPorchivoColors.success,
    background = DarkPorchivoColors.background,
    onBackground = DarkPorchivoColors.textPrimary,
    surface = DarkPorchivoColors.surface,
    onSurface = DarkPorchivoColors.textPrimary,
    surfaceVariant = DarkPorchivoColors.elevated,
    onSurfaceVariant = DarkPorchivoColors.textSecondary,
    outline = DarkPorchivoColors.border,
    outlineVariant = DarkPorchivoColors.border,
    error = DarkPorchivoColors.danger,
)

/** Accessor for the extended Porchivo palette from any composable. */
object PorchivoTheme {
    val colors: PorchivoColors
        @Composable get() = LocalPorchivoColors.current
}

@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val porchivoColors = if (darkTheme) DarkPorchivoColors else LightPorchivoColors
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(LocalPorchivoColors provides porchivoColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}
