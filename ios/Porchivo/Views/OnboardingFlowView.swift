//
//  OnboardingFlowView.swift
//  Porchivo
//
//  Value-first onboarding (9 steps, iOS):
//  Welcome → Role selection → Profile setup → Add delivery →
//  Silent alerts (provisional) → Live Activity → Self-upgrade →
//  Priming (one-shot prompt) → Re-opt-in (conditional) → Home.
//
//  Design principle: value before asks. Every permission is earned by a
//  moment the user just experienced. The one-shot system prompt is never
//  spent cold — it fires only at peak intent, after demonstrated value.
//

import SwiftUI
import UserNotifications
import Combine

struct OnboardingFlowView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var viewModel = OnboardingViewModel()

    var body: some View {
        ZStack {
            c.background.ignoresSafeArea()
            VStack(spacing: 0) {
                progressBar
                Group {
                    switch viewModel.step {
                    case 0: welcomeStep
                    case 1: roleSelectionStep
                    case 2: onboardingSetupStep
                    case 3: addDeliveryStep
                    case 4: silentAlertsStep
                    case 5: liveActivityStep
                    case 6: selfUpgradeStep
                    case 7: primingStep
                    default: reOptInStep
                    }
                }
                .frame(maxHeight: .infinity)
                .transition(.opacity)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .animation(.easeInOut(duration: 0.35), value: viewModel.step)
        .task { await viewModel.checkNotifStatus() }
    }

    // MARK: - Progress

    private var progressBar: some View {
        HStack(spacing: 6) {
            ForEach(0..<viewModel.totalSteps, id: \.self) { i in
                Capsule()
                    .fill(i <= viewModel.step ? c.accent : c.elevated)
                    .frame(width: i == viewModel.step ? 24 : 8, height: 8)
                    .animation(.spring, value: viewModel.step)
            }
        }
        .padding(.top, 16)
    }

    // MARK: - Step 0: Welcome

    private var welcomeStep: some View {
        VStack(spacing: 20) {
            Spacer()
            
            // Auto-advancing image carousel (4 slides)
            ZStack {
                ForEach(0..<viewModel.welcomeSlideCount, id: \.self) { i in
                    Image(viewModel.welcomeSlideNames[i])
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(.rect(cornerRadius: Radius.lg))
                        .opacity(i == viewModel.welcomeSlideIndex ? 1 : 0)
                        .accessibilityLabel("Porchivo onboarding illustration")
                        .accessibilityHidden(i != viewModel.welcomeSlideIndex)
                }
            }
            .frame(maxHeight: 300)
            
            // Dot indicators
            HStack(spacing: 8) {
                ForEach(0..<viewModel.welcomeSlideCount, id: \.self) { i in
                    Capsule()
                        .fill(i == viewModel.welcomeSlideIndex ? c.accent : c.elevated)
                        .frame(width: i == viewModel.welcomeSlideIndex ? 24 : 8, height: 8)
                        .animation(.spring(duration: 0.3), value: viewModel.welcomeSlideIndex)
                }
            }
            
            VStack(spacing: 10) {
                Text("Your porch, protected.")
                    .font(.system(size: 30, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Track every delivery, see your theft risk in real time, and team up with neighbors to stop porch pirates.")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
                Text("Great for when you are going to be home late or about to take a vacation!")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.accent)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            }
            Spacer()
            PrimaryButton(title: "Get started", systemImage: "arrow.right") {
                Haptics.light()
                viewModel.advance()
            }
        }
        .onReceive(Timer.publish(every: 3.5, on: .main, in: .common).autoconnect()) { _ in
            if viewModel.step == 0 {
                viewModel.advanceWelcomeSlide()
            }
        }
    }

    // MARK: - Step 1: Role selection

    private var roleSelectionStep: some View {
        RoleSelectionScreen(onContinue: { role in
            viewModel.selectedRole = role
            viewModel.advance()
        }, onSkip: {
            viewModel.advance()
        })
    }

    // MARK: - Step 2: Profile setup

    private var onboardingSetupStep: some View {
        OnboardingSetupScreen(role: viewModel.selectedRole, onContinue: {
            viewModel.advance()
        }, onSkip: {
            viewModel.advance()
        })
    }

    // MARK: - Step 3: Add your first delivery

    private var addDeliveryStep: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 8) {
                    Text("Add your first delivery")
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(c.textPrimary)
                    Text("Porchivo starts watching the moment a package is in the system.")
                        .font(.system(size: 14))
                        .foregroundStyle(c.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text("TRACKING NUMBER")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1.4)
                        .foregroundStyle(c.textMuted)
                    HStack(spacing: 10) {
                        Image(systemName: "barcode.viewfinder")
                            .foregroundStyle(c.textMuted)
                        TextField("", text: $viewModel.trackingNumber)
                            .font(.system(size: 15))
                            .foregroundStyle(c.textPrimary)
                            .textInputAutocapitalization(.characters)
                            .onChange(of: viewModel.trackingNumber) { _, newValue in
                                viewModel.selectedCarrier = viewModel.detectCarrier(newValue)
                            }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .background(c.surface, in: .rect(cornerRadius: Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("CARRIER")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1.4)
                        .foregroundStyle(c.textMuted)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Carrier.allCases.filter { $0 != .other }) { carrier in
                                Button {
                                    Haptics.selection()
                                    viewModel.selectedCarrier = carrier
                                } label: {
                                    Text(carrier.label)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(viewModel.selectedCarrier == carrier ? c.onAccent : c.textSecondary)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 9)
                                        .background(viewModel.selectedCarrier == carrier ? c.accent : c.elevated, in: .capsule)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                Spacer()

                VStack(spacing: 12) {
                    PrimaryButton(title: "Track my package", systemImage: "arrow.right") {
                        viewModel.addDelivery(into: appState)
                    }
                    Button("Skip for now") { viewModel.advance() }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                }
            }
            .padding(.vertical, 16)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: - Step 4: Silent alerts (provisional push)

    private var silentAlertsStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 56, weight: .heavy))
                .foregroundStyle(c.accent)
            VStack(spacing: 10) {
                Text("Delivery updates will appear quietly")
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Porchivo uses Apple's provisional notifications — alerts arrive silently in your Notification Center with nothing to set up.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Notification mock
            NotifMock(
                title: "Your UPS package was delivered",
                message: "Theft Shield: LOW RISK · It's safe to grab it when you're home.",
                timeLabel: "now",
                accent: c.accent
            )
            .padding(.horizontal, 4)

            Spacer()
            PrimaryButton(title: "Continue", systemImage: "arrow.right") {
                Task { await viewModel.requestProvisionalAuth() }
            }
        }
    }

    // MARK: - Step 5: Live Activity

    private var liveActivityStep: some View {
        VStack(spacing: 20) {
            Spacer()
            VStack(spacing: 8) {
                Text("Your Lock Screen becomes your tracker")
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)
                Text("A Live Activity puts your delivery — ETA and Theft Shield score — on the Lock Screen and Dynamic Island, updating in real time.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }

            LockScreenMock()
                .frame(maxWidth: 320)
                .clipShape(.rect(cornerRadius: 36))
                .overlay(RoundedRectangle(cornerRadius: 36).stroke(c.border, lineWidth: 3))
                .shadow(color: .black.opacity(0.4), radius: 20, y: 10)

            Spacer()
            PrimaryButton(title: "Continue", systemImage: "arrow.right") {
                viewModel.advance()
            }
        }
    }

    // MARK: - Step 6: Self-upgrade

    private var selfUpgradeStep: some View {
        VStack(spacing: 20) {
            Spacer()
            VStack(spacing: 8) {
                Text("Apple converts the user for you")
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Provisional notifications arrive with Apple-rendered buttons. Tap \"Deliver Prominently\" to upgrade to full alerts — no extra setup needed.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }

            NotificationCenterMock(accent: c.accent)
                .padding(.horizontal, 4)

            Spacer()
            PrimaryButton(title: "Continue", systemImage: "arrow.right") {
                viewModel.advance()
            }
        }
    }

    // MARK: - Step 7: Priming (one-shot prompt)

    private var primingStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48, weight: .heavy))
                .foregroundStyle(c.danger)

            // High-risk warning card
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("HIGH RISK WINDOW")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(c.danger)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(c.dangerSoft, in: .capsule)
                    Spacer()
                }
                Text("Theft Shield flagged tomorrow's 1:40 PM delivery as high-risk.")
                    .font(.system(size: 19, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                Text("Alerts are the only way to know the moment it lands. Don't let it sit.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
            }
            .padding(18)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Radius.lg).stroke(c.danger.opacity(0.4), lineWidth: 1.5))

            Spacer()
            VStack(spacing: 12) {
                PrimaryButton(title: "Turn on alerts", systemImage: "bell.fill") {
                    Task { await viewModel.requestFullAuth(in: appState) }
                }
                Button("Not now") {
                    Haptics.selection()
                    viewModel.advance() // → re-opt-in step
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            }
        }
    }

    // MARK: - Step 8: Re-opt-in (conditional — deniers only)

    private var reOptInStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "bell.slash.fill")
                .font(.system(size: 48, weight: .heavy))
                .foregroundStyle(c.danger)

            VStack(spacing: 10) {
                Text("That delivery was HIGH RISK")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(c.textPrimary)
                    .multilineTextAlignment(.center)
                Text("And your alerts were off. It sat unattended for 47 minutes. Turn alerts on so the next one doesn't.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Delivery card mock
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("UPS · Delivered 1:42 PM")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Spacer()
                    Text("HIGH")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(c.danger)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(c.dangerSoft, in: .capsule)
                }
                Text("Sat unattended 47 min")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
            }
            .padding(16)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))

            Spacer()
            VStack(spacing: 12) {
                PrimaryButton(title: "Turn alerts on", systemImage: "bell.fill") {
                    Haptics.light()
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                    viewModel.completeOnboarding(in: appState)
                }
                Button("Continue without alerts") {
                    viewModel.completeOnboarding(in: appState)
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            }
        }
    }
}

// MARK: - Notification Mock

private struct NotifMock: View {
    let title: String
    let message: String
    let timeLabel: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(accent)
                Text("PORCHIVO")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(.white.opacity(0.6))
                Spacer()
                Text(timeLabel)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))
            }
            Text(title)
                .font(.system(size: 13.5, weight: .bold))
                .foregroundStyle(.white)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.75))
        }
        .padding(14)
        .background(Color(hex: 0x1C263A).opacity(0.92), in: .rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.08), lineWidth: 1))
    }
}

// MARK: - Lock Screen Mock (Live Activity)

private struct LockScreenMock: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x16233C), Color(hex: 0x0C1526), Color(hex: 0x080D17)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(spacing: 0) {
                // Dynamic Island
                HStack(spacing: 6) {
                    Circle().fill(Color(hex: 0x2FBF71)).frame(width: 7, height: 7)
                    Text("UPS · 12 min · LOW")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.black, in: .capsule)
                .overlay(Capsule().stroke(Color(hex: 0x22304A), lineWidth: 1))
                .padding(.top, 12)

                Spacer().frame(height: 20)

                // Time
                VStack(spacing: 2) {
                    Text("9:41")
                        .font(.system(size: 64, weight: .thin))
                        .foregroundStyle(.white)
                    Text("Tuesday, June 9")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color(hex: 0xB9C7DA))
                }

                Spacer().frame(height: 28)

                // Live Activity card
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: "shippingbox.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color(hex: 0xFFC95E))
                        Text("PORCHIVO · LIVE TRACKING")
                            .font(.system(size: 12, weight: .heavy))
                            .tracking(0.5)
                            .foregroundStyle(Color(hex: 0xFFC95E))
                    }
                    Text("12 min away")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    Text("UPS package arriving soon")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                    Text("Theft Shield: LOW RISK · 4 stops away")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.6))
                    // Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(hex: 0x1C2940))
                                .frame(height: 5)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(
                                    LinearGradient(
                                        colors: [Color(hex: 0xF5A623), Color(hex: 0xFFC95E)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geo.size.width * 0.68, height: 5)
                        }
                    }
                    .frame(height: 5)
                }
                .padding(16)
                .background(Color(hex: 0x121A2A).opacity(0.94), in: .rect(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0x22304A), lineWidth: 1))
                .padding(.horizontal, 16)

                Spacer()
            }
            .padding(.vertical, 8)
        }
        .frame(height: 480)
    }
}

// MARK: - Notification Center Mock (Self-upgrade)

private struct NotificationCenterMock: View {
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Notification Center")
                .font(.system(size: 13, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(.white.opacity(0.5))
                .padding(.top, 16)

            // Recent notification (with actions)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(accent)
                    Text("PORCHIVO")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.5)
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Text("2m ago")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.4))
                }
                Text("Your package is 4 stops away")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(.white)
                Text("Theft Shield: LOW RISK · On track for the 2:00–4:00 PM window.")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.75))
                // Actions
                HStack(spacing: 0) {
                    Text("Turn Off")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    Divider().frame(height: 18)
                    Text("Deliver Prominently")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .padding(.top, 6)
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(.white.opacity(0.08))
                        .frame(height: 0.5)
                }
            }
            .padding(14)
            .background(Color(hex: 0x1C263A).opacity(0.92), in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08), lineWidth: 1))

            // Older notification (dimmed)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(accent.opacity(0.55))
                    Text("PORCHIVO")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.5)
                        .foregroundStyle(.white.opacity(0.35))
                    Spacer()
                    Text("1h ago")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.3))
                }
                Text("UPS package out for delivery")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(.white.opacity(0.55))
                Text("Arriving today, 2:00–4:00 PM.")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(14)
            .background(Color(hex: 0x1C263A).opacity(0.5), in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.04), lineWidth: 1))

            Spacer()
        }
        .padding(.horizontal, 4)
        .background(
            LinearGradient(
                colors: [Color(hex: 0x131F35), Color(hex: 0x080D17)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }
}

#Preview {
    OnboardingFlowView().environment(AppState())
}
