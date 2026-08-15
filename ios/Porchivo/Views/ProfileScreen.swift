//
//  ProfileScreen.swift
//  Porchivo
//
//  Account tab — avatar, stats, settings links, edit profile, sign out.
//  No IAP/subscription section. Free users see a "Join Your Community"
//  section with invitation code entry and B2B signup link. Community
//  users see their org membership card.
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
                    statsRow
                    if appState.isOrgMember {
                        orgMembershipCard
                    } else {
                        joinCommunityCard
                    }
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

    // MARK: - Org membership card (Community tier)

    private var orgMembershipCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(c.accentSoft)
                Image(systemName: "building.2.fill")
                    .foregroundStyle(c.accent)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(appState.orgMembership?.orgName ?? "Your Community")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Connected · \(appState.orgMembership?.role.capitalized ?? "Resident")")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            Pill(text: "Community", tint: c.success, softTint: c.successSoft)
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    // MARK: - Join Your Community (Free tier)

    private var joinCommunityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(spacing: 6) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(c.accentSoft)
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(c.accent)
                    }
                    .frame(width: 40, height: 40)
                    Text("Join Your Community")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Spacer()
                }
                Text("Your community may already be on Porchivo. If your HOA, condo association, or property manager uses Porchivo, ask them to send you an invitation. Once you accept, you'll get access to announcements, dues payments, documents, maintenance requests, and more — at no cost to you.")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 8) {
                Button(action: { Haptics.light(); path.append(Route.orgSignup) }) {
                    HStack(spacing: 8) {
                        Image(systemName: "building.2.badge.gearshape.fill")
                            .font(.system(size: 14, weight: .bold))
                        Text("I Manage a Community — Sign Up Here")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(c.onAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(c.accent, in: .rect(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)

                Button(action: {
                    Haptics.light()
                    if let url = URL(string: "mailto:support@porchivo.com?subject=Request%20Community%20Invitation") {
                        UIApplication.shared.open(url)
                    }
                }) {
                    Text("Request an Invitation")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    // MARK: - Links section

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
