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
    @Environment(\.scenePhase) private var scenePhase

    private var showSplashOverlay: Bool {
        appState.authState == .loading ||
            (appState.isAuthenticated && !appState.isReadyToShowUI)
    }

    var body: some View {
        ZStack {
            Group {
                switch appState.authState {
                case .loading:
                    EmptyView()
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

            SplashVideoView()
                .opacity(showSplashOverlay ? 1 : 0)
                .animation(.easeOut(duration: 0.45), value: showSplashOverlay)
                .allowsHitTesting(showSplashOverlay)
                .ignoresSafeArea()
                .zIndex(1)
        }
        .opacity(appState.languageManager.languageTransitioning ? 0 : 1)
        .animation(.easeInOut(duration: 0.2), value: appState.languageManager.languageTransitioning)
        .porchivoTheme(systemScheme)
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .background:
                appState.handleEnterBackground()
            case .active:
                Task { @MainActor in appState.handleEnterForeground() }
            case .inactive:
                appState.handleSceneInactive()
            @unknown default:
                break
            }
        }
    }
}

#Preview {
    RootView()
        .environment(AppState())
}
