//
//  SecurityModifiers.swift
//  Porchivo
//
//  Reusable SwiftUI view modifiers for biometric data protection:
//  - `privacyShield()`: Blurs content when the app enters the app switcher
//    or loses foreground focus, preventing sensitive package data from
//    appearing in screenshots or the multitasking view.
//  - `biometricGuard(reason:)`: Presents a biometric lock overlay on a
//    sensitive screen if the user hasn't authenticated within the
//    re-auth window. Re-prompts automatically after timeout.
//

import SwiftUI

// MARK: - PrivacyShield

/// Blurs the attached view when the scene phase is not `.active`.
/// This prevents package/shipment data from being visible in the iOS
/// app switcher snapshot or screenshots taken while backgrounded.
struct PrivacyShield: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase
    @State private var isShielded = false

    func body(content: Content) -> some View {
        content
            .overlay {
                if isShielded {
                    ZStack {
                        Rectangle()
                            .fill(Color(.systemBackground))
                            .ignoresSafeArea()
                        VStack(spacing: 14) {
                            Image(systemName: "lock.shield.fill")
                                .font(.system(size: 44, weight: .semibold))
                                .foregroundStyle(.secondary)
                            Text("Porchivo")
                                .font(.system(size: 22, weight: .black))
                                .foregroundStyle(.primary)
                            Text("Content protected")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .transition(.opacity)
                }
            }
            .onChange(of: scenePhase) { _, newPhase in
                withAnimation(.easeInOut(duration: 0.15)) {
                    isShielded = newPhase != .active
                }
            }
    }
}

extension View {
    /// Applies a privacy shield that hides content when the app is not
    /// in the foreground (app switcher, control center, etc.).
    func privacyShield() -> some View {
        modifier(PrivacyShield())
    }
}

// MARK: - BiometricGuard

/// Overlay modifier that gates a sensitive screen behind biometric
/// re-authentication. If `AppState.needsReauthForSensitiveContent` is
/// true, a lock overlay is shown with a biometric prompt. On success,
/// the overlay dismisses and the content is revealed.
struct BiometricGuard: ViewModifier {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    let reason: String

    @State private var isUnlocked = false
    @State private var isAuthenticating = false
    @State private var didFail = false
    @State private var hasPrompted = false

    func body(content: Content) -> some View {
        content
            .overlay {
                if shouldShowLock {
                    lockOverlay
                }
            }
            .task {
                guard !hasPrompted else { return }
                hasPrompted = true
                if shouldShowLock {
                    try? await Task.sleep(for: .seconds(0.3))
                    await attemptUnlock()
                } else {
                    isUnlocked = true
                }
            }
    }

    private var shouldShowLock: Bool {
        guard appState.biometricUnlockEnabled,
              appState.availableBiometry != .none else {
            return false
        }
        if isUnlocked && !appState.needsReauthForSensitiveContent {
            return false
        }
        return appState.needsReauthForSensitiveContent || !isUnlocked
    }

    private var lockOverlay: some View {
        ZStack {
            c.background.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(c.accentSoft)
                        .frame(width: 96, height: 96)
                    Image(systemName: appState.availableBiometry.systemImage)
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(c.accent)
                }

                VStack(spacing: 8) {
                    Text("Authenticate to view")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text("This contains sensitive delivery information.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.center)
                }

                PrimaryButton(
                    title: isAuthenticating ? "Verifying…" : appState.availableBiometry.unlockVerb,
                    systemImage: isAuthenticating ? nil : appState.availableBiometry.systemImage,
                    isLoading: isAuthenticating,
                    action: { Task { await attemptUnlock() } },
                    enabled: !isAuthenticating
                )
                .padding(.horizontal, 40)

                if didFail {
                    Text("\(appState.availableBiometry.label) didn't recognize you. Try again.")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(c.danger)
                        .multilineTextAlignment(.center)
                        .transition(.opacity)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity)
        }
        .transition(.opacity)
        .animation(.easeInOut(duration: 0.2), value: shouldShowLock)
    }

    @MainActor
    private func attemptUnlock() async {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }

        let ok = await appState.performBiometricReauth(reason: reason)
        if ok {
            withAnimation {
                isUnlocked = true
                didFail = false
            }
        } else {
            withAnimation { didFail = true }
        }
    }
}

extension View {
    /// Gates the view behind a biometric re-authentication overlay.
    /// Use on screens that display sensitive package or shipment data.
    /// The guard respects the user's biometric-unlock preference and only
    /// prompts if the re-auth window has expired.
    func biometricGuard(reason: String) -> some View {
        modifier(BiometricGuard(reason: reason))
    }
}
