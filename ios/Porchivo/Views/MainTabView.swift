//
//  MainTabView.swift
//  Porchivo
//
//  5-tab TabView matching Expo/Android. Each tab hosts a NavigationStack so
//  detail screens push within the tab. Glass material on the bar (iOS 26) or
//  ultraThinMaterial fallback.
//

import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var selection = 0

    var body: some View {
        TabView(selection: $selection) {
            HomeScreen()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)

            PackagesScreen()
                .tabItem { Label("Packages", systemImage: "shippingbox.fill") }
                .tag(1)

            CreateScreen()
                .tabItem { Label("Create", systemImage: "plus.circle.fill") }
                .tag(2)

            ActivityScreen()
                .tabItem {
                    Label("Activity", systemImage: "clock.fill")
                        .badge(appState.unreadCount)
                }
                .tag(3)

            ProfileScreen()
                .tabItem {
                    Label(appState.tier == .free ? "Go Pro" : "Profile", systemImage: "person.fill")
                }
                .tag(4)
        }
        .tint(c.accent)
    }
}
