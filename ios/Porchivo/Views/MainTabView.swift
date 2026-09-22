//
//  MainTabView.swift
//  Porchivo
//
//  Unified bottom bar — every user gets the same 4 tabs (Home, Payments,
//  Requests, More) so the app reads as one product across tiers. Free-tier
//  surfaces stay reachable: My Deliveries lives under More, Porch Partner
//  via the Create flow, Account via More > Settings.
//

import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var selection = 0

    var body: some View {
        communityTabs
            .tint(c.accent)
            .sensoryFeedback(.selection, trigger: selection)
    }

    // MARK: - Tabs

    // Re-tapping the current tab pops its embedded navigation stack to the
    // root natively on iOS 18+ — no custom reselect detection needed.
    private var communityTabs: some View {
        TabView(selection: $selection) {
            HomeScreen()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)

            PaymentsScreen()
                .tabItem { Label("Payments", systemImage: "creditcard.fill") }
                .tag(1)

            RequestsScreen()
                .tabItem { Label("Requests", systemImage: "wrench.and.screwdriver.fill") }
                .tag(2)

            MoreScreen()
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
                .tag(3)
        }
    }
}
