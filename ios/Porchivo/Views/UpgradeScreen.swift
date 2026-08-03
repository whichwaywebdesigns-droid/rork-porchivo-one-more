//
//  UpgradeScreen.swift
//  Porchivo
//
//  Paywall — monthly/annual plan cards, family plan, restore, tier comparison,
//  winback offer. IAP deferred to a follow-up; selecting a plan upgrades the
//  local tier for demo purposes.
//

import SwiftUI

struct UpgradeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPlan: Plan = .annual
    @State private var isProcessing = false

    enum Plan: String, CaseIterable, Identifiable {
        case monthly, annual, family
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                winbackCard
                ForEach(Plan.allCases) { planCard($0) }
                comparisonCard
                PrimaryButton(title: "Start \(selectedPlan == .family ? "Family" : "Premium")",
                              systemImage: "crown.fill", isLoading: isProcessing,
                              action: purchase)
                Button("Restore purchases") { restore() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(c.accent)
                Text("Cancel anytime. Payment charged to your Apple ID.")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Upgrade")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "crown.fill")
                .font(.system(size: 40, weight: .black))
                .foregroundStyle(c.gold)
            Text("Porchivo Premium")
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(c.textPrimary)
            Text("Unlimited packages, real-time theft alerts, priority partner matching, and a shared family dashboard.")
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var winbackCard: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles.fill").foregroundStyle(c.onAccent)
            VStack(alignment: .leading, spacing: 1) {
                Text("Winback offer — \(AppConfig.Pricing.winbackLabel)")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(c.onAccent)
                Text("Only \(AppConfig.Pricing.winbackDisplay) for 3 months")
                    .font(.system(size: 11)).foregroundStyle(c.onAccent.opacity(0.85))
            }
            Spacer()
        }
        .padding(12)
        .background(c.accent, in: .rect(cornerRadius: Radius.md))
    }

    private func planCard(_ plan: Plan) -> some View {
        let title: String, price: String, per: String, blurb: String, savings: String?
        switch plan {
        case .monthly:
            title = "Monthly"; price = AppConfig.Pricing.monthlyDisplay; per = AppConfig.Pricing.monthlyPerMonth
            blurb = "Billed monthly. Cancel anytime."; savings = nil
        case .annual:
            title = "Annual"; price = AppConfig.Pricing.annualDisplay; per = AppConfig.Pricing.annualPerMonth
            blurb = "7-day free trial. Billed yearly."; savings = AppConfig.Pricing.annualSavingsLabel
        case .family:
            title = "Family"; price = AppConfig.FamilyPlan.annualDisplay; per = AppConfig.FamilyPlan.annualPerMonth
            blurb = "Up to \(AppConfig.FamilyPlan.maxMembers) members."; savings = AppConfig.FamilyPlan.annualSavingsLabel
        }
        return Button {
            Haptics.selection()
            selectedPlan = plan
        } label: {
            HStack(spacing: 12) {
                Image(systemName: selectedPlan == plan ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(c.accent)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(title).font(.system(size: 16, weight: .bold)).foregroundStyle(c.textPrimary)
                        if let savings {
                            Text(savings).font(.system(size: 10, weight: .bold))
                                .foregroundStyle(c.success)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(c.successSoft, in: .capsule)
                        }
                    }
                    Text(blurb).font(.system(size: 11)).foregroundStyle(c.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text(price).font(.system(size: 17, weight: .black)).foregroundStyle(c.textPrimary)
                    Text(per).font(.system(size: 11)).foregroundStyle(c.textMuted)
                }
            }
            .padding(Space.md)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Radius.lg).stroke(selectedPlan == plan ? c.accent : c.border,
                                                            lineWidth: selectedPlan == plan ? 2 : 1))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }

    private var comparisonCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("What's included")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                feature("Unlimited package tracking")
                feature("Real-time theft alerts for your block")
                feature("Priority Porch Partner matching")
                feature("Porch risk score & breakdown")
                feature("Shared family dashboard", family: true)
            }
        }
    }

    private func feature(_ text: String, family: Bool = false) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(c.success)
            Text(text).font(.system(size: 13, weight: .medium)).foregroundStyle(c.textPrimary)
            Spacer()
            if family {
                Text("Family").font(.system(size: 10, weight: .bold))
                    .foregroundStyle(c.gold)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(c.goldSoft, in: .capsule)
            }
        }
    }

    private func purchase() {
        isProcessing = true
        Task { @MainActor in
            defer { isProcessing = false }
            try? await Task.sleep(for: .seconds(1))
            appState.upgradeTier(selectedPlan == .family ? .family : .premium)
            Haptics.success()
            dismiss()
        }
    }

    private func restore() {
        Haptics.light()
        // IAP restore deferred — in demo we trust the existing tier.
    }
}
