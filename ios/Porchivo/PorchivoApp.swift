//
//  PorchivoApp.swift
//  Porchivo
//
//  Entry point — wires the AppState, restores session, applies the theme,
//  and hosts the root auth switch.
//

import SwiftUI

@main
struct PorchivoApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(appState.darkThemeOverride == true ? .dark
                                      : appState.darkThemeOverride == false ? .light
                                      : nil)
                .tint(.porchivoAccent)
                .task { await appState.restoreSession() }
        }
    }
}

private extension Color {
    static var porchivoAccent: Color { Color(hex: 0x3A7BD5) }
}
