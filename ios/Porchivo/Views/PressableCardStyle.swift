//
//  PressableCardStyle.swift
//  Porchivo
//
//  Premium press feedback for tappable cards and rows: a soft spring
//  scale-down with a slight dim while pressed, plus a light haptic tick
//  on press. Applied via `.buttonStyle(PressableCardStyle())`.
//

import SwiftUI

/// Button style giving any tappable card the app-wide "press" feel.
struct PressableCardStyle: ButtonStyle {
    var pressedScale: CGFloat = 0.97

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? pressedScale : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.75), value: configuration.isPressed)
            .sensoryFeedback(trigger: configuration.isPressed) { _, isPressed in
                isPressed ? .impact(weight: .light) : nil
            }
    }
}
