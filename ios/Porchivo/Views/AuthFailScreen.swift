//
//  AuthFailScreen.swift
//  Porchivo
//
//  "Oops!" screen — shown when a user attempts to sign in without having
//  created an account first. Displays the brand logo, a friendly message,
//  and a back arrow to return to the login screen.
//

import SwiftUI

struct AuthFailScreen: View {
    @Environment(\.porchivo) private var c
    let onBack: () -> Void
    let onCreateAccount: () -> Void

    @State private var logoScale: CGFloat = 0.8
    @State private var contentOpacity: Double = 0
    @State private var contentOffset: CGFloat = 30

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Back arrow
                HStack {
                    Button {
                        Haptics.light()
                        onBack()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(c.accent)
                            .frame(width: 44, height: 44)
                            .background(c.surface, in: .circle)
                            .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                Spacer()

                // Logo
                BrandLogoWithBox(logoSize: 100)
                    .scaleEffect(logoScale)
                    .padding(.bottom, 32)

                // Message
                VStack(spacing: 12) {
                    Text("Oops!")
                        .font(.system(size: 42, weight: .heavy, design: .rounded))
                        .foregroundStyle(c.textPrimary)

                    Text("We couldn't find an account with that email.\nYou need to create an account first to sign in.")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }
                .opacity(contentOpacity)
                .offset(y: contentOffset)
                .padding(.horizontal, 32)
                .padding(.bottom, 40)

                // Buttons
                VStack(spacing: 12) {
                    Button {
                        Haptics.light()
                        onBack()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 16, weight: .bold))
                            Text("Back to Login")
                                .font(.system(size: 17, weight: .bold))
                        }
                        .foregroundStyle(c.onAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(c.accent, in: .rect(cornerRadius: Radius.lg))
                        .shadow(color: c.accent.opacity(0.3), radius: 8, y: 4)
                    }
                    .buttonStyle(.plain)

                    Button {
                        Haptics.selection()
                        onCreateAccount()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "person.badge.plus")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Create an Account")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .foregroundStyle(c.accent)
                        .padding(.vertical, 14)
                        .padding(.horizontal, 24)
                    }
                    .buttonStyle(.plain)
                }
                .opacity(contentOpacity)
                .offset(y: contentOffset)
                .padding(.horizontal, 32)
                .frame(maxWidth: 360)

                Spacer()

                // Support link
                Button {
                    Haptics.selection()
                    if let url = URL(string: "mailto:support@porchivo.com?subject=Porchivo%20Support") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "questionmark.circle")
                            .font(.system(size: 13))
                        Text("Need help? Contact support")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(c.textMuted)
                }
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            Haptics.error()
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                logoScale = 1
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.1)) {
                contentOpacity = 1
                contentOffset = 0
            }
        }
    }
}

#Preview {
    AuthFailScreen(
        onBack: {},
        onCreateAccount: {}
    )
    .environment(AppState())
}
