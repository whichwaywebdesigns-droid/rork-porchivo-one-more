//
//  HomeScreen.swift
//  Porchivo
//
//  Home tab — greeting, daily theft fact, create entry, today's porch risk,
//  quick links, and my shipments list. No IAP/winback banner — the hybrid
//  model uses org membership for tier switching, not in-app purchases.
//

import SwiftUI

struct HomeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 14) {
                    Text("Porchivo")
                        .font(.system(size: 26, weight: .black))
                        .foregroundStyle(c.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    TheftFactCard(fact: MockData.theftFactOfDay)

                    if appState.isOrgMember && !appState.announcements.isEmpty {
                        AnnouncementsPreview(announcements: Array(appState.announcements.prefix(3)))
                    }

                    NavigationLink(value: Route.create) {
                        createEntry
                    }
                    .buttonStyle(.plain)

                    NavigationLink(value: Route.safety) { todayRiskCard }
                        .buttonStyle(.plain)

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Hello, \(firstName)")
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundStyle(c.textPrimary)
                            Text("Your delivery dashboard")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(c.textSecondary)
                        }
                        Spacer()
                        boltBadge
                    }
                    .padding(.top, 2)

                    HStack(spacing: 10) {
                        quickLink("Alerts", "bell.badge.fill", c.danger, c.dangerSoft, badge: appState.unreadCount) {
                            path.append(Route.alerts)
                        }
                        quickLink("Safety", "chart.bar.fill", c.accent, c.accentSoft) {
                            path.append(Route.safety)
                        }
                        quickLink("Add Pkg", "plus", c.success, c.successSoft) {
                            path.append(Route.addPackage)
                        }
                        quickLink("Incident", "exclamationmark.shield.fill", c.warmOrange, c.warmOrangeSoft) {
                            path.append(Route.fileIncident)
                        }
                    }

                    SectionHeader(title: "My Shipments", trailing: "See all")
                        .padding(.top, 4)

                    if appState.shipments.isEmpty {
                        EmptyState(
                            symbol: "shield.fill",
                            title: "No packages yet",
                            message: "Add your first package to start tracking deliveries and scoring porch risk.",
                            ctaLabel: "Add your first package"
                        ) { path.append(Route.addPackage) }
                    } else {
                        ForEach(appState.shipments) { s in
                            NavigationLink(value: Route.shipmentDetail(s.id)) {
                                ShipmentCard(shipment: s)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if !appState.packages.isEmpty {
                        SectionHeader(title: "Your packages", trailing: "See all")
                            .padding(.top, 8)

                        ForEach(appState.packages.prefix(3)) { pkg in
                            NavigationLink(value: Route.packageDetail(pkg.id)) {
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
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
        }
    }

    private var firstName: String {
        let name = appState.user?.name ?? "there"
        return name.split(separator: " ").first.map { String($0) } ?? name
    }

    private var boltBadge: some View {
        ZStack {
            Circle().fill(c.accent)
            Image(systemName: "bolt.fill")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.onAccent)
        }
        .frame(width: 30, height: 30)
    }

    /// Home → Create action menu. Reads as a create entry, not an earnings
    /// pitch — the partner earnings promise lives on CreateScreen's Porch
    /// Partner card instead (this card used to say "Earn $80–$250/mo…" while
    /// opening the create menu, which was confusing).
    private var createEntry: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(c.accentSoft)
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(c.accent)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("Create")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Log activity for your block or building.")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.accent)
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.06), radius: 8, y: 3)
    }

    private var todayRiskCard: some View {
        let safety = SafetyScore.value(fromRisk: RiskEngine.score(appState.shipments))
        let band = SafetyScore.band(safety)
        let tint: Color = band == .high ? c.danger : (band == .medium ? c.warmOrange : c.success)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("TODAY'S SAFETY")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(c.textMuted)
                Spacer()
                Text(band.label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(tint.opacity(0.12), in: .rect(cornerRadius: Radius.sm))
            }
            HStack(alignment: .bottom, spacing: 2) {
                Text("\(safety)")
                    .font(.system(size: 38, weight: .black))
                    .foregroundStyle(c.textPrimary)
                Text("/ 100")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.textMuted)
                    .padding(.bottom, 6)
            }
            ProgressView(value: Double(safety), total: 100)
                .tint(tint)
                .scaleEffect(y: 1.4)
            Text("View breakdown →")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.accent)
        }
        .padding(16)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.06), radius: 8, y: 3)
    }

    private func quickLink(_ label: String, _ symbol: String, _ tint: Color, _ soft: Color,
                           badge: Int = 0, action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.light(); action() }) {
            VStack(spacing: 6) {
                ZStack {
                    Circle().fill(soft)
                    Image(systemName: symbol)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(tint)
                }
                .frame(width: 44, height: 44)
                .overlay(alignment: .topTrailing) {
                    if badge > 0 {
                        Text(badge > 9 ? "9+" : "\(badge)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(c.onAccent)
                            .padding(4)
                            .background(c.danger, in: .circle)
                            .offset(x: 4, y: -4)
                    }
                }
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(c.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

private struct TheftFactCard: View {
    @Environment(\.porchivo) private var c
    let fact: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "shield.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.warmOrange)
            VStack(alignment: .leading, spacing: 2) {
                Text("DAILY THEFT FACT")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(c.warmOrange)
                Text(fact)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(c.textPrimary)
            }
            Spacer()
        }
        .padding(14)
        .background(c.peach, in: .rect(cornerRadius: Radius.lg))
    }
}

#Preview {
    HomeScreen().environment(AppState())
}

private struct AnnouncementsPreview: View {
    @Environment(\.porchivo) private var c
    let announcements: [Announcement]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "megaphone.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(c.warmOrange)
                Text("ANNOUNCEMENTS")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(c.warmOrange)
                Spacer()
            }
            ForEach(announcements) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(c.textPrimary)
                        .lineLimit(1)
                    Text(item.body)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                        .lineLimit(2)
                }
                if item.id != announcements.last?.id {
                    Divider().overlay(c.border)
                }
            }
        }
        .padding(14)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }
}
