//
//  DeleteAccountSheet.swift
//  Porchivo
//
//  Full-screen delete account flow: info → confirm (type DELETE) → success/error.
//  Calls the graceful `request_account_deletion` RPC which deactivates the
//  account and starts the 30-day grace period before permanent deletion.
//

import SwiftUI

struct DeleteAccountSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss

    @State private var step: DeleteStep = .info
    @State private var confirmText: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""

    private enum DeleteStep {
        case info, confirm, success, error
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    switch step {
                    case .info:    infoStep
                    case .confirm: confirmStep
                    case .success: successStep
                    case .error:   errorStep
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .disabled(isLoading)
                }
            }
        }
    }

    // MARK: Info

    private var infoStep: some View {
        VStack(spacing: 20) {
            iconCircle(systemName: "trash.fill", color: c.danger, bg: c.dangerSoft)

            Text("Before You Delete Your Account")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            Text("Deleting your account will permanently remove your Porchivo profile and personal information from our system.")
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 10) {
                Text("Here's what happens when you delete:")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(c.textPrimary)

                bulletPoint("Your name, email, and contact details will be removed")
                bulletPoint("Your notification preferences and app settings will be cleared")
                bulletPoint("Your tracked packages, delivery history, and safety scores will no longer be accessible")
                bulletPoint("Your Porch Partner assignments and volunteer status will be removed")
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                Text("What stays on record:")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(c.textPrimary)
                Text("Payment transactions may be retained by Apple or Google for legally required recordkeeping purposes.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(c.warmOrange)
                    .font(.system(size: 14))
                Text("Deleting your Porchivo account does not cancel any active subscriptions. Cancel your Premium subscription through the App Store or Google Play before deleting.")
                    .font(.system(size: 13))
                    .foregroundStyle(c.textPrimary)
            }
            .padding(14)
            .background(c.peach, in: .rect(cornerRadius: 12))

            VStack(spacing: 12) {
                Button {
                    Haptics.light()
                    step = .confirm
                } label: {
                    Text("Continue to Delete")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(c.onAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(c.danger, in: .rect(cornerRadius: 12))
                }

                Button { dismiss() } label: {
                    Text("Never Mind, Take Me Back")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.accent)
                }
            }
            .padding(.top, 8)

            supportLink
        }
    }

    // MARK: Confirm

    private var confirmStep: some View {
        VStack(spacing: 20) {
            iconCircle(systemName: "exclamationmark.triangle.fill", color: c.danger, bg: c.dangerSoft)

            Text("Are You Sure?")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(c.textPrimary)

            Text("This action is permanent and cannot be undone.")
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            Text("Your Porchivo account for \(appState.user?.email ?? "this account") will be deactivated immediately. Your personal data will be permanently deleted within 30 days. After that, it cannot be restored.")
                .font(.system(size: 14))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            Text("If you change your mind, contact us at support@porchivo.com within 30 days and we can restore your account.")
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 8) {
                Text("Type DELETE to confirm")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.textPrimary)

                TextField("DELETE", text: $confirmText)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(size: 16, weight: .medium))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(c.surface, in: .rect(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(c.border, lineWidth: 1)
                    )
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 12) {
                Button {
                    requestDeletion()
                } label: {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .tint(c.onAccent)
                        }
                        Text("Yes, Delete My Account")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(c.onAccent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        confirmText.trimmingCharacters(in: .whitespaces) == "DELETE" ? c.danger : c.danger.opacity(0.4),
                        in: .rect(cornerRadius: 12)
                    )
                }
                .disabled(confirmText.trimmingCharacters(in: .whitespaces) != "DELETE" || isLoading)

                Button { dismiss() } label: {
                    Text("Cancel")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.accent)
                }
                .disabled(isLoading)
            }
            .padding(.top, 8)

            supportLink
        }
    }

    // MARK: Success

    private var successStep: some View {
        VStack(spacing: 20) {
            iconCircle(systemName: "checkmark.circle.fill", color: c.success, bg: c.successSoft)

            Text("Account Deletion Requested")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(c.textPrimary)

            Text("We've received your request. Your Porchivo account has been deactivated. Your personal data will be permanently deleted within 30 days. You'll receive a confirmation email at \(appState.user?.email ?? "your email address") once the deletion is complete.")
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            Text("Need to change your mind? Email us at support@porchivo.com within 30 days.")
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                Task { await appState.signOut() }
                dismiss()
            } label: {
                Text("Done")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(c.onAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(c.accent, in: .rect(cornerRadius: 12))
            }
            .padding(.top, 8)

            supportLink
        }
    }

    // MARK: Error

    private var errorStep: some View {
        VStack(spacing: 20) {
            iconCircle(systemName: "xmark.circle.fill", color: c.danger, bg: c.dangerSoft)

            Text("Something Went Wrong")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(c.textPrimary)

            Text("We weren't able to process your deletion request right now. Please try again in a few minutes.")
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .multilineTextAlignment(.center)

            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(c.textMuted)
                    .multilineTextAlignment(.center)
            }

            Text("If this keeps happening, contact us directly at support@porchivo.com and we'll take care of it for you.")
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 12) {
                Button {
                    step = .confirm
                } label: {
                    Text("Try Again")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(c.onAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(c.accent, in: .rect(cornerRadius: 12))
                }

                Button { dismiss() } label: {
                    Text("Cancel")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.accent)
                }
            }
            .padding(.top, 8)

            supportLink
        }
    }

    // MARK: Helpers

    private func iconCircle(systemName: String, color: Color, bg: Color) -> some View {
        Circle()
            .fill(bg)
            .frame(width: 72, height: 72)
            .overlay(
                Image(systemName: systemName)
                    .font(.system(size: 30))
                    .foregroundStyle(color)
            )
    }

    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(c.textMuted)
                .frame(width: 6, height: 6)
                .padding(.top, 7)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(c.textPrimary)
        }
    }

    private var supportLink: some View {
        HStack(spacing: 4) {
            Text("Questions? Contact")
                .font(.system(size: 12))
                .foregroundStyle(c.textMuted)
            Link("support@porchivo.com",
                 destination: URL(string: "mailto:support@porchivo.com")!)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(c.accent)
        }
        .padding(.top, 24)
    }

    private func requestDeletion() {
        guard confirmText.trimmingCharacters(in: .whitespaces) == "DELETE" else { return }
        isLoading = true
        errorMessage = ""
        Task {
            let result = await SupabaseService.shared.requestAccountDeletion()
            await MainActor.run {
                isLoading = false
                switch result {
                case .success(let deletionResult):
                    if deletionResult.success {
                        Haptics.success()
                        step = .success
                    } else {
                        errorMessage = deletionResult.error ?? "Unknown error"
                        step = .error
                    }
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    step = .error
                }
            }
        }
    }
}
