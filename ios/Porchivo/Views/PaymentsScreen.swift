//
//  PaymentsScreen.swift
//  Porchivo
//
//  Community tier tab — HOA dues, payment history, invoices.
//  Shown when user has an active org membership.
//

import SwiftUI

struct PaymentsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    orgHeader
                    duesCard
                    historySection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("Payments")
        }
    }

    private var orgHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(c.accentSoft)
                Image(systemName: "building.2.fill")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(c.accent)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(appState.orgMembership?.orgName ?? "Your Community")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("Resident")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
    }

    private var duesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("HOA Dues")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Spacer()
                Pill(text: "Current", tint: c.success, softTint: c.successSoft)
            }
            Text("Next payment due")
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
            Text("No upcoming dues")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(c.accent)
        }
        .padding(16)
        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 8, y: 3)
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Payment History")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            EmptyState(
                symbol: "doc.text.fill",
                title: "No payments yet",
                message: "Your payment history and invoices will appear here once your community sets up billing."
            )
        }
    }
}

#Preview {
    PaymentsScreen().environment(AppState())
}
