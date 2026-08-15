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
    }

    // MARK: - Free Tier (3 tabs)

    private var freeTabs: some View {
        TabView(selection: $selection) {
            HomeScreen()
                .tabItem { Label("Deliveries", systemImage: "shippingbox.fill") }
                .tag(0)

            PorchPartnerScreen()
                .tabItem { Label("Porch Partner", systemImage: "hand.raised.fill") }
                .tag(1)

            ProfileScreen()
                .tabItem { Label("Account", systemImage: "person.fill") }
                .tag(2)
        }
    }

    // MARK: - Community Tier (4 tabs)

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
