//
//  OrgLedgerScreen.swift
//  Porchivo
//
//  Payments Ledger — Community plan and up, staff only.
//  Lists every org payment (dues, assessments) with collected totals and a
//  one-tap CSV export (share sheet). Mirrors the Expo `app/org-ledger.tsx`
//  screen against the same `org_payments` table + RLS; the export is built
//  client-side — no schema or edge function needed.
//

import SwiftUI

struct OrgLedgerScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var sharedFile: SharedFile?
    @State private var exportError: String?

    private var isStaff: Bool { appState.isOrgAdmin }

    var body: some View {
        Group {
            if !appState.isOrgMember {
                EmptyState(
                    symbol: "receipt",
                    title: "Join a community",
                    message: "The payments ledger tracks your HOA's dues and assessments. Ask your board for an invite to unlock it."
                )
            } else if !appState.isLedgerPlanAllowed {
                EmptyState(
                    symbol: "receipt",
                    title: "Community feature",
                    message: "The payments ledger is available on the Community plan and up. Upgrade your community's plan to unlock it."
                )
            } else if !isStaff {
                EmptyState(
                    symbol: "lock",
                    title: "Staff only",
                    message: "The payments ledger is managed by your board and property staff. Your own payment history lives on the Payments tab."
                )
            } else {
                content
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Payments Ledger")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let orgId = appState.orgMembership?.orgId {
                await appState.loadOrgPlanTier(orgId: orgId)
                await appState.loadOrgPayments(orgId: orgId)
            }
        }
        .sheet(item: $sharedFile) { file in
            ActivityView(activityItems: [file.url])
        }
        .alert("Export failed", isPresented: Binding(
            get: { exportError != nil },
            set: { if !$0 { exportError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportError ?? "")
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch appState.orgPaymentsLoadState {
        case .loading:
            VStack { Spacer(); ProgressView(); Spacer() }
        case .error(let message):
            EmptyState(symbol: "exclamationmark.triangle", title: "Could not load", message: message)
        default:
            ScrollView {
                VStack(spacing: 12) {
                    summaryCard
                    exportButton
                    if appState.orgPayments.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "receipt")
                                .font(.system(size: 26))
                                .foregroundStyle(c.textMuted)
                            Text("No payments yet")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(c.textPrimary)
                            Text("Dues and assessments will appear here as residents pay.")
                                .font(.system(size: 13))
                                .foregroundStyle(c.textMuted)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(28)
                        .background(c.surface, in: .rect(cornerRadius: Radius.lg))
                        .overlay(RoundedRectangle(cornerRadius: Radius.lg).stroke(c.border))
                        .padding(.top, 8)
                    } else {
                        ForEach(appState.orgPayments, id: \.id) { payment in
                            paymentRow(payment)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
    }

    private var summaryCard: some View {
        let stats = ledgerStats()
        return HStack(spacing: 0) {
            statBlock(money(stats.all), "Collected all-time")
            statDivider
            statBlock(money(stats.month), "This month")
            statDivider
            statBlock("\(stats.count)", "Paid payments")
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(c.accent.opacity(0.06), in: .rect(cornerRadius: Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Radius.lg).stroke(c.accent.opacity(0.35)))
    }

    private func statBlock(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(c.textPrimary)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(c.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(c.border)
            .frame(width: 1, height: 34)
    }

    private var exportButton: some View {
        Button {
            Haptics.light()
            exportCsv()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "square.and.arrow.down")
                Text("Export CSV")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(c.accent, in: .rect(cornerRadius: Radius.md))
        }
        .disabled(appState.orgPayments.isEmpty)
        .opacity(appState.orgPayments.isEmpty ? 0.5 : 1)
    }

    private func paymentRow(_ payment: OrgPayment) -> some View {
        let tone = statusTone(payment.status)
        return HStack(spacing: 12) {
            Image(systemName: "receipt")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(tone)
                .frame(width: 42, height: 42)
                .background(tone.opacity(0.12), in: .rect(cornerRadius: Radius.md))
            VStack(alignment: .leading, spacing: 2) {
                Text(payment.member?.name ?? "Unknown resident")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                    .lineLimit(1)
                Text(dateText(payment))
                    .font(.system(size: 12))
                    .foregroundStyle(c.textMuted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(money(payment.amountCents))
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                Text(payment.status)
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .foregroundStyle(tone)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(tone.opacity(0.12), in: .rect(cornerRadius: 10))
            }
        }
        .padding(14)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
    }

    // MARK: - Helpers

    private func statusTone(_ status: String) -> Color {
        switch status {
        case "paid": return c.success
        case "pending": return c.gold
        default: return c.danger
        }
    }

    private func dateText(_ payment: OrgPayment) -> String {
        let iso = payment.paidAt ?? payment.createdAt ?? ""
        guard let date = parseSupabaseDate(iso) else { return "" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    private func ledgerStats() -> (all: Int, month: Int, count: Int) {
        let paid = appState.orgPayments.filter { $0.status == "paid" }
        var cal = Calendar(identifier: .gregorian)
        cal.firstWeekday = 1
        let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: Date())) ?? .distantPast
        let month = paid
            .filter { p in
                let iso = p.paidAt ?? p.createdAt ?? ""
                return (parseSupabaseDate(iso) ?? .distantPast) >= monthStart
            }
            .reduce(0) { $0 + $1.amountCents }
        return (paid.reduce(0) { $0 + $1.amountCents }, month, paid.count)
    }

    private func money(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100.0)
    }

    private func exportCsv() {
        let rows = appState.orgPayments
        guard !rows.isEmpty else { return }
        var lines = ["Date,Member,Amount,Status"]
        for p in rows {
            let iso = p.paidAt ?? p.createdAt ?? ""
            let fields = [
                csvField(iso),
                csvField(p.member?.name ?? "Unknown"),
                csvField(money(p.amountCents)),
                csvField(p.status),
            ]
            lines.append(fields.joined(separator: ","))
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("porchivo-ledger-\(Int(Date().timeIntervalSince1970)).csv")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            sharedFile = SharedFile(url: url)
        } catch {
            exportError = "Could not create the CSV file — try again."
        }
    }
}

/// CSV-escape a field: wrap in quotes, double any inner quotes.
private func csvField(_ value: String) -> String {
    "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
}

private struct SharedFile: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    OrgLedgerScreen().environment(AppState())
}
