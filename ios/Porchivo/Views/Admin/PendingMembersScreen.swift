//
//  PendingMembersScreen.swift
//  Porchivo
//
//  Admin tool — review and approve/deny resident join requests.
//  Backed by the security-definer RPCs `get_pending_members`,
//  `approve_org_membership`, and `deny_org_membership` (all verify
//  admin/staff server-side).
//

import SwiftUI

struct PendingMembersScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var members: [SupabaseService.PendingMemberRow] = []
    @State private var isLoading = true
    @State private var loadError: String? = nil
    @State private var processingId: String? = nil
    @State private var memberToDeny: SupabaseService.PendingMemberRow? = nil
    @State private var actionError: String? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if isLoading {
                    ProgressView()
                        .padding(.vertical, 48)
                } else if let loadError {
                    EmptyState(
                        symbol: "wifi.exclamationmark",
                        title: "Couldn't load requests",
                        message: loadError,
                        ctaLabel: "Try again"
                    ) { Task { await load() } }
                } else if members.isEmpty {
                    EmptyState(
                        symbol: "person.badge.clock",
                        title: "No pending requests",
                        message: "When residents join with your invite code they appear here for approval."
                    )
                } else {
                    Text("\(members.count) waiting for approval")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(c.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(members, id: \.membershipId) { member in
                        memberCard(member)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Pending Members")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog(
            denyPrompt,
            isPresented: Binding(
                get: { memberToDeny != nil },
                set: { if !$0 { memberToDeny = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Deny request", role: .destructive) {
                let target = memberToDeny
                memberToDeny = nil
                if let target { Task { await decide(target, approve: false) } }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(actionError ?? "")
        }
    }

    private var denyPrompt: String {
        "Deny \(memberToDeny?.displayName ?? "this request")?"
    }

    // MARK: - Row

    private func memberCard(_ member: SupabaseService.PendingMemberRow) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                avatarInitials(member.displayName)
                VStack(alignment: .leading, spacing: 3) {
                    Text(member.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.textPrimary)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        if let unit = member.unitNumber, !unit.isEmpty {
                            Label(unit, systemImage: "door.left.hand.open")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(c.textSecondary)
                        }
                        if let created = Self.dateLabel(member.createdAt) {
                            Text(created)
                                .font(.system(size: 11))
                                .foregroundStyle(c.textMuted)
                        }
                    }
                }
                Spacer()
            }

            if let notes = member.notes, !notes.isEmpty {
                Text(notes)
                    .font(.system(size: 13))
                    .foregroundStyle(c.textSecondary)
                    .lineLimit(3)
            }

            HStack(spacing: 10) {
                Button {
                    memberToDeny = member
                } label: {
                    Text("Deny")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(c.danger)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(c.danger.opacity(0.1), in: .rect(cornerRadius: Radius.md))
                }
                .disabled(isProcessing(member))

                Button {
                    Task { await decide(member, approve: true) }
                } label: {
                    Group {
                        if isProcessing(member) {
                            ProgressView().tint(c.onAccent)
                        } else {
                            Text("Approve")
                                .font(.system(size: 14, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(c.success, in: .rect(cornerRadius: Radius.md))
                    .foregroundStyle(c.onAccent)
                }
                .disabled(isProcessing(member))
            }
        }
        .padding(14)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func avatarInitials(_ name: String) -> some View {
        let initials = name.split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
        return Text(initials.isEmpty ? "?" : initials)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(c.accent)
            .frame(width: 40, height: 40)
            .background(c.accentSoft, in: .circle)
    }

    private func isProcessing(_ member: SupabaseService.PendingMemberRow) -> Bool {
        processingId != nil && processingId != member.membershipId ? false : processingId == member.membershipId
    }

    // MARK: - Actions

    private func load() async {
        guard let orgId = appState.orgMembership?.orgId else {
            loadError = "You're not part of a community yet."
            isLoading = false
            return
        }
        isLoading = members.isEmpty
        loadError = nil
        switch await SupabaseService.shared.fetchPendingMembers(orgId: orgId) {
        case .success(let rows):
            members = rows
        case .failure(let err):
            loadError = Self.friendlyMessage(err)
        }
        isLoading = false
    }

    private func decide(_ member: SupabaseService.PendingMemberRow, approve: Bool) async {
        guard let orgId = appState.orgMembership?.orgId else { return }
        processingId = member.membershipId
        let result = approve
            ? await SupabaseService.shared.approvePendingMember(membershipId: member.membershipId, orgId: orgId)
            : await SupabaseService.shared.denyPendingMember(membershipId: member.membershipId, orgId: orgId)
        switch result {
        case .success:
            withAnimation(.easeOut(duration: 0.25)) {
                members.removeAll { $0.membershipId == member.membershipId }
            }
            Haptics.success()
        case .failure(let err):
            actionError = Self.friendlyMessage(err)
            Haptics.error()
        }
        processingId = nil
    }

    // MARK: - Helpers

    private static func dateLabel(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let parsed = parser.date(from: iso)
            ?? ISO8601DateFormatter().date(from: iso)
        guard let parsed else { return nil }
        return parsed.formatted(.dateTime.month(.abbreviated).day())
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
    NavigationStack { PendingMembersScreen() }
        .environment(AppState())
}
