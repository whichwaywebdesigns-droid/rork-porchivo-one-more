//
//  ManageSubscriptionScreen.swift
//  Porchivo
//
//  Admin tool — shows the community's Stripe-backed plan status and deep-links
//  into the hosted Stripe Billing Portal via the `create-billing-portal` edge
//  function. Consumer-facing subscription management never happens in-app;
//  billing belongs to the HOA/property manager account (B2B).
//

import SwiftUI

struct ManageSubscriptionScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var details: SupabaseService.OrgAdminDetails? = nil
    @State private var isLoading = true
    @State private var loadError: String? = nil
    @State private var portalLoading = false
    @State private var portalError: String? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if isLoading {
                    ProgressView()
                        .padding(.vertical, 48)
                } else if let loadError {
                    EmptyState(
                        symbol: "wifi.exclamationmark",
                        title: "Couldn't load subscription",
                        message: loadError,
                        ctaLabel: "Try again"
                    ) { Task { await load() } }
                } else {
                    statusBanner
                    planCard
                    PrimaryButton(
                        title: portalLoading ? "Opening…" : "Manage Billing Online",
                        systemImage: "creditcard.fill",
                        isLoading: portalLoading
                    ) {
                        Task { await openBillingPortal() }
                    }
                    whatYouCanDoCard
                    supportCard
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Subscription")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .alert("Couldn't open billing portal", isPresented: Binding(
            get: { portalError != nil },
            set: { if !$0 { portalError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(portalError ?? "")
        }
    }

    // MARK: - Status mapping

    private struct StatusInfo {
        let label: String
        let symbol: String
        let tint: Color
        let detail: String?
    }

    private var status: StatusInfo {
        switch details?.subscriptionStatus {
        case "active":
            return StatusInfo(
                label: "Active",
                symbol: "checkmark.seal.fill",
                tint: c.success,
                detail: renewalLine
            )
        case "trialing":
            return StatusInfo(label: "Trial", symbol: "sparkles", tint: c.accent, detail: renewalLine)
        case "past_due":
            return StatusInfo(
                label: "Payment issue",
                symbol: "exclamationmark.triangle.fill",
                tint: c.warmOrange,
                detail: "Update your payment method so service isn't interrupted."
            )
        case "canceled":
            return StatusInfo(
                label: "Canceled",
                symbol: "xmark.circle.fill",
                tint: c.danger,
                detail: "Your plan has ended. Restart anytime from the billing portal."
            )
        case "pending":
            return StatusInfo(
                label: "Setup pending",
                symbol: "hourglass",
                tint: c.warmOrange,
                detail: "Checkout hasn't been completed yet."
            )
        default:
            return StatusInfo(
                label: "No subscription",
                symbol: "circle.dashed",
                tint: c.textMuted,
                detail: "This community isn't on a paid plan yet."
            )
        }
    }

    private var renewalLine: String? {
        guard let periodEnd = details?.currentPeriodEnd,
              let date = Self.parseISO(periodEnd) else { return nil }
        let verb = details?.subscriptionStatus == "trialing" ? "Ends" : "Renews"
        return "\(verb) \(date.formatted(.dateTime.month().day().year()))"
    }

    private var statusBanner: some View {
        let s = status
        return VStack(spacing: 8) {
            Image(systemName: s.symbol)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(s.tint)
            Text(s.label)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(c.textPrimary)
            if let detail = s.detail {
                Text(detail)
                    .font(.system(size: 13))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 26)
        .padding(.horizontal, 16)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    // MARK: - Plan card

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Plan")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            HStack(spacing: 12) {
                Image(systemName: "building.2.crop.circle.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(c.gold)
                    .frame(width: 44, height: 44)
                    .background(c.gold.opacity(0.12), in: .rect(cornerRadius: Radius.md))
                VStack(alignment: .leading, spacing: 2) {
                    Text(planName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.textPrimary)
                    Text(billingLine)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                }
                Spacer()
            }

            Divider().overlay(c.border)

            Label(
                "\(details?.name ?? appState.orgMembership?.orgName ?? "Your community") · one plan covers every resident",
                systemImage: "person.3.fill"
            )
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(c.textSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private var planName: String {
        switch details?.planTier {
        case "community": return "Community Plan"
        case "professional": return "Professional Plan"
        case "enterprise": return "Enterprise Plan"
        case "starter": return "Starter Plan"
        default: return "Community Plan"
        }
    }

    private var billingLine: String {
        (details?.billingCycle == "annual" ? "Billed annually" : "Billed monthly") + " via Stripe"
    }

    // MARK: - What you can do

    private var whatYouCanDoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("In the billing portal you can")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(c.textPrimary)
            bullet("Update or replace your payment method")
            bullet("Download invoices and receipts")
            bullet("Change your billing cycle or cancel")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(c.success)
                .padding(.top, 2)
            Text(text)
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
        }
    }

    private var supportCard: some View {
        VStack(spacing: 8) {
            Text("Questions about plans or pricing?")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(c.textSecondary)
            Button {
                if let url = URL(string: "mailto:\(AppConfig.Support.email)") {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Contact \(AppConfig.Support.email)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.accent)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
    }

    // MARK: - Actions

    private func load() async {
        guard let orgId = appState.orgMembership?.orgId else {
            loadError = "You're not part of a community yet."
            isLoading = false
            return
        }
        isLoading = true
        loadError = nil
        switch await SupabaseService.shared.fetchOrgAdminDetails(orgId: orgId) {
        case .success(let fetched):
            details = fetched
        case .failure(let err):
            loadError = Self.friendlyMessage(err)
        }
        isLoading = false
    }

    private func openBillingPortal() async {
        guard let orgId = appState.orgMembership?.orgId else { return }
        portalLoading = true
        switch await SupabaseService.shared.createBillingPortalSession(orgId: orgId) {
        case .success(let url):
            _ = await UIApplication.shared.open(url)
        case .failure(let err):
            portalError = Self.friendlyMessage(err)
            Haptics.error()
        }
        portalLoading = false
    }

    // MARK: - Helpers

    nonisolated private static func parseISO(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
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
    NavigationStack { ManageSubscriptionScreen() }
        .environment(AppState())
}
