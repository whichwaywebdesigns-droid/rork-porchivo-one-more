//
//  PackageDetailScreen.swift
//  Porchivo
//
//  Package detail — carrier, tracking number, expected delivery, status
//  history, delete action.
//

import SwiftUI

struct PackageDetailScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    let packageId: String
    @State private var showDelete = false

    var body: some View {
        Group {
            if let pkg {
                content(pkg)
            } else {
                EmptyState(symbol: "shippingbox.fill", title: "Package not found",
                           message: "This tracked package may have been removed.")
            }
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Package")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete this tracked package?", isPresented: $showDelete) {
            Button("Delete", role: .destructive) {
                appState.deletePackage(id: packageId)
                Haptics.medium()
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var pkg: TrackedPackage? {
        appState.packages.first { $0.id == packageId }
    }

    private func content(_ p: TrackedPackage) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 8) {
                    Image(systemName: p.carrier.sfSymbol)
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(c.onAccent)
                        .frame(width: 72, height: 72)
                        .background(c.accent, in: .rect(cornerRadius: Radius.lg))
                    Text(p.name)
                        .font(.system(size: 20, weight: .black))
                        .foregroundStyle(c.textPrimary)
                    Pill(text: p.currentStatus.label, tint: c.accent, softTint: c.accentSoft)
                }
                .frame(maxWidth: .infinity)

                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        row("Carrier", p.carrier.label, "truck.box.fill")
                        row("Tracking #", p.trackingNumber, "barcode.viewfinder")
                        row("Address", addressLabel(p), "mappin.fill")
                        row("Expected by", expectedLabel(p), "calendar")
                        if !p.notesForPartner.isEmpty {
                            row("Notes for partner", p.notesForPartner, "text.bubble.fill")
                        }
                    }
                }

                SectionHeader(title: "Status history")
                Card {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(p.statusHistory) { evt in
                            HStack(spacing: 12) {
                                Image(systemName: evt.completed ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(evt.completed ? c.success : c.textMuted)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(evt.status.label)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(c.textPrimary)
                                    if let ts = evt.timestamp {
                                        Text(formatted(ts))
                                            .font(.system(size: 11))
                                            .foregroundStyle(c.textMuted)
                                    }
                                }
                                Spacer()
                            }
                        }
                    }
                }

                Button(role: .destructive) {
                    Haptics.light()
                    showDelete = true
                } label: {
                    Text("Delete package")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(c.dangerSoft, in: .rect(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
    }

    private func row(_ label: String, _ value: String, _ symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.textMuted)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(c.textMuted)
                Text(value).font(.system(size: 14, weight: .medium)).foregroundStyle(c.textPrimary)
            }
            Spacer()
        }
    }

    private func addressLabel(_ p: TrackedPackage) -> String {
        if let custom = p.customAddressLabel, !custom.isEmpty { return custom }
        return p.addressNickname.label
    }

    private func expectedLabel(_ p: TrackedPackage) -> String {
        let f = DateFormatter()
        f.dateStyle = .full
        f.timeStyle = .none
        return f.string(from: p.expectedDeliveryDate)
    }

    private func formatted(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: d)
    }
}
