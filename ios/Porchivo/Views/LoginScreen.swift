//
//  LoginScreen.swift
//  Porchivo
//
//  Magic link authentication — email → 6-digit OTP code → verified.
//  No passwords. On success, RootView routes to biometric enrollment
//  (if available) then onboarding or the main TabView.
//

import SwiftUI

struct LoginScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var email = ""
    @State private var otpCode = ""
    @State private var phase: AuthPhase = .email
    @State private var isSubmitting = false
    @State private var linkSent = false
    @FocusState private var focusedField: FocusField?

    enum AuthPhase {
        case email
        case code
    }

    enum FocusField {
        case email
        case otp
    }

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 28) {
                    Spacer().frame(height: 52)
                    brandBlock
                    switch phase {
                    case .email:
                        emailPhase
                    case .code:
                        codePhase
                    }
                    if let err = appState.authError {
                        errorBanner(err)
                    }
                    if appState.isSupabaseConfigured == false {
                        demoHint
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onAppear { focusedField = .email }
    }

    // MARK: - Brand

    private var brandBlock: some View {
        VStack(spacing: 12) {
            BrandLogoWithBox(logoSize: 64)
            Text("Porchivo")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(c.textPrimary)
            Text(phase == .email ? "Sign in or create account" : "Enter your code")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(c.textSecondary)
        }
    }

    // MARK: - Email phase

    private var emailPhase: some View {
        VStack(spacing: 20) {
            emailField
            PrimaryButton(
                title: isSubmitting ? "Sending link…" : "Send magic link",
                systemImage: "envelope.fill",
                isLoading: isSubmitting,
                action: sendLink,
                enabled: isValidEmail && !isSubmitting
            )
            if linkSent {
                Text("Check your email for a 6-digit code.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(c.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var emailField: some View {
        HStack(spacing: 10) {
            Image(systemName: "envelope.fill")
                .foregroundStyle(c.textMuted)
            TextField("you@example.com", text: $email)
                .font(.system(size: 16))
                .foregroundStyle(c.textPrimary)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .email)
                .submitLabel(.go)
                .onSubmit { sendLink() }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
    }

    // MARK: - Code phase

    private var codePhase: some View {
        VStack(spacing: 24) {
            Text("We sent a 6-digit code to \(email)")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
            otpInput
            PrimaryButton(
                title: isSubmitting ? "Verifying…" : "Verify code",
                systemImage: "checkmark.shield.fill",
                isLoading: isSubmitting,
                action: verifyCode,
                enabled: otpComplete && !isSubmitting
            )
            Button {
                Haptics.selection()
                withAnimation { phase = .email }
                otpCode = ""
                appState.authError = nil
            } label: {
                Text("Use a different email")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.accent)
            }
            Button {
                Haptics.selection()
                Task { await resendCode() }
            } label: {
                Text("Resend code")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(c.textSecondary)
            }
        }
    }

    /// Single hidden TextField overlaid with visual digit cells.
    /// Uses `.textContentType(.oneTimeCode)` for iOS SMS/email autofill.
    private var otpInput: some View {
        ZStack {
            // Invisible TextField handles all keyboard input + autofill
            TextField("", text: $otpCode)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focusedField, equals: .otp)
                .foregroundStyle(Color.clear)
                .background(.clear)
                .onChange(of: otpCode) { _, newValue in
                    // Filter to digits only, max 6
                    let filtered = newValue.filter { $0.isNumber }
                    otpCode = String(filtered.prefix(6))
                    // Auto-submit when 6 digits entered
                    if otpCode.count == 6 {
                        verifyCode()
                    }
                }
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .allowsHitTesting(true)

            // Visual digit cells
            HStack(spacing: 10) {
                ForEach(0..<6, id: \.self) { idx in
                    let digit = idx < otpCode.count
                        ? String(otpCode[otpCode.index(otpCode.startIndex, offsetBy: idx)])
                        : ""
                    let isActive = idx == otpCode.count && focusedField == .otp
                    OTPDigitCell(digit: digit, isActive: isActive)
                }
            }
            .allowsHitTesting(false)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            focusedField = .otp
        }
    }

    // MARK: - Error + demo

    private func errorBanner(_ msg: String) -> some View {
        Text(msg)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(c.danger)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(c.dangerSoft, in: .rect(cornerRadius: Radius.sm))
    }

    private var demoHint: some View {
        Text("Demo mode — backend not configured.\nEnter any email, then any 6 digits to sign in.")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(c.textMuted)
            .multilineTextAlignment(.center)
    }

    // MARK: - Actions

    private var isValidEmail: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        return trimmed.contains("@") && trimmed.contains(".")
    }

    private var otpComplete: Bool {
        otpCode.count == 6
    }

    private func sendLink() {
        guard isValidEmail else { return }
        Haptics.light()
        isSubmitting = true
        let emailCopy = email
        Task { @MainActor in
            defer { isSubmitting = false }
            let ok = await appState.sendMagicLink(email: emailCopy)
            if ok {
                withAnimation {
                    phase = .code
                    linkSent = true
                    appState.authError = nil
                }
                focusedField = .otp
            } else {
                appState.authError = "Could not send magic link. Check your email and try again."
            }
        }
    }

    private func verifyCode() {
        guard otpComplete else { return }
        Haptics.light()
        isSubmitting = true
        let emailCopy = email
        let codeCopy = otpCode
        Task { @MainActor in
            defer { isSubmitting = false }
            let ok = await appState.verifyOtp(email: emailCopy, token: codeCopy)
            if ok {
                Haptics.success()
            }
            // On success, RootView picks up authState change automatically.
            // On failure, authError is set by AppState.
        }
    }

    private func resendCode() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let ok = await appState.sendMagicLink(email: email)
        if !ok {
            appState.authError = "Could not resend code. Try again."
        }
    }
}

// MARK: - OTP digit cell (display only)

private struct OTPDigitCell: View {
    @Environment(\.porchivo) private var c
    let digit: String
    let isActive: Bool

    var body: some View {
        Text(digit)
            .font(.system(size: 24, weight: .bold, design: .rounded))
            .foregroundStyle(c.textPrimary)
            .frame(width: 48, height: 56)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(isActive ? c.accent : c.border, lineWidth: isActive ? 2 : 1)
                if isActive {
                    // Caret indicator on the active cell
                    Rectangle()
                        .fill(c.accent)
                        .frame(width: 2, height: 24)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: isActive)
    }
}

#Preview {
    LoginScreen()
        .environment(AppState())
}
