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

    /// TabView fires the selection setter on every tap — including re-taps of
    /// the already-selected tab — so equal-value writes record a reselect that
    /// pops the tab's stack back to its root (see TabReselectMonitor).
    private var selectionBinding: Binding<Int> {
        Binding(
            get: { selection },
            set: { newValue in
                if newValue == selection {
                    TabReselectMonitor.shared.recordReselect(newValue)
                }
                selection = newValue
            }
        )
    }

    var body: some View {
        communityTabs
            .tint(c.accent)
            .sensoryFeedback(.selection, trigger: selection)
    }

    // MARK: - Tabs

    private var communityTabs: some View {
        TabView(selection: selectionBinding) {
            HomeScreen()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)
                .environment(\.pvTabIndex, 0)

            PaymentsScreen()
                .tabItem { Label("Payments", systemImage: "creditcard.fill") }
                .tag(1)
                .environment(\.pvTabIndex, 1)

            RequestsScreen()
                .tabItem { Label("Requests", systemImage: "wrench.and.screwdriver.fill") }
                .tag(2)
                .environment(\.pvTabIndex, 2)

            MoreScreen()
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
                .tag(3)
                .environment(\.pvTabIndex, 3)
        }
    }
}
