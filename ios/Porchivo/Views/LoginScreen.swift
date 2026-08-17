//
//  LoginScreen.swift
//  Porchivo
//
//  Magic link authentication with the Porchivo welcome-porch hero illustration.
//  Email → 6-digit OTP code → verified. No passwords. A developer login link
//  sits under the magic link button for internal testing bypass.
//

import SwiftUI

struct LoginScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.colorScheme) private var colorScheme

    @State private var email = ""
    @State private var otpCode = ""
    @State private var phase: AuthPhase = .email
    @State private var isSubmitting = false
    @State private var linkSent = false
    @State private var showAuthFail = false
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
        if showAuthFail {
            AuthFailScreen(
                onBack: {
                    showAuthFail = false
                    phase = .email
                    otpCode = ""
                    appState.authError = nil
                },
                onCreateAccount: {
                    showAuthFail = false
                    phase = .email
                    otpCode = ""
                    appState.authError = nil
                }
            )
        } else {
        ZStack {
            // Hero illustration fills the background. In dark mode we dim it
            // slightly so the white porch remains readable without clashing.
            Image("LoginHero")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .ignoresSafeArea()
                .overlay(colorScheme == .dark ? Color.black.opacity(0.28) : Color.clear)

            // Scrollable controls overlay the bottom half of the illustration.
            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 420)
                    controlsCard
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onAppear { focusedField = .email }
        }
    }

    // MARK: - Bottom controls card

    private var controlsCard: some View {
        VStack(spacing: 20) {
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
        .padding(24)
        .background(
            .ultraThinMaterial,
            in: .rect(cornerRadius: Radius.xl)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.xl)
                .stroke(Color.white.opacity(0.35), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.12), radius: 24, x: 0, y: 12)
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
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }
            developerLoginLink
        }
    }

    private var emailField: some View {
        HStack(spacing: 10) {
            Image(systemName: "envelope.fill")
                .foregroundStyle(Color(hex: 0x8B5E3C))
            TextField("Enter your email", text: $email)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: 0x3D2B1F))
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .email)
                .submitLabel(.go)
                .onSubmit { sendLink() }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(Color(hex: 0xF5E6D3), in: .rect(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(Color(hex: 0xD4A574), lineWidth: 1)
        )
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

    // MARK: - Developer bypass

    private var developerLoginLink: some View {
        Button {
            Haptics.selection()
            isSubmitting = true
            Task { @MainActor in
                appState.developerLogin()
                isSubmitting = false
            }
        } label: {
            Text("Developer login")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(c.textSecondary)
                .underline()
        }
        .disabled(isSubmitting)
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
                // authError is already set by AppState with the real Supabase error.
                // Only set a fallback if AppState didn't populate one.
                if appState.authError == nil {
                    appState.authError = "Could not send magic link. Check your email and try again."
                }
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
            } else {
                // If the error suggests the user doesn't have an account,
                // show the oops screen instead of an inline error.
                let err = appState.authError ?? ""
                if err.lowercased().contains("invalid") || err.lowercased().contains("expired") || err.lowercased().contains("code") {
                    // Wrong/expired code — keep inline error
                } else {
                    showAuthFail = true
                }
            }
            // On success, RootView picks up authState change automatically.
            // On failure, authError is set by AppState.
        }
    }

    private func resendCode() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let ok = await appState.sendMagicLink(email: email)
        if !ok && appState.authError == nil {
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
