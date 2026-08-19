//
//  PorchivoApp.swift
//  Porchivo
//
//  Entry point — wires the AppState, restores session, applies the theme,
//  and hosts the root auth switch.
//

import SwiftUI
import UserNotifications

@main
struct PorchivoApp: App {
    @UIApplicationDelegateAdaptor(PorchivoAppDelegate.self) private var appDelegate
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(appState.darkThemeOverride == true ? .dark
                                      : appState.darkThemeOverride == false ? .light
                                      : nil)
                .tint(.porchivoAccent)
                .privacyShield()
        .task {
                    await appState.restoreSession()
                }
                .onAppear {
                    appDelegate.appState = appState
                }
                .onChange(of: appState.isAuthenticated) { _, isAuthenticated in
                    if isAuthenticated {
                        appDelegate.appState = appState
                    }
                }
        }
    }
}

private extension Color {
    static var porchivoAccent: Color { Color(hex: 0x3A7BD5) }
}
