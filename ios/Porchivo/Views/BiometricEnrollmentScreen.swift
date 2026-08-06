//
//  BiometricEnrollmentScreen.swift
//  Porchivo
//
//  Post-auth enrollment prompt — shown after a fresh magic-link login when
//  the device supports biometrics and the user hasn't already enabled or
//  declined it. Prompts Face ID / Touch ID immediately; on success, enables
//  the biometric unlock constant gate for all future cold starts.
//

import SwiftUI

struct BiometricEnrollmentScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var isAuthenticating = false
    @State private var didSucceed = false
    @State private var lastFailed = false
    @State private var didAutoPrompt = false

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 28) {
                    Spacer().frame(minHeight: 36)
                    biometryIcon
                    headlineBlock
                    enrollButton
                    if lastFailed {
                        retryHint
                    }
                    skipButton
                    Spacer().frame(minHeight: 36)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
                .frame(maxWidth: .infinity)
            }
        }
        .task {
            guard !didAutoPrompt else { return }
            didAutoPrompt = true
            // Small delay so the transition settles before the system prompt.
            try? await Task.sleep(for: .seconds(0.4))
            await attemptEnroll()
        }
    }

    // MARK: - Subviews

    private var biometryIcon: some View {
        ZStack {
            Circle()
                .fill(c.accentSoft)
                .frame(width: 100, height: 100)
            if didSucceed {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(c.success)
                    .transition(.scale.combined(with: .opacity))
            } else {
                Image(systemName: appState.availableBiometry.systemImage)
                    .font(.system(size: 42, weight: .semibold))
                    .foregroundStyle(c.accent)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.5), value: didSucceed)
    }

    private var headlineBlock: some View {
        VStack(spacing: 10) {
            Text(didSucceed ? "Quick unlock enabled" : "Enable \(appState.availableBiometry.label)")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(c.textPrimary)
            Text(didSucceed
                 ? "You'll use \(appState.availableBiometry.label) to unlock Porchivo every time you open the app."
                 : "Secure your account with \(appState.availableBiometry.label). You'll unlock Porchivo with a quick glance or touch — no password needed.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var enrollButton: some View {
        PrimaryButton(
            title: isAuthenticating ? "Verifying…" : (didSucceed ? "Continue" : appState.availableBiometry.unlockVerb),
            systemImage: didSucceed ? "arrow.right.circle.fill" : appState.availableBiometry.systemImage,
            isLoading: isAuthenticating,
            action: {
                if didSucceed {
                    Task { await appState.completeBiometricEnrollment() }
                } else {
                    Task { await attemptEnroll() }
                }
            },
            enabled: !isAuthenticating
        )
    }

    private var retryHint: some View {
        Text("\(appState.availableBiometry.label) didn't recognize you. Try again or skip for now.")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(c.danger)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .transition(.opacity)
    }

    private var skipButton: some View {
        Button {
            Haptics.selection()
            appState.skipBiometricEnrollment()
        } label: {
            Text("Skip for now")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.textSecondary)
        }
    }

    // MARK: - Enroll attempt

    @MainActor
    private func attemptEnroll() async {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }

        // Enabling biometric unlock runs the system prompt immediately.
        let result = await appState.setBiometricUnlockEnabled(true)
        if result {
            withAnimation {
                didSucceed = true
                lastFailed = false
            }
        } else {
            withAnimation { lastFailed = true }
        }
    }
}

#Preview {
    BiometricEnrollmentScreen()
        .environment(AppState())
}
