//
//  AlertsScreen.swift
//  Porchivo
//
//  Alerts — notification list with unread badges, tap-to-mark-read, mark all.
//

import SwiftUI

struct AlertsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack {
                    Text("Alerts")
                        .font(.system(size: 26, weight: .black))
                        .foregroundStyle(c.textPrimary)
                    Spacer()
                    if appState.unreadCount > 0 {
                        Button {
                            Haptics.light()
                            Task { await appState.markAllNotificationsRead() }
                        } label: {
                            Text("Mark all read")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(c.onAccent)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(c.accent, in: .rect(cornerRadius: Radius.sm))
                        }
                        .buttonStyle(.plain)
                    }
                }

                if appState.notifications.isEmpty {
                    EmptyState(
                        symbol: "bell.slash.fill",
                        title: "No alerts yet",
                        message: "Delivery alerts, partner pickups, and block theft warnings will appear here."
                    )
                } else {
                    ForEach(appState.notifications) { n in
                        AlertRow(notification: n) {
                            Task { await appState.markNotificationRead(id: n.id) }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("")
    }
}

private struct AlertRow: View {
    @Environment(\.porchivo) private var c
    let notification: DeliveryNotification
    let onTap: () -> Void

    var body: some View {
        Button(action: { Haptics.light(); onTap() }) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(notification.read ? c.elevated : c.accentSoft)
                    Image(systemName: notification.type.sfSymbol)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(notification.read ? c.textMuted : c.accent)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text(notification.title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text(notification.message)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(relativeTime(notification.createdAt))
                        .font(.system(size: 10))
                        .foregroundStyle(c.textMuted)
                }
                Spacer()
                if !notification.read {
                    Circle().fill(c.danger).frame(width: 8, height: 8)
                }
            }
            .padding(Space.md)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
    }

    private func relativeTime(_ date: Date) -> String {
        let r = RelativeDateTimeFormatter()
        r.unitsStyle = .short
        return r.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    AlertsScreen().environment(AppState())
}
