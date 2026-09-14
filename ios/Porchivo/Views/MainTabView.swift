//
//  MainTabView.swift
//  Porchivo
//
//  Hybrid navigation — Free Tier (3 tabs: Deliveries, Porch Partner, Account)
//  vs Community Tier (4 tabs: Home, Payments, Requests, More).
//  Tier is determined by `appState.isOrgMember` (active org membership).
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
        Group {
            if appState.isOrgMember {
                communityTabs
            } else {
                freeTabs
            }
        }
        .tint(c.accent)
        .animation(.easeInOut(duration: 0.3), value: appState.isOrgMember)
        .sensoryFeedback(.selection, trigger: selection)
    }

    // MARK: - Free Tier (3 tabs)

    private var freeTabs: some View {
        TabView(selection: selectionBinding) {
            HomeScreen()
                .tabItem { Label("Deliveries", systemImage: "shippingbox.fill") }
                .tag(0)
                .environment(\.pvTabIndex, 0)

            PorchPartnerScreen()
                .tabItem { Label("Porch Partner", systemImage: "hand.raised.fill") }
                .tag(1)
                .environment(\.pvTabIndex, 1)

            ProfileScreen()
                .tabItem { Label("Account", systemImage: "person.fill") }
                .tag(2)
                .environment(\.pvTabIndex, 2)
        }
    }

    // MARK: - Community Tier (4 tabs)

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
