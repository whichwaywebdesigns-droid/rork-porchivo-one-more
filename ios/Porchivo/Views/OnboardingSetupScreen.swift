//
//  OnboardingSetupScreen.swift
//  Porchivo
//
//  Profile setup step in the onboarding chain: name, phone, address, and
//  location consent. Stores the profile via AppState so the user can enter
//  the main app with a complete profile.
//

import SwiftUI

struct OnboardingSetupScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    let role: UserRole
    let onContinue: () -> Void
    let onSkip: () -> Void

    @State private var name = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var locationConsent = false
    @State private var isSaving = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 14) {
                    Text("Set up your profile")
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(c.textPrimary)
                        .multilineTextAlignment(.center)

                    Text("This is how neighbors and delivery partners will find and verify you.")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)

                Spacer().frame(height: 32)

                VStack(spacing: 14) {
                    field("Full name", text: \$name, symbol: "person.fill", keyboard: .default)
                    field("Phone number", text: \$phone, symbol: "phone.fill", keyboard: .phonePad)
                    field("Street address", text: \$address, symbol: "mappin.and.ellipse", keyboard: .default)
                }
                .padding(.horizontal, 24)

                Spacer().frame(height: 24)

                consentCard
                    .padding(.horizontal, 24)

                Spacer().frame(height: 40)

                VStack(spacing: 12) {
                    PrimaryButton(
                        title: "Finish setup",
                        systemImage: "arrow.right",
                        isLoading: isSaving,
                        enabled: canContinue
                    ) {
                        saveAndContinue()
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
        }
        .background(c.background.ignoresSafeArea())
    }

    private var canContinue: Bool {
        !name.isEmpty && !address.isEmpty
    }

    private func field(_ label: String, text: Binding<String>, symbol: String,
                       keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            HStack(spacing: 10) {
                Image(systemName: symbol).foregroundStyle(c.textMuted)
                TextField("", text: text)
                    .font(.system(size: 15))
                    .foregroundStyle(c.textPrimary)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(keyboard == .phonePad ? .never : .words)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
        }
    }

    private var consentCard: some View {
        Button {
            Haptics.selection()
            locationConsent.toggle()
        } label: {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: locationConsent ? "checkmark.square.fill" : "square")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(locationConsent ? c.accent : c.border)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Share approximate location")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text("Used only to match you with nearby porch partners and delivery windows. You can change this in settings.")
                        .font(.system(size: 13))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()
            }
            .padding(16)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .stroke(locationConsent ? c.accent : c.border, lineWidth: locationConsent ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func saveAndContinue() {
        guard canContinue else { return }
        Haptics.light()
        isSaving = true
        let n = name
        let p = phone
        let a = address
        let consent = locationConsent
        Task { @MainActor in
            defer { isSaving = false }
            // Save profile info without flipping is_onboarded so the rest of
            // the onboarding flow can still run.
            await appState.updateProfileInfo(
                name: n,
                phone: p,
                address: a,
                role: role,
                hasLocationConsent: consent
            )
            onContinue()
        }
    }
}

#Preview {
    OnboardingSetupScreen(role: .homeowner, onContinue: {}, onSkip: {})
        .environment(AppState())
}
