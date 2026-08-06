//
//  RoleSelectionScreen.swift
//  Porchivo
//
//  Role selection step in the onboarding chain. The user picks whether they
//  will receive help on their porch, help neighbors, or both.
//

import SwiftUI

struct RoleSelectionScreen: View {
    @Environment(\.porchivo) private var c
    let onContinue: (UserRole) -> Void
    let onSkip: () -> Void

    @State private var selectedRole: UserRole = .homeowner

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 14) {
                Text("How do you want to use Porchivo?")
                    .font(.system(size: 28, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Pick the role that fits you. You can change this anytime in settings.")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 24)

            Spacer().frame(height: 40)

            VStack(spacing: 14) {
                roleCard(
                    role: .homeowner,
                    title: "Homeowner",
                    subtitle: "Get packages protected by neighbors you trust.",
                    icon: "house.fill"
                )
                roleCard(
                    role: .partner,
                    title: "Porch Partner",
                    subtitle: "Hold deliveries for neighbors and earn on your schedule.",
                    icon: "shippingbox.fill"
                )
                roleCard(
                    role: .both,
                    title: "Both",
                    subtitle: "Protect your own porch and help neighbors protect theirs.",
                    icon: "arrow.left.arrow.right.circle.fill"
                )
            }
            .padding(.horizontal, 24)

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton(title: "Continue", systemImage: "arrow.right") {
                    Haptics.light()
                    onContinue(selectedRole)
                }

                Button("Skip for now") {
                    Haptics.selection()
                    onSkip()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(c.background.ignoresSafeArea())
    }

    private func roleCard(role: UserRole, title: String, subtitle: String, icon: String) -> some View {
        let selected = selectedRole == role
        return Button {
            Haptics.selection()
            selectedRole = role
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(selected ? c.accent : c.elevated)
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(selected ? c.onAccent : c.textMuted)
                }
                .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(selected ? c.accent : c.border)
            }
            .padding(16)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .stroke(selected ? c.accent : c.border, lineWidth: selected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    RoleSelectionScreen(onContinue: { _ in }, onSkip: {})
        .environment(AppState())
}
