//
//  AnnouncementsScreen.swift
//  Porchivo
//
//  Community tier — announcements feed fetched from org_announcements table.
//  Shows pinned + recent announcements with priority badges.
//

import SwiftUI

struct AnnouncementsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if appState.announcements.isEmpty {
                    EmptyState(
                        symbol: "megaphone.fill",
                        title: "No announcements",
                        message: "Community announcements from your HOA or property management will appear here."
                    )
                } else {
                    ForEach(appState.announcements) { item in
                        AnnouncementCard(item: item)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Announcements")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AnnouncementCard: View {
    @Environment(\.porchivo) private var c
    let item: Announcement

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if item.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(c.warmOrange)
                }
                Text(item.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                    .lineLimit(2)
                Spacer()
                priorityPill
            }

            Text(item.body)
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .lineLimit(4)

            HStack(spacing: 6) {
                if let author = item.authorDisplayName, !author.isEmpty {
                    Text(author)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(c.textMuted)
                    Text("·")
                        .font(.system(size: 11))
                        .foregroundStyle(c.textMuted)
                }
                Text(item.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(size: 11))
                    .foregroundStyle(c.textMuted)
            }
        }
        .padding(14)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private var priorityPill: some View {
        let tint: Color = item.priority == .urgent ? c.danger
            : (item.priority == .high ? c.warmOrange
            : (item.priority == .normal ? c.accent : c.textMuted))
        return Text(item.priority.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12), in: .rect(cornerRadius: Radius.sm))
    }
}

#Preview {
    NavigationStack {
        AnnouncementsScreen().environment(AppState())
    }
}
