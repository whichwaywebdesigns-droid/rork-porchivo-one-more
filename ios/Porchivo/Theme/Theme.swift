//
//  Theme.swift
//  Porchivo
//
//  Porchivo brand palette, spacing/radius tokens, and SwiftUI helpers.
//  Mirrors expo/constants/theme.ts and android/.../PorchivoColors.kt.
//

import SwiftUI

/// Porchivo brand palette. Same hex values as the Expo/Android tokens so
/// the native app reads as the same product across platforms.
struct PorchivoPalette {
    let background: Color
    let surface: Color
    let elevated: Color
    let border: Color
    let accent: Color
    let accentSoft: Color
    let onAccent: Color
    let textPrimary: Color
    let textSecondary: Color
    let textMuted: Color
    let success: Color
    let successSoft: Color
    let danger: Color
    let dangerSoft: Color
    let warmOrange: Color
    let warmOrangeSoft: Color
    let gold: Color
    let goldSoft: Color
    let skyBlue: Color
    let peach: Color
}

extension PorchivoPalette {
    static let light = PorchivoPalette(
        background: Color(hex: 0xF5F7FA),
        surface: Color(hex: 0xFFFFFF),
        elevated: Color(hex: 0xEBF0F8),
        border: Color(hex: 0xD8E4F0),
        accent: Color(hex: 0x3A7BD5),
        accentSoft: Color(hex: 0x3A7BD5).opacity(0.10),
        onAccent: Color(hex: 0xFFFFFF),
        textPrimary: Color(hex: 0x1A2B4A),
        textSecondary: Color(hex: 0x1A2B4A).opacity(0.55),
        textMuted: Color(hex: 0x1A2B4A).opacity(0.38),
        success: Color(hex: 0x1E9C6A),
        successSoft: Color(hex: 0x1E9C6A).opacity(0.10),
        danger: Color(hex: 0xE5484D),
        dangerSoft: Color(hex: 0xE5484D).opacity(0.10),
        warmOrange: Color(hex: 0xE8622A),
        warmOrangeSoft: Color(hex: 0xE8622A).opacity(0.10),
        gold: Color(hex: 0xC8941E),
        goldSoft: Color(hex: 0xFFF8E6),
        skyBlue: Color(hex: 0xEBF2FF),
        peach: Color(hex: 0xFFF0E6)
    )

    static let dark = PorchivoPalette(
        background: Color(hex: 0x0D1B3E),
        surface: Color(hex: 0x132040),
        elevated: Color(hex: 0x1A2B52),
        border: Color(hex: 0x1E2F58),
        accent: Color(hex: 0x4A8FE8),
        accentSoft: Color(hex: 0x4A8FE8).opacity(0.15),
        onAccent: Color(hex: 0xFFFFFF),
        textPrimary: Color(hex: 0xE8EEF8),
        textSecondary: Color(hex: 0xE8EEF8).opacity(0.65),
        textMuted: Color(hex: 0xE8EEF8).opacity(0.40),
        success: Color(hex: 0x44D882),
        successSoft: Color(hex: 0x44D882).opacity(0.12),
        danger: Color(hex: 0xFF5555),
        dangerSoft: Color(hex: 0xFF5555).opacity(0.12),
        warmOrange: Color(hex: 0xF07840),
        warmOrangeSoft: Color(hex: 0xF07840).opacity(0.15),
        gold: Color(hex: 0xE8C84A),
        goldSoft: Color(hex: 0xE8C84A).opacity(0.15),
        skyBlue: Color(hex: 0x1A2B52),
        peach: Color(hex: 0xF07840).opacity(0.15)
    )
}

/// Spacing + radius tokens (matches Expo's space/radius scale).
enum Space {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let xxxl: CGFloat = 32
}

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let pill: CGFloat = 999
}

/// Environment key + property so any view can read the active palette.
private struct PorchivoPaletteKey: EnvironmentKey {
    static let defaultValue: PorchivoPalette = .light
}

extension EnvironmentValues {
    var porchivo: PorchivoPalette {
        get { self[PorchivoPaletteKey.self] }
        set { self[PorchivoPaletteKey.self] = newValue }
    }
}

/// Convenience: `@Environment(\.porchivo) var c` then `c.accent`.
extension View {
    /// Applies the Porchivo palette for the current color scheme and injects it
    /// into the environment so descendants can read it via `\.porchivo`.
    func porchivoTheme(_ scheme: ColorScheme) -> some View {
        environment(\.porchivo, scheme == .dark ? .dark : .light)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}
