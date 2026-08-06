//
//  RootView.swift
//  Porchivo
//
//  Root auth switch — Loading → Login → Biometric Enrollment →
//  Unlock (cold start) → Onboarding (if needed) → Main TabView.
//

import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.colorScheme) private var systemScheme

    var body: some View {
        Group {
            switch appState.authState {
            case .loading:
                SplashView()
            case .unauthenticated, .error:
                LoginScreen()
            case .locked:
                UnlockScreen()
            case .authenticated(let userId):
                if appState.needsBiometricEnrollment {
                    BiometricEnrollmentScreen()
                } else if appState.isOnboarded || !appState.isSupabaseConfigured {
                    MainTabView()
                } else {
                    OnboardingFlowView()
                        .id(userId)
                }
            }
        }
        .porchivoTheme(systemScheme)
    }
}

private struct SplashView: View {
    @Environment(\.porchivo) private var c
    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            VStack(spacing: 16) {
                BrandLogoWithBox(logoSize: 80)
                Text("Porchivo")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(c.textPrimary)
                ProgressView()
                    .controlSize(.large)
                    .tint(c.accent)
            }
        }
    }
}

#Preview {
    RootView()
        .environment(AppState())
}
