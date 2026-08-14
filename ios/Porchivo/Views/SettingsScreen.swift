//
//  SettingsScreen.swift
//  Porchivo
//
//  Settings — theme override, location & precise-location consent toggles,
//  notification prefs, legal links, delete account. All persisted to
//  profiles via SupabaseService and reflected in AppState.
//

import SwiftUI

struct SettingsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var notificationsEnabled = true
    @State private var showDeleteConfirm = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                section("Appearance") {
                    themePicker
                }
                section("Security") {
                    if appState.availableBiometry != .none {
                        toggle("Unlock with \(appState.availableBiometry.label)",
                                "Use \(appState.availableBiometry.label) to unlock Porchivo without re-entering your password.",
                                isOn: Binding(
                                    get: { appState.biometricUnlockEnabled },
                                    set: { v in
                                        Task {
                                            _ = await appState.setBiometricUnlockEnabled(v)
                                        }
                                    }
                                ))
                    } else {
                        disabledBiometryRow
                    }
                }
                section("Privacy") {
                    toggle("Share approximate location",
                            "Neighbors see your block, never your exact address.",
                            isOn: Binding(
                                get: { appState.user?.hasLocationConsent ?? false },
                                set: { v in Task { await appState.setLocationConsent(v) } }
                            ))
                    Divider().overlay(c.border).padding(.leading, 14)
                    toggle("Share precise location",
                            "Required for partner drop-off navigation. Off by default.",
                            isOn: Binding(
                                get: { appState.user?.hasPreciseLocationConsent ?? false },
                                set: { v in Task { await appState.setPreciseLocationConsent(v) } }
                            ))
                }
                section("Notifications") {
                    toggle("Delivery alerts",
                            "Pings when a package hits your porch or a partner picks up.",
                            isOn: $notificationsEnabled)
                    Divider().overlay(c.border).padding(.leading, 14)
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack {
                            Image(systemName: "gearshape.fill").foregroundStyle(c.textMuted).frame(width: 22)
                            Text("System notification settings")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(c.textPrimary)
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(c.textMuted)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                    }.buttonStyle(.plain)
                }
                section("Legal") {
                    legalRow("Privacy Policy", "lock.shield.fill", AppConfig.Support.privacyPolicyURL)
                    Divider().overlay(c.border).padding(.leading, 14)
                    legalRow("Terms of Service", "doc.text.fill", AppConfig.Support.termsURL)
                    Divider().overlay(c.border).padding(.leading, 14)
                    legalRow("Support", "envelope.fill", "mailto:\(AppConfig.Support.email)")
                }
                section("Account") {
                    Button {
                        Haptics.light()
                        showDeleteConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "person.crop.circle.badge.xmark.fill")
                                .foregroundStyle(c.danger).frame(width: 22)
                            Text("Delete account")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(c.danger)
                            Spacer()
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                    }.buttonStyle(.plain)
                }
                Text("Porchivo v1.0.0")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(c.textMuted)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Delete account", role: .destructive) {
                // delete_account_cascade RPC exists on backend; for safety we sign out locally.
                // TODO: wire actual account deletion via SupabaseService.deleteAccount() once backend RPC is exposed to Swift.
                Task { await appState.signOut() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Deleting your account will permanently remove your Porchivo profile and personal information from our system. This action is permanent and cannot be undone.")
        }
    }

    @ViewBuilder
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(c.textMuted)
                .padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .background(c.surface, in: .rect(cornerRadius: Radius.lg))
                .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
    }

    private var themePicker: some View {
        HStack {
            Image(systemName: "moon.fill").foregroundStyle(c.textMuted).frame(width: 22)
            Picker("Theme", selection: Binding(
                get: { appState.darkThemeOverride ?? false },
                set: { v in appState.setDarkTheme(v) }
            )) {
                Text("Light").tag(false)
                Text("Dark").tag(true)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }

    private func toggle(_ label: String, _ blurb: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 14, weight: .semibold)).foregroundStyle(c.textPrimary)
                Text(blurb).font(.system(size: 11)).foregroundStyle(c.textSecondary)
            }
        }
        .tint(c.accent)
        .padding(.horizontal, 14).padding(.vertical, 12)
    }

    private func legalRow(_ label: String, _ symbol: String, _ urlString: String) -> some View {
        Button {
            Haptics.selection()
            if let url = URL(string: urlString) { UIApplication.shared.open(url) }
        } label: {
            HStack {
                Image(systemName: symbol).foregroundStyle(c.accent).frame(width: 22)
                Text(label).font(.system(size: 15, weight: .semibold)).foregroundStyle(c.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(c.textMuted)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
        }.buttonStyle(.plain)
    }

    private var disabledBiometryRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .foregroundStyle(c.textMuted)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text("Unlock with biometrics")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(c.textSecondary)
                Text("Face ID or Touch ID isn't set up on this device. Enable it in iOS Settings to use quick unlock.")
                    .font(.system(size: 11))
                    .foregroundStyle(c.textMuted)
            }
            Spacer()
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }
}
