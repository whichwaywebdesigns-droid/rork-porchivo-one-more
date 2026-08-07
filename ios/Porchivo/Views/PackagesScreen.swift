//
//  PackagesScreen.swift
//  Porchivo
//
//  Packages tab — tracked packages list (local), free-tier limit gating,
//  status events, package detail nav.
//

import SwiftUI

struct PackagesScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("My Packages")
                                .font(.system(size: 26, weight: .black))
                                .foregroundStyle(c.textPrimary)
                            Text("\(appState.packages.count) tracked")
                                .font(.system(size: 13))
                                .foregroundStyle(c.textSecondary)
                        }
                        Spacer()
                        NavigationLink(value: Route.addPackage) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(c.accent)
                        }
                    }

                    if appState.tier == .free {
                        freeTierBanner
                    }

                    if appState.packages.isEmpty {
                        EmptyState(
                            symbol: "shippingbox.fill",
                            title: "No packages tracked",
                            message: "Add a tracking number to follow your delivery from order to porch.",
                            ctaLabel: "Add a package"
                        ) { path.append(Route.addPackage) }
                    } else {
                        ForEach(appState.packages) { pkg in
                            NavigationLink(value: Route.packageDetail(pkg.id)) {
                                packageCard(pkg)
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
            .navigationTitle("")
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
        }
    }

    private var freeTierBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "crown.fill")
                .foregroundStyle(c.gold)
            VStack(alignment: .leading, spacing: 1) {
                Text("Free plan: 1 package max")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Upgrade to track unlimited packages.")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
            NavigationLink(value: Route.upgrade) {
                Text("Upgrade")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(c.onAccent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(c.accent, in: .rect(cornerRadius: Radius.sm))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(c.goldSoft, in: .rect(cornerRadius: Radius.md))
    }

    private func packageCard(_ pkg: TrackedPackage) -> some View {
        let priority = priorityBadge(for: pkg)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: pkg.carrier.sfSymbol)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.accent)
                    .frame(width: 36, height: 36)
                    .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))
                VStack(alignment: .leading, spacing: 1) {
                    Text(pkg.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text(pkg.trackingNumber)
                        .font(.system(size: 11))
                        .foregroundStyle(c.textMuted)
                }
                Spacer()
                if let priority {
                    PriorityPill(text: priority.text, tint: priority.tint, softTint: priority.softTint)
                }
            }
            HStack(spacing: 12) {
                Label(pkg.addressNickname.label, systemImage: "mappin.fill")
                Label(expectedLabel(pkg), systemImage: "calendar")
                Spacer()
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(c.textSecondary)
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func priorityBadge(for pkg: TrackedPackage) -> PriorityBadge? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let expected = calendar.startOfDay(for: pkg.expectedDeliveryDate)
        let days = calendar.dateComponents([.day], from: today, to: expected).day ?? 0

        // Don't badge packages that are already delivered/picked up/returned.
        switch pkg.currentStatus {
        case .delivered, .pickedUp, .returned:
            return nil
        default:
            break
        }

        if days == 0 {
            return PriorityBadge(text: "Due today", tint: c.danger, softTint: c.dangerSoft, icon: "flame.fill")
        } else if days < 0 {
            return PriorityBadge(text: "Overdue", tint: c.danger, softTint: c.dangerSoft, icon: "exclamationmark.triangle.fill")
        } else if days == 1 {
            return PriorityBadge(text: "Due tomorrow", tint: c.warmOrange, softTint: c.warmOrangeSoft, icon: "clock.arrow.2.circlepath")
        } else if days <= 3 {
            return PriorityBadge(text: "Due soon", tint: c.gold, softTint: c.goldSoft, icon: "calendar.badge.clock")
        }
        return nil
    }

    private struct PriorityBadge: Equatable {
        let text: String
        let tint: Color
        let softTint: Color
        let icon: String
    }

    private func expectedLabel(_ pkg: TrackedPackage) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return "By \(f.string(from: pkg.expectedDeliveryDate))"
    }
}

struct PriorityPill: View {
    let text: String
    let tint: Color
    let softTint: Color
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
            }
            Text(text)
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(softTint, in: .rect(cornerRadius: Radius.pill))
    }
}

#Preview {
    PackagesScreen().environment(AppState())
}
