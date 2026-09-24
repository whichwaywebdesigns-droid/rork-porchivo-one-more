//
//  BackNavigation.swift
//  Porchivo
//
//  Prominent, elderly-friendly back navigation for every pushed screen.
//  Applied centrally in RouteView so all post-login destinations get a
//  large, clearly-labeled "Back" button instead of the small system
//  chevron — guaranteeing an obvious way to backtrack.
//

import SwiftUI

struct PorchivoBackButtonModifier: ViewModifier {
    @Binding var path: NavigationPath
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss
    @State private var lastPopAt = Date.distantPast

    func body(content: Content) -> some View {
        content
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        goBack()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 19, weight: .bold))
                            Text("Back")
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(.rect)
                    }
                    .foregroundStyle(c.accent)
                    .accessibilityLabel("Go back")
                    .accessibilityHint("Returns to the previous screen")
                }
            }
    }

    private func goBack() {
        // Debounce so a double-tap can't pop two screens at once.
        let now = Date()
        guard now.timeIntervalSince(lastPopAt) > 0.4 else { return }
        lastPopAt = now
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if path.count > 0 {
            path.removeLast()
        } else {
            dismiss()
        }
    }
}
