//
//  ShipmentDetailScreen.swift
//  Porchivo
//
//  Shipment detail — status timeline, accept/complete actions, partner info,
//  tracking link, notes.
//

import SwiftUI

struct ShipmentDetailScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    let shipmentId: String

    var body: some View {
        Group {
            if let shipment {
                content(shipment)
            } else {
                EmptyState(symbol: "shippingbox.fill", title: "Shipment not found",
                           message: "This shipment may have been cancelled or removed.")
            }
        }
        .biometricGuard(reason: "Authenticate to view shipment details.")
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Shipment")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var shipment: Shipment? {
        appState.shipments.first { $0.id == shipmentId }
    }

    private func content(_ s: Shipment) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                statusHeader(s)
                timelineCard(s)
                detailsCard(s)
                if s.status == .open { acceptButton(s) }
                if s.status == .accepted { completeButton(s) }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
    }

    private func statusHeader(_ s: Shipment) -> some View {
        VStack(spacing: 8) {
            Image(systemName: s.carrier.sfSymbol)
                .font(.system(size: 36, weight: .bold))
                .foregroundStyle(c.onAccent)
                .frame(width: 72, height: 72)
                .background(c.accent, in: .rect(cornerRadius: Radius.lg))
            Text(s.carrier.label)
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(c.textPrimary)
            StatusPill(status: s.status)
            Text(s.packagesExpected)
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func timelineCard(_ s: Shipment) -> some View {
        let events = timelineEvents(s)
        return Card {
            VStack(alignment: .leading, spacing: 14) {
                Text("Timeline")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                ForEach(Array(events.enumerated()), id: \.element) { idx, evt in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(spacing: 0) {
                            Circle()
                                .fill(evt.done ? c.accent : c.elevated)
                                .frame(width: 12, height: 12)
                            if idx < events.count - 1 {
                                Rectangle()
                                    .fill(evt.done ? c.accent : c.border)
                                    .frame(width: 2, height: 28)
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(evt.label)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(evt.done ? c.textPrimary : c.textMuted)
                            if let time = evt.time {
                                Text(time)
                                    .font(.system(size: 11))
                                    .foregroundStyle(c.textMuted)
                            }
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    private struct TimelineEvent: Hashable {
        let label: String
        let done: Bool
        let time: String?
    }

    private func timelineEvents(_ s: Shipment) -> [TimelineEvent] {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        let orderCreated = TimelineEvent(label: "Shipment created", done: true, time: f.string(from: s.createdAt))
        let transit = TimelineEvent(label: "In transit", done: s.deliveryStatus != .pending,
                                    time: s.deliveryStatus != .pending ? f.string(from: s.updatedAt) : nil)
        let outForDelivery = TimelineEvent(label: "Out for delivery", done: s.deliveryStatus == .outForDelivery || s.deliveryStatus == .deliveredToHomeowner,
                                           time: s.deliveryStatus == .outForDelivery ? f.string(from: s.updatedAt) : nil)
        let delivered = TimelineEvent(label: "Delivered", done: s.deliveryStatus == .deliveredToHomeowner,
                                      time: s.deliveryStatus == .deliveredToHomeowner ? f.string(from: s.updatedAt) : nil)
        let returned = TimelineEvent(label: "Returned to homeowner", done: s.status == .completed,
                                     time: s.status == .completed ? f.string(from: s.updatedAt) : nil)
        return [orderCreated, transit, outForDelivery, delivered, returned]
    }

    private func detailsCard(_ s: Shipment) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                detailRow("Recipient", s.homeownerName, "person.fill")
                if let p = s.partnerName {
                    detailRow("Porch Partner", p, "hand.raised.fill")
                }
                detailRow("Address", s.addressText, "mappin.fill")
                detailRow("Preferred return", s.preferredReturnTime, "clock.fill")
                if let tn = s.trackingNumber {
                    detailRow("Tracking #", tn, "barcode.viewfinder")
                }
                if !s.notes.isEmpty {
                    detailRow("Drop notes", s.notes, "text.bubble.fill")
                }
                detailRow("Location shared", s.homeLocationVisibleToPartner ? "Yes — partner sees block" : "No", "location.fill")
            }
        }
    }

    private func detailRow(_ label: String, _ value: String, _ symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(c.textMuted)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(c.textMuted)
                Text(value)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(c.textPrimary)
            }
            Spacer()
        }
    }

    private func acceptButton(_ s: Shipment) -> some View {
        PrimaryButton(title: "Accept as Porch Partner", systemImage: "hand.raised.fill") {
            Task {
                let ok = await appState.acceptShipment(id: s.id)
                if ok { Haptics.success() }
            }
        }
    }

    private func completeButton(_ s: Shipment) -> some View {
        PrimaryButton(title: "Mark returned to homeowner", systemImage: "checkmark.seal.fill",
                      tint: c.success) {
            Task {
                let ok = await appState.completeShipment(id: s.id)
                if ok { Haptics.success() }
            }
        }
    }
}
