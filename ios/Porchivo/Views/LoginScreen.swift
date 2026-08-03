//
//  LoginScreen.swift
//  Porchivo
//
//  Email/password sign-in + sign-up toggle. On success the root auth switch
//  routes to onboarding (if needed) or the main TabView.
//

import SwiftUI

struct LoginScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var isSubmitting = false

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 48)
                    brandBlock
                    fields
                    if let err = appState.authError {
                        Text(err)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(c.danger)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }
                    submitButton
                    toggleButton
                    if appState.isSupabaseConfigured == false {
                        demoHint
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }

    private var brandBlock: some View {
        VStack(spacing: 12) {
            BrandLogoWithBox(logoSize: 64)
            Text("Porchivo")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(c.textPrimary)
            Text(isSignUp ? "Create your account" : "Welcome back")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(c.textSecondary)
        }
    }

    private var fields: some View {
        VStack(spacing: 12) {
            field(symbol: "envelope.fill", placeholder: "Email", text: $email, isSecure: false)
            field(symbol: "lock.fill", placeholder: "Password", text: $password, isSecure: true)
        }
    }

    private func field(symbol: String, placeholder: String, text: Binding<String>, isSecure: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(c.textMuted)
            Group {
                if isSecure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .font(.system(size: 15))
            .foregroundStyle(c.textPrimary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
    }

    private var submitButton: some View {
        PrimaryButton(
            title: isSignUp ? "Create Account" : "Sign In",
            systemImage: isSignUp ? "person.crop.circle.badge.plus" : "arrow.right.circle.fill",
            isLoading: isSubmitting,
            action: submit,
            enabled: !email.isEmpty && !password.isEmpty
        )
    }

    private var toggleButton: some View {
        Button {
            Haptics.selection()
            isSignUp.toggle()
            appState.authError = nil
        } label: {
            Text(isSignUp ? "Already have an account? Sign in"
                          : "New to Porchivo? Create an account")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.accent)
        }
    }

    private var demoHint: some View {
        Text("Demo mode — backend not configured. Any email/password signs in.")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(c.textMuted)
            .multilineTextAlignment(.center)
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        Haptics.light()
        isSubmitting = true
        let emailCopy = email
        let passwordCopy = password
        let signUp = isSignUp
        Task { @MainActor in
            defer { isSubmitting = false }
            if signUp {
                _ = await appState.signUp(email: emailCopy, password: passwordCopy)
            } else {
                _ = await appState.signIn(email: emailCopy, password: passwordCopy)
            }
        }
    }
}

#Preview {
    LoginScreen()
        .environment(AppState())
}
