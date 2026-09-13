//
//  PackagesScreen.swift
//  Porchivo
//
//  Full tracked-packages list (local), free-tier limit gating,
//  status events, package detail nav. Reached from MoreScreen's
//  "See all N packages" link via Route.packages — pushes run on the
//  CALLER's NavigationStack through the shared `path` binding.
//  Cards carry a status color strip + pill, and the list sorts by
//  newest/oldest arrival (parity with the Expo packages list).
//

import SwiftUI

struct PackagesScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Binding var path: NavigationPath
    @State private var newestFirst = true

    private func isFinished(_ pkg: TrackedPackage) -> Bool {
        switch pkg.currentStatus {
        case .delivered, .pickedUp, .returned: return true
        default: return false
        }
    }

    var body: some View {
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

                    if !appState.packages.isEmpty {
                        packageSummaryHeader
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
                        sortRow
                        ForEach(displayPackages) { pkg in
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
        .navigationBarTitleDisplayMode(.inline)
    }

    private var packageSummaryHeader: some View {
        let active = appState.packages.filter { !isFinished($0) }
        let dueToday = active.filter { isDueToday($0) }

        return HStack(spacing: 12) {
            summaryTile(
                value: active.count,
                label: active.count == 1 ? "Active package" : "Active packages",
                icon: "shippingbox.fill",
                tint: c.accent,
                softTint: c.accentSoft
            )
            summaryTile(
                value: dueToday.count,
                label: "Due today",
                icon: "flame.fill",
                tint: c.danger,
                softTint: c.dangerSoft
            )
        }
    }

    private func summaryTile(value: Int, label: String, icon: String, tint: Color, softTint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 38, height: 38)
                .background(softTint, in: .rect(cornerRadius: Radius.md))
            VStack(alignment: .leading, spacing: 1) {
                Text("\(value)")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(c.textPrimary)
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func isDueToday(_ pkg: TrackedPackage) -> Bool {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let expected = calendar.startOfDay(for: pkg.expectedDeliveryDate)
        return calendar.isDate(today, inSameDayAs: expected)
    }

    private var freeTierBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "shippingbox.fill")
                .foregroundStyle(c.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("Track unlimited packages")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Join your community for full access.")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))
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
                VStack(alignment: .trailing, spacing: 4) {
                    PriorityPill(
                        text: pkg.currentStatus.label,
                        tint: statusColors(pkg.currentStatus).tint,
                        softTint: statusColors(pkg.currentStatus).soft
                    )
                    if let priority {
                        PriorityPill(text: priority.text, tint: priority.tint, softTint: priority.softTint)
                    }
                }
            }
            HStack(spacing: 12) {
                Label(pkg.addressNickname.label, systemImage: "mappin.fill")
                Label(expectedLabel(pkg), systemImage: "calendar")
                Spacer()
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(c.textSecondary)

            if !isFinished(pkg) {
                DeliveryCountdownView(
                    expectedDeliveryDate: pkg.expectedDeliveryDate,
                    isDelivered: false
                )
            }
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .clipShape(.rect(cornerRadius: Radius.lg))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: Radius.lg, bottomLeadingRadius: Radius.lg)
                .fill(statusColors(pkg.currentStatus).tint)
                .frame(width: 4)
                .allowsHitTesting(false)
        }
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    // MARK: - Status colors + arrival sort (parity with the Expo packages list)

    private func statusColors(_ status: PackageTrackingStatus) -> (tint: Color, soft: Color) {
        switch status {
        case .delivered, .pickedUp: return (c.success, c.successSoft)
        case .outForDelivery: return (c.warmOrange, c.warmOrangeSoft)
        case .shipped: return (c.accent, c.accentSoft)
        case .returned: return (c.danger, c.dangerSoft)
        case .ordered: return (c.textSecondary, c.elevated)
        }
    }

    /// Actual arrival once delivered (from status history), otherwise the expected date.
    private func arrivalDate(_ pkg: TrackedPackage) -> Date {
        pkg.statusHistory.first { $0.status == .delivered }?.timestamp ?? pkg.expectedDeliveryDate
    }

    private var displayPackages: [TrackedPackage] {
        newestFirst
            ? appState.packages.sorted { arrivalDate($0) > arrivalDate($1) }
            : appState.packages.sorted { arrivalDate($0) < arrivalDate($1) }
    }

    private var sortRow: some View {
        HStack(spacing: 8) {
            Text("Arrival")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(c.textMuted)
                .textCase(.uppercase)
            Spacer()
            arrivalChip("Newest", isActive: newestFirst) { newestFirst = true }
            arrivalChip("Oldest", isActive: !newestFirst) { newestFirst = false }
        }
    }

    private func arrivalChip(_ title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(isActive ? c.accent : c.textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isActive ? c.accentSoft : c.surface, in: .rect(cornerRadius: Radius.pill))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.pill)
                        .strokeBorder(isActive ? c.accent.opacity(0.35) : c.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
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
    PackagesScreenPreview()
}

private struct PackagesScreenPreview: View {
    @State private var path = NavigationPath()
    var body: some View {
        PackagesScreen(path: $path).environment(AppState())
    }
}
