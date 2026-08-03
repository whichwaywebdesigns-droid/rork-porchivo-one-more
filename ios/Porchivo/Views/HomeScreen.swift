//
//  HomeScreen.swift
//  Porchivo
//
//  Home tab — greeting, daily theft fact, partner upsell, winback banner (free),
//  today's porch risk, quick links, and my shipments list.
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

                    NavigationLink(value: Route.create) {
                        partnerUpsell
                    }
                    .buttonStyle(.plain)

                    if appState.tier == .free {
                        NavigationLink(value: Route.upgrade) { winbackBanner }
                            .buttonStyle(.plain)
                    }

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
                        quickLink("Risk", "shield.lefthalf.filled", c.warmOrange, c.warmOrangeSoft) {
                            path.append(Route.safety)
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
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationBarHidden(true)
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

    private var partnerUpsell: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(c.successSoft)
                Image(systemName: "dollarsign.circle.fill")
                    .foregroundStyle(c.success)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("Earn $80–$250/mo on your schedule")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Hold packages for neighbors · Keep 85% · 2-day payout")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.success)
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.06), radius: 8, y: 3)
    }

    private var winbackBanner: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Color.white.opacity(0.2))
                Image(systemName: "crown.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.onAccent)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("Special offer — \(AppConfig.Pricing.winbackLabel)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.onAccent)
                Text("Only \(AppConfig.Pricing.winbackDisplay) · Upgrade to protect more")
                    .font(.system(size: 11))
                    .foregroundStyle(c.onAccent.opacity(0.8))
            }
            Spacer()
            Text("CLAIM")
                .font(.system(size: 12, weight: .black))
                .foregroundStyle(c.accent)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(c.onAccent, in: .rect(cornerRadius: Radius.sm))
        }
        .padding(12)
        .background(c.accent, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.accent.opacity(0.3), radius: 8, y: 4)
    }

    private var todayRiskCard: some View {
        let score = RiskEngine.score(appState.shipments)
        let level = RiskEngine.level(score)
        let tint: Color = level == .high ? c.danger : (level == .medium ? c.warmOrange : c.success)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("TODAY'S PORCH RISK")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(c.textMuted)
                Spacer()
                Text(level.label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(tint.opacity(0.12), in: .rect(cornerRadius: Radius.sm))
            }
            HStack(alignment: .bottom, spacing: 2) {
                Text("\(score)")
                    .font(.system(size: 38, weight: .black))
                    .foregroundStyle(c.textPrimary)
                Text("/ 100")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.textMuted)
                    .padding(.bottom, 6)
            }
            ProgressView(value: Double(score), total: 100)
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
