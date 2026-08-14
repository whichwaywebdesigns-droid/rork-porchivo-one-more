//
//  AddPackageScreen.swift
//  Porchivo
//
//  Add a tracked package — carrier picker, tracking number, expected date,
//  address nickname, notes. Free-tier limit gating with upgrade redirect.
//

import SwiftUI

struct AddPackageScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var carrier: Carrier = .amazon
    @State private var trackingNumber = ""
    @State private var expectedDate = Date().addingTimeInterval(86400)
    @State private var addressNickname: AddressNickname = .home
    @State private var customAddress = ""
    @State private var notes = ""
    @State private var isSaving = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if !appState.canAddPackage() {
                    limitBanner
                }
                field("Package name", text: $name, symbol: "tag.fill")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Carrier")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                    HStack(spacing: 8) {
                        ForEach(Carrier.allCases) { car in
                            Chip(label: car.label, selected: carrier == car) {
                                Haptics.selection()
                                carrier = car
                            }
                        }
                    }
                }
                field("Tracking number", text: $trackingNumber, symbol: "barcode.viewfinder")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Expected delivery")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                    DatePicker("", selection: $expectedDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(c.surface, in: .rect(cornerRadius: Radius.md))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Deliver to")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                    HStack(spacing: 8) {
                        ForEach(AddressNickname.allCases) { nick in
                            Chip(label: nick.label, selected: addressNickname == nick) {
                                Haptics.selection()
                                addressNickname = nick
                            }
                        }
                    }
                    if addressNickname == .other {
                        field("Custom label", text: $customAddress, symbol: "mappin.fill")
                    }
                }
                field("Notes for partner (optional)", text: $notes, symbol: "text.bubble.fill")
                PrimaryButton(title: "Save package", systemImage: "checkmark.circle.fill",
                              isLoading: isSaving, action: save, enabled: canSave)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Add Package")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var canSave: Bool {
        !name.isEmpty && !trackingNumber.isEmpty && appState.canAddPackage() && !isSaving
    }

    private var limitBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Free plan limit reached", systemImage: "crown.fill")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(c.gold)
            Text("You can track \(AppConfig.FreeLimits.maxPackages) package on the free plan. Upgrade for unlimited tracking.")
                .font(.system(size: 12))
                .foregroundStyle(c.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.md)
        .background(c.goldSoft, in: .rect(cornerRadius: Radius.md))
    }

    private func field(_ label: String, text: Binding<String>, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            HStack(spacing: 10) {
                Image(systemName: symbol).foregroundStyle(c.textMuted)
                TextField("", text: text)
                    .font(.system(size: 15))
                    .foregroundStyle(c.textPrimary)
                    .textInputAutocapitalization(.never)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
        }
    }

    private func save() {
        isSaving = true
        let pkg = TrackedPackage(
            id: UUID().uuidString,
            name: name,
            carrier: carrier,
            trackingNumber: trackingNumber,
            expectedDeliveryDate: expectedDate,
            currentStatus: .ordered,
            addressNickname: addressNickname,
            customAddressLabel: addressNickname == .other ? customAddress : nil,
            notesForPartner: notes,
            statusHistory: [
                PackageStatusEvent(status: .ordered, timestamp: Date(), completed: true),
                PackageStatusEvent(status: .shipped, timestamp: nil, completed: false),
                PackageStatusEvent(status: .outForDelivery, timestamp: nil, completed: false),
                PackageStatusEvent(status: .delivered, timestamp: nil, completed: false),
            ],
            createdAt: Date()
        )
        Task { @MainActor in
            defer { isSaving = false }
            appState.addPackage(pkg)
            Haptics.success()
            dismiss()
        }
    }
}
