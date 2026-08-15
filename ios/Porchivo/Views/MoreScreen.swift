//
//  MoreScreen.swift
//  Porchivo
//
//  Community tier hub — package tracking (My Deliveries), announcements,
//  calendar, maintenance, directory, account, and admin tools.
//

import SwiftUI

struct MoreScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    myDeliveriesSection
                    communitySection
                    accountSection
                    if appState.isOrgAdmin {
                        adminSection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("More")
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
        }
    }

    // MARK: - My Deliveries

    private var myDeliveriesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("My Deliveries")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            if appState.packages.isEmpty {
                EmptyState(
                    symbol: "shippingbox.fill",
                    title: "No packages tracked",
                    message: "Add a package to start tracking deliveries.",
                    ctaLabel: "Add package"
                ) { path.append(Route.addPackage) }
            } else {
                ForEach(appState.packages.prefix(3)) { pkg in
                    NavigationLink(value: Route.packageDetail(pkg.id)) {
                        packageRow(pkg)
                    }
                    .buttonStyle(.plain)
                }
                if appState.packages.count > 3 {
                    NavigationLink(value: Route.create) {
                        Text("See all \(appState.packages.count) packages")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(c.accent)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func packageRow(_ pkg: TrackedPackage) -> some View {
        HStack(spacing: 12) {
            Image(systemName: pkg.carrier.sfSymbol)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(c.accent)
                .frame(width: 36, height: 36)
                .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))
            VStack(alignment: .leading, spacing: 2) {
                Text(pkg.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.textPrimary)
                    .lineLimit(1)
                Text(pkg.currentStatus.label)
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(c.textMuted)
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
    }

    // MARK: - Community

    private var communitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Community")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            VStack(spacing: 0) {
                linkRow("Announcements", "megaphone.fill", c.warmOrange) { }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Calendar", "calendar.fill", c.accent) { }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Maintenance", "wrench.and.screwdriver.fill", c.success) { }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Resident Directory", "person.3.fill", c.accent) {
                    path.append(Route.residentDirectory)
                }
            }
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Account")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            VStack(spacing: 0) {
                linkRow("Settings", "gearshape.fill", c.textMuted) { path.append(Route.settings) }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Edit Profile", "person.crop.circle.fill", c.accent) { path.append(Route.editProfile) }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Safety Score", "shield.lefthalf.filled", c.warmOrange) { path.append(Route.safety) }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Support", "questionmark.circle.fill", c.success) {
                    if let url = URL(string: "mailto:\(AppConfig.Support.email)") {
                        UIApplication.shared.open(url)
                    }
                }
            }
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
    }

    // MARK: - Admin

    private var adminSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Admin Tools")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            VStack(spacing: 0) {
                linkRow("Manage Subscription", "creditcard.fill", c.gold) { }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Invite Code", "ticket.fill", c.accent) { }
                Divider().overlay(c.border).padding(.leading, 54)
                linkRow("Pending Members", "person.badge.clock", c.warmOrange) { }
            }
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
    }

    // MARK: - Helper

    private func linkRow(_ label: String, _ symbol: String, _ tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.selection(); action() }) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: 28)
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(c.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(c.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    MoreScreen().environment(AppState())
}
