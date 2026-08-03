//
//  CreateScreen.swift
//  Porchivo
//
//  Create tab — action menu: log a package, file a porch incident, post a
//  block announcement. Routes into the relevant flow.
//

import SwiftUI

struct CreateScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()
    @State private var showAnnouncement = false
    @State private var announcementText = ""
    @State private var announcementPosted = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Create")
                            .font(.system(size: 26, weight: .black))
                            .foregroundStyle(c.textPrimary)
                        Text("Log activity for your block or building.")
                            .font(.system(size: 13))
                            .foregroundStyle(c.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    actionCard(
                        "Log a package",
                        "Track an incoming delivery and score porch risk.",
                        "shippingbox.fill", c.accent, c.accentSoft
                    ) { path.append(Route.addPackage) }

                    actionCard(
                        "File a porch incident",
                        "Report a theft or suspicious activity to warn neighbors.",
                        "exclamationmark.shield.fill", c.danger, c.dangerSoft
                    ) { path.append(Route.safety) }

                    actionCard(
                        "Post a block announcement",
                        "Send a note to everyone in your building or block.",
                        "megaphone.fill", c.warmOrange, c.warmOrangeSoft
                    ) {
                        Haptics.light()
                        showAnnouncement = true
                    }

                    actionCard(
                        "Become a Porch Partner",
                        "Hold packages for neighbors and earn $80–$250/mo.",
                        "dollarsign.circle.fill", c.success, c.successSoft
                    ) {
                        if let url = URL(string: AppConfig.Support.websiteURL + "/partner") {
                            UIApplication.shared.open(url)
                        }
                    }
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
            .sheet(isPresented: $showAnnouncement) {
                announcementSheet
            }
        }
    }

    private func actionCard(_ title: String, _ blurb: String, _ symbol: String,
                            _ tint: Color, _ soft: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radius.md).fill(soft)
                    Image(systemName: symbol)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(tint)
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text(blurb)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(c.textMuted)
            }
            .padding(Space.md)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }

    private var announcementSheet: some View {
        VStack(spacing: 16) {
            Text("Post a block announcement")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)
            TextEditor(text: $announcementText)
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .padding(8)
                .background(c.elevated, in: .rect(cornerRadius: Radius.md))
                .frame(minHeight: 140)
            if announcementPosted {
                Label("Posted to your block", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(c.success)
                    .font(.system(size: 13, weight: .semibold))
            }
            Spacer()
            PrimaryButton(title: "Post announcement", systemImage: "megaphone.fill",
                          enabled: !announcementText.isEmpty) {
                Haptics.success()
                announcementPosted = true
                announcementText = ""
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    showAnnouncement = false
                    announcementPosted = false
                }
            }
        }
        .padding(20)
        .presentationDetents([.medium])
    }
}

#Preview {
    CreateScreen().environment(AppState())
}
