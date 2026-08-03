//
//  ActivityScreen.swift
//  Porchivo
//
//  Activity tab — shipment + notification history with filter chips.
//

import SwiftUI

struct ActivityScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var filter: ActivityFilter = .all
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 14) {
                    HStack {
                        Text("Activity")
                            .font(.system(size: 26, weight: .black))
                            .foregroundStyle(c.textPrimary)
                        Spacer()
                        if appState.unreadCount > 0 {
                            Button {
                                Task { await appState.markAllNotificationsRead() }
                            } label: {
                                Text("Mark all read")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(c.accent)
                            }
                        }
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(ActivityFilter.allCases) { f in
                                Chip(label: f.label, selected: filter == f) {
                                    Haptics.selection()
                                    filter = f
                                }
                            }
                        }
                    }

                    if filtered.isEmpty {
                        EmptyState(
                            symbol: "clock.fill",
                            title: "Nothing yet",
                            message: "Delivery alerts and shipment updates will show up here in real time."
                        )
                    } else {
                        ForEach(filtered) { item in
                            row(item)
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
        }
    }

    private var filtered: [ActivityItem] {
        let notifs = appState.notifications.map { ActivityItem.notification($0) }
        let shipments = appState.shipments.map { ActivityItem.shipment($0) }
        let all = (notifs + shipments).sorted { $0.sortDate > $1.sortDate }
        switch filter {
        case .all: return all
        case .alerts: return notifs.sorted { $0.sortDate > $1.sortDate }
        case .shipments: return shipments.sorted { $0.sortDate > $1.sortDate }
        case .unread: return notifs.filter { !$0.isRead }.sorted { $0.sortDate > $1.sortDate }
        }
    }

    @ViewBuilder
    private func row(_ item: ActivityItem) -> some View {
        switch item {
        case .notification(let n):
            NavigationLink(value: Route.alerts) {
                notifRow(n)
            }.buttonStyle(.plain)
        case .shipment(let s):
            NavigationLink(value: Route.shipmentDetail(s.id)) {
                ShipmentCard(shipment: s)
            }.buttonStyle(.plain)
        }
    }

    private func notifRow(_ n: DeliveryNotification) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(n.read ? c.elevated : c.accentSoft)
                Image(systemName: n.type.sfSymbol)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(n.read ? c.textMuted : c.accent)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(n.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text(n.message)
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
                    .lineLimit(2)
                Text(relativeTime(n.createdAt))
                    .font(.system(size: 10))
                    .foregroundStyle(c.textMuted)
            }
            Spacer()
            if !n.read {
                Circle().fill(c.danger).frame(width: 8, height: 8)
            }
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .shadow(color: c.textPrimary.opacity(0.04), radius: 4, y: 2)
    }

    private func relativeTime(_ date: Date) -> String {
        let r = RelativeDateTimeFormatter()
        r.unitsStyle = .short
        return r.localizedString(for: date, relativeTo: Date())
    }
}

enum ActivityFilter: String, CaseIterable, Identifiable {
    case all, alerts, shipments, unread
    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: "All"
        case .alerts: "Alerts"
        case .shipments: "Shipments"
        case .unread: "Unread"
        }
    }
}

enum ActivityItem: Identifiable {
    case notification(DeliveryNotification)
    case shipment(Shipment)

    var id: String {
        switch self {
        case .notification(let n): return "n-\(n.id)"
        case .shipment(let s): return "s-\(s.id)"
        }
    }

    var sortDate: Date {
        switch self {
        case .notification(let n): return n.createdAt
        case .shipment(let s): return s.updatedAt
        }
    }

    var isRead: Bool {
        if case .notification(let n) = self { return n.read }
        return true
    }
}

#Preview {
    ActivityScreen().environment(AppState())
}
