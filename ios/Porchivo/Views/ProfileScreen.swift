//
//  ProfileScreen.swift
//  Porchivo
//
//  Profile tab — avatar, tier badge, stats, settings links, edit profile,
//  sign out.
//

import SwiftUI

struct ProfileScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()
    @State private var showSignOut = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    header
                    tierCard
                    statsRow
                    linksSection
                    signOutButton
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
            .confirmationDialog("Sign out of Porchivo?", isPresented: $showSignOut) {
                Button("Sign out", role: .destructive) {
                    Haptics.medium()
                    Task { await appState.signOut() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            AvatarBubble(name: appState.user?.name ?? "Porchivo User",
                         avatarUrl: appState.user?.avatarUrl, size: 88)
            VStack(spacing: 2) {
                Text(appState.user?.name ?? "Porchivo User")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(c.textPrimary)
                Text(appState.user?.email ?? "")
                    .font(.system(size: 13))
                    .foregroundStyle(c.textSecondary)
            }
            NavigationLink(value: Route.editProfile) {
                Text("Edit profile")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.accent)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(c.accentSoft, in: .rect(cornerRadius: Radius.sm))
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var tierCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(appState.tier == .free ? c.elevated : c.goldSoft)
                Image(systemName: appState.tier == .free ? "person.fill" : "crown.fill")
                    .foregroundStyle(appState.tier == .free ? c.textMuted : c.gold)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(appState.tier.label)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text(appState.tier == .free ? "Unlock unlimited tracking & alerts" : "Thanks for supporting Porchivo")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            if appState.tier == .free {
                NavigationLink(value: Route.upgrade) {
                    Text("Upgrade")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(c.onAccent)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(c.accent, in: .rect(cornerRadius: Radius.sm))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            stat(appState.shipments.count, "Shipments")
            stat(appState.packages.count, "Packages")
            stat(appState.unreadCount, "Unread")
        }
    }

    private func stat(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(c.accent)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(c.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .shadow(color: c.textPrimary.opacity(0.04), radius: 4, y: 2)
    }

    private var linksSection: some View {
        VStack(spacing: 0) {
            linkRow("Settings", "gearshape.fill", c.textMuted) { path.append(Route.settings) }
            divider
            linkRow("Resident Directory", "person.3.fill", c.accent) { path.append(Route.residentDirectory) }
            divider
            linkRow("Safety Score", "shield.lefthalf.filled", c.warmOrange) { path.append(Route.safety) }
            divider
            linkRow("Support", "questionmark.circle.fill", c.success) {
                if let url = URL(string: "mailto:\(AppConfig.Support.email)") {
                    UIApplication.shared.open(url)
                }
            }
            divider
            linkRow("Privacy Policy", "lock.shield.fill", c.textMuted) {
                if let url = URL(string: AppConfig.Support.privacyPolicyURL) {
                    UIApplication.shared.open(url)
                }
            }
        }
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

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

    private var divider: some View {
        Divider().overlay(c.border).padding(.leading, 54)
    }

    private var signOutButton: some View {
        Button {
            Haptics.light()
            showSignOut = true
        } label: {
            Text("Sign out")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(c.danger)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(c.dangerSoft, in: .rect(cornerRadius: Radius.md))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    ProfileScreen().environment(AppState())
}
