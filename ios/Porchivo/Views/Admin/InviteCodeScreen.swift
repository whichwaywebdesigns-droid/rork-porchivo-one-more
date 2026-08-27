//
//  InviteCodeScreen.swift
//  Porchivo
//
//  Admin tool — displays the community invite code, lets admins copy,
//  share, or regenerate it. Regeneration calls the `regenerate_org_invite_code`
//  RPC (admin-only server-side) and invalidates the old code immediately.
//

import SwiftUI

struct InviteCodeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var details: SupabaseService.OrgAdminDetails? = nil
    @State private var code: String = ""
    @State private var isLoading = true
    @State private var loadError: String? = nil
    @State private var isRegenerating = false
    @State private var showRegenerateConfirm = false
    @State private var copied = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if isLoading {
                    ProgressView()
                        .padding(.vertical, 48)
                } else if let loadError {
                    EmptyState(
                        symbol: "wifi.exclamationmark",
                        title: "Couldn't load invite code",
                        message: loadError,
                        ctaLabel: "Try again"
                    ) { Task { await load() } }
                } else {
                    codeCard
                    howItWorksCard
                    regenerateSection
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Invite Code")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .confirmationDialog(
            "Generate a new code?",
            isPresented: $showRegenerateConfirm,
            titleVisibility: .visible
        ) {
            Button("Generate new code", role: .destructive) {
                Task { await regenerate() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The current code stops working immediately. Residents who already have it won't be able to join.")
        }
        .alert("Couldn't generate a new code", isPresented: Binding(
            get: { loadError != nil && !code.isEmpty },
            set: { _ in }
        )) {
            Button("OK", role: .cancel) {}
        }
    }

    // MARK: - Code card

    private var orgName: String {
        details?.name ?? appState.orgMembership?.orgName ?? "Your community"
    }

    private var codeCard: some View {
        VStack(spacing: 14) {
            Text(orgName.uppercased())
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(c.textMuted)
                .tracking(1.5)

            Text(code.isEmpty ? "—" : code)
                .font(.system(size: 30, weight: .heavy, design: .monospaced))
                .foregroundStyle(c.textPrimary)
                .kerning(5)
                .lineLimit(1)
                .minimumScaleFactor(0.5)

            Text("Residents enter this code to join your community.")
                .font(.system(size: 12))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 10) {
                Button {
                    copyCode()
                } label: {
                    Label(
                        copied ? "Copied!" : "Copy",
                        systemImage: copied ? "checkmark.circle.fill" : "doc.on.doc.fill"
                    )
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.onAccent)
                    .padding(.horizontal, 18)
                    .frame(height: 40)
                    .background(copied ? c.success : c.accent, in: Capsule())
                }

                ShareLink(item: shareMessage) {
                    Label("Share", systemImage: "square.and.arrow.up.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(c.accent)
                        .padding(.horizontal, 18)
                        .frame(height: 40)
                        .background(c.accentSoft, in: Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(c.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        .foregroundStyle(c.border)
                )
        )
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private var shareMessage: String {
        "Join \(orgName) on Porchivo! Download the app and use invite code \(code) to get started."
    }

    // MARK: - How it works

    private var howItWorksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How joining works")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(c.textPrimary)

            stepRow(1, "square.and.arrow.up", "Share this code with your residents")
            stepRow(2, "iphone", "They download Porchivo and sign up")
            stepRow(3, "person.badge.clock", "You approve their request in Pending Members")

            Text("Approvals keep your directory accurate — only residents you recognize get Community features like announcements, chat, and the delivery log.")
                .font(.system(size: 12))
                .foregroundStyle(c.textSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func stepRow(_ number: Int, _ symbol: String, _ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.accent)
                .frame(width: 28, height: 28)
                .background(c.accentSoft, in: .rect(cornerRadius: Radius.sm))
            Text(text)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(c.textPrimary)
            Spacer(minLength: 0)
        }
    }

    // MARK: - Regenerate

    private var regenerateSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Security")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            Button {
                showRegenerateConfirm = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(c.warmOrange)
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(isRegenerating ? "Generating…" : "Generate new code")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(c.textPrimary)
                        Text("Invalidates the current code")
                            .font(.system(size: 11))
                            .foregroundStyle(c.textMuted)
                    }
                    Spacer()
                }
                .padding(14)
            }
            .buttonStyle(.plain)
            .disabled(isRegenerating)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let orgId = appState.orgMembership?.orgId else {
            loadError = "You're not part of a community yet."
            isLoading = false
            return
        }
        isLoading = true
        loadError = nil
        switch await SupabaseService.shared.fetchOrgAdminDetails(orgId: orgId) {
        case .success(let fetched):
            details = fetched
            code = fetched?.inviteCode ?? ""
            if code.isEmpty { loadError = "This community doesn't have an invite code yet." }
        case .failure(let err):
            loadError = Self.friendlyMessage(err)
        }
        isLoading = false
    }

    private func copyCode() {
        UIPasteboard.general.string = code
        Haptics.success()
        withAnimation(.easeInOut(duration: 0.2)) { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.8))
            withAnimation(.easeInOut(duration: 0.2)) { copied = false }
        }
    }

    private func regenerate() async {
        guard let orgId = appState.orgMembership?.orgId else { return }
        isRegenerating = true
        switch await SupabaseService.shared.regenerateInviteCode(orgId: orgId) {
        case .success(let newCode):
            code = newCode
            Haptics.success()
        case .failure:
            loadError = "Could not generate a new code. Please try again."
            Haptics.error()
        }
        isRegenerating = false
    }

    nonisolated private static func friendlyMessage(_ err: Error) -> String {
        let ns = err as NSError
        let raw = ns.userInfo[NSLocalizedDescriptionKey] as? String ?? err.localizedDescription
        return raw.isEmpty || raw.contains("bad server response")
            ? "Something went wrong. Please try again."
            : raw
    }
}

#Preview {
    NavigationStack { InviteCodeScreen() }
        .environment(AppState())
}
