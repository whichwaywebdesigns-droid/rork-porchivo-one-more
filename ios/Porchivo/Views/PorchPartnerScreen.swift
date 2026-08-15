//
//  PorchPartnerScreen.swift
//  Porchivo
//
//  Free tier tab — active holds, nearby requests, quick actions for
//  Porch Partner users. Shown when user has no active org membership.
//

import SwiftUI

struct PorchPartnerScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    header
                    earningsCard
                    activeHoldsSection
                    quickActions
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("Porch Partner")
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("Earn by helping neighbors")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(c.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var earningsCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(c.successSoft)
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(c.success)
            }
            .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 2) {
                Text("Potential: $80–$250/mo")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(c.textPrimary)
                Text("Hold packages for neighbors · Keep 85% · 2-day payout")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
        }
        .padding(16)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 8, y: 3)
    }

    private var activeHoldsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Active Holds")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            if appState.shipments.filter({ $0.status == .accepted }).isEmpty {
                EmptyState(
                    symbol: "shippingbox.fill",
                    title: "No active holds",
                    message: "When you accept a package hold request, it will appear here.",
                    ctaLabel: "Browse open requests"
                ) {
                    path.append(Route.create)
                }
            } else {
                ForEach(appState.shipments.filter { $0.status == .accepted }) { shipment in
                    NavigationLink(value: Route.shipmentDetail(shipment.id)) {
                        ShipmentCard(shipment: shipment)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var quickActions: some View {
        VStack(spacing: 0) {
            actionRow("Find nearby requests", "location.fill", c.accent) {
                path.append(Route.create)
            }
            Divider().overlay(c.border).padding(.leading, 54)
            actionRow("My earnings", "banknote.fill", c.success) {
                path.append(Route.create)
            }
            Divider().overlay(c.border).padding(.leading, 54)
            actionRow("Get verified", "checkmark.shield.fill", c.warmOrange) {
                path.append(Route.create)
            }
        }
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func actionRow(_ label: String, _ symbol: String, _ tint: Color, action: @escaping () -> Void) -> some View {
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
}

#Preview {
    PorchPartnerScreen().environment(AppState())
}
