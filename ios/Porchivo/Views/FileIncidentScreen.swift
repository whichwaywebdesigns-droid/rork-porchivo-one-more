//
//  FileIncidentScreen.swift
//  Porchivo
//
//  File a community incident — type grid, severity, details, and optional
//  estimated item value (feeds theft-report follow-ups). Mirrors the Expo
//  file-incident screen.
//

import SwiftUI

struct FileIncidentScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss

    @State private var kind: IncidentKind?
    @State private var severity: IncidentSeverity = .medium
    @State private var title = ""
    @State private var details = ""
    @State private var unitNumber = ""
    @State private var valueText = ""
    @State private var isSubmitting = false
    @State private var submitted = false
    @State private var errorMessage: String?

    private var showValueField: Bool { kind?.isCarrierAction == true }

    private var canSubmit: Bool {
        kind != nil
            && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isSubmitting
    }

    var body: some View {
        Group {
            if submitted {
                successView
            } else {
                form
            }
        }
        .background(c.background.ignoresSafeArea())
    }

    // MARK: - Form

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                typeSection
                if kind?.isCarrierAction == true { carrierNote }
                severitySection
                titleField
                detailsField
                if showValueField { valueField }
                unitField
                privacyNote
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .navigationTitle("File Incident")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { submitBar }
    }

    private var typeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("What happened?", required: true)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
                ForEach(IncidentKind.allCases) { option in
                    kindTile(option)
                }
            }
        }
    }

    private func kindTile(_ option: IncidentKind) -> some View {
        let selected = kind == option
        return Button {
            kind = option
            if title.trimmingCharacters(in: .whitespaces).isEmpty {
                title = option.defaultTitle
            }
        } label: {
            VStack(spacing: 6) {
                Text(option.emoji)
                    .font(.system(size: 22))
                Text(option.label)
                    .font(.system(size: 11, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 88)
            .foregroundStyle(selected ? c.accent : c.textSecondary)
            .background(selected ? c.accentSoft : c.surface, in: .rect(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(selected ? c.accent : c.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var carrierNote: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "shippingbox.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(c.accent)
                .padding(8)
                .background(c.accentSoft, in: .rect(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 3) {
                Text("Contact the carrier first")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                Text("For a missing, lost, or damaged package, contact the carrier handling your shipment (Amazon, UPS, USPS, FedEx, etc.) — they hold your package and are responsible for resolving delivery issues, refunds, and claims. Porchivo provides tracking only; we have no relationship with any carrier and aren't responsible for your package.")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.accentSoft, in: .rect(cornerRadius: 12))
    }

    private var severitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("How serious is this?")
            HStack(spacing: 8) {
                ForEach(IncidentSeverity.allCases) { option in
                    severityPill(option)
                }
            }
        }
    }

    private func severityPill(_ option: IncidentSeverity) -> some View {
        let selected = severity == option
        let tint: Color = option == .low ? c.success : (option == .medium ? c.warmOrange : c.danger)
        return Button {
            severity = option
        } label: {
            Text(option.label)
                .font(.system(size: 12, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(selected ? tint : c.textMuted)
                .background(selected ? tint.opacity(0.12) : c.surface, in: .rect(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(selected ? tint.opacity(0.5) : c.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("Incident title", required: true)
            TextField("Describe the incident in one line…", text: $title)
                .font(.system(size: 14))
                .padding(12)
                .background(c.surface, in: .rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(c.border, lineWidth: 1))
                .foregroundStyle(c.textPrimary)
        }
    }

    private var detailsField: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("More details")
            TextEditor(text: $details)
                .font(.system(size: 14))
                .foregroundStyle(c.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 110)
                .padding(8)
                .background(c.surface, in: .rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(c.border, lineWidth: 1))
        }
    }

    private var valueField: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Estimated item value (USD)")
            HStack(spacing: 6) {
                Text("$")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textSecondary)
                TextField("e.g. 129.99", text: $valueText)
                    .font(.system(size: 14))
                    .keyboardType(.decimalPad)
                    .foregroundStyle(c.textPrimary)
            }
            .padding(12)
            .background(c.surface, in: .rect(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(c.border, lineWidth: 1))
            Text("Included in theft-report follow-ups. Optional.")
                .font(.system(size: 11))
                .foregroundStyle(c.textMuted)
        }
        .onChange(of: valueText) { _, newValue in
            valueText = sanitizeValue(newValue)
        }
    }

    private var unitField: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("Your unit / address")
            TextField("e.g. 204, 4B, or leave blank", text: $unitNumber)
                .font(.system(size: 14))
                .textInputAutocapitalization(.characters)
                .padding(12)
                .background(c.surface, in: .rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(c.border, lineWidth: 1))
                .foregroundStyle(c.textPrimary)
        }
    }

    private var privacyNote: some View {
        Text("Your report is visible to community staff and HOA management. Residents only see updates addressed to them.")
            .font(.system(size: 12))
            .foregroundStyle(c.textSecondary)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(c.surface, in: .rect(cornerRadius: 12))
    }

    private var submitBar: some View {
        VStack(spacing: 8) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(c.danger)
            }
            PrimaryButton(title: "Submit Incident", isLoading: isSubmitting,
                          tint: c.danger, enabled: canSubmit) {
                submit()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(c.surface)
    }

    // MARK: - Success

    private var successView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(c.success)
            Text("Incident Filed")
                .font(.system(size: 24, weight: .black))
                .foregroundStyle(c.textPrimary)
            Text("Your report is in the queue. Community staff will review it shortly.")
                .font(.system(size: 14))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Back to Create") {
                dismiss()
            }
            .padding(.top, 8)
        }
        .padding(32)
    }

    // MARK: - Logic

    private func sectionLabel(_ text: String, required: Bool = false) -> some View {
        HStack(spacing: 4) {
            Text(text)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(c.textPrimary)
            if required {
                Text("*")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(c.danger)
            }
        }
    }

    /// Digits + a single decimal point only; keeps the decimal input honest.
    private func sanitizeValue(_ text: String) -> String {
        let cleaned = text.filter { $0.isASCII && ($0.isWholeNumber || $0 == ".") }
        guard let firstDot = cleaned.firstIndex(of: ".") else { return String(cleaned.prefix(11)) }
        let head = String(cleaned[...firstDot])
        let tail = cleaned[cleaned.index(after: firstDot)...].filter { $0 != "." }
        return String((head + tail).prefix(11))
    }

    private func submit() {
        guard let selectedKind = kind, canSubmit else { return }
        isSubmitting = true
        errorMessage = nil
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDetails = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUnit = unitNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsed = Double(valueText).map { min(($0 * 100).rounded() / 100, 99_999_999.99) }
        let declaredValue = (parsed ?? 0) > 0 ? parsed : nil
        Task { @MainActor in
            let ok = await appState.fileIncident(
                type: selectedKind,
                severity: severity,
                title: trimmedTitle,
                description: trimmedDetails.isEmpty ? nil : trimmedDetails,
                unitNumber: trimmedUnit.isEmpty ? nil : trimmedUnit,
                estimatedValue: declaredValue
            )
            isSubmitting = false
            if ok {
                Haptics.success()
                submitted = true
            } else {
                Haptics.error()
                errorMessage = "Could not file incident. Please check your connection and try again."
            }
        }
    }
}

#Preview {
    FileIncidentScreen()
        .environment(AppState())
}
