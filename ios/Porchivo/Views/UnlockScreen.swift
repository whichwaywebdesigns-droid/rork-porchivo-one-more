//
//  UnlockScreen.swift
//  Porchivo
//
//  Biometric gate shown when `authState == .locked`. Presents a Face ID /
//  Touch ID prompt on appear and offers a "use password" fallback that signs
//  the user out and drops back to the login form.
//

import SwiftUI

struct UnlockScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var isAuthenticating = false
    @State private var lastFailed = false
    @State private var didAutoPrompt = false

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(minHeight: 40)
                    brandBlock
                    biometryButton
                    if lastFailed {
                        retryHint
                    }
                    usePasswordButton
                    Spacer().frame(minHeight: 40)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
                .frame(maxWidth: .infinity)
            }
        }
        .task {
            // Auto-prompt once on appear — matches the Expo auto-trigger behavior.
            guard !didAutoPrompt else { return }
            didAutoPrompt = true
            await attemptUnlock()
        }
    }

    private var brandBlock: some View {
        VStack(spacing: 14) {
            BrandLogoWithBox(logoSize: 80)
            Text("Porchivo")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(c.textPrimary)
            Text("Unlock to continue to your porch")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var biometryButton: some View {
        PrimaryButton(
            title: isAuthenticating ? "Verifying…" : appState.availableBiometry.unlockVerb,
            systemImage: isAuthenticating ? nil : appState.availableBiometry.systemImage,
            isLoading: isAuthenticating,
            action: { Task { await attemptUnlock() } },
            enabled: !isAuthenticating
        )
    }

    private var retryHint: some View {
        Text("\(appState.availableBiometry.label) didn't recognize you. Try again or use your password.")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(c.danger)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .transition(.opacity)
    }

    private var usePasswordButton: some View {
        Button {
            Haptics.selection()
            Task { await appState.signOut() }
        } label: {
            Text("Use password instead")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.accent)
        }
    }

    @MainActor
    private func attemptUnlock() async {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }
        let ok = await appState.performBiometricUnlock()
        if !ok {
            withAnimation { lastFailed = true }
        } else {
            withAnimation { lastFailed = false }
        }
    }
}

#Preview {
    UnlockScreen()
        .environment(AppState())
}
