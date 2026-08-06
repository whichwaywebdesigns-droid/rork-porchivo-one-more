//
//  OnboardingViewModel.swift
//  Porchivo
//
//  Holds state and business logic for the value-first onboarding flow.
//  Mirrors the MVVM pattern from the approved iOS plan.
//

import SwiftUI
import UserNotifications

@Observable
final class OnboardingViewModel {
    var step = 0
    var selectedRole: UserRole = .homeowner
    var trackingNumber = ""
    var selectedCarrier: Carrier = .ups
    var notifStatus: UNAuthorizationStatus = .notDetermined
    var provisionalGranted = false
    var isCompleting = false

    let totalSteps = 9

    var progress: Double {
        totalSteps > 1 ? Double(step) / Double(totalSteps - 1) : 0
    }

    func advance() {
        Haptics.light()
        withAnimation { step += 1 }
    }

    func addDelivery(into appState: AppState) {
        Haptics.light()
        let pkg = TrackedPackage(
            id: UUID().uuidString,
            name: "\(selectedCarrier.label) package",
            carrier: selectedCarrier,
            trackingNumber: trackingNumber.isEmpty ? "1Z999AA10123456784" : trackingNumber,
            expectedDeliveryDate: Date().addingTimeInterval(4 * 3600),
            currentStatus: .outForDelivery,
            addressNickname: .home,
            notesForPartner: "",
            statusHistory: [
                PackageStatusEvent(status: .ordered, timestamp: Date().addingTimeInterval(-72 * 3600), completed: true),
                PackageStatusEvent(status: .shipped, timestamp: Date().addingTimeInterval(-30 * 3600), completed: true),
                PackageStatusEvent(status: .outForDelivery, timestamp: Date().addingTimeInterval(-3 * 3600), completed: true),
            ],
            createdAt: Date().addingTimeInterval(-72 * 3600)
        )
        appState.addPackage(pkg)
        advance()
    }

    func detectCarrier(_ tracking: String) -> Carrier {
        let upper = tracking.uppercased()
        if upper.hasPrefix("1Z") { return .ups }
        if upper.hasPrefix("TBA") { return .amazon }
        if upper.hasPrefix("79") || upper.hasPrefix("1Z") { return .fedex }
        if upper.hasPrefix("94") || upper.hasPrefix("92") || upper.hasPrefix("93") { return .usps }
        return selectedCarrier
    }

    func checkNotifStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        await MainActor.run { notifStatus = settings.authorizationStatus }
    }

    func requestProvisionalAuth() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            do {
                _ = try await center.requestAuthorization(options: [.alert, .sound, .provisional])
                provisionalGranted = true
            } catch {
                // Non-fatal — continue
            }
        } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            provisionalGranted = true
        }
        await MainActor.run { advance() }
    }

    func requestFullAuth(in appState: AppState) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()

        var granted = false
        if settings.authorizationStatus == .authorized {
            granted = true
        } else if settings.authorizationStatus != .denied {
            do {
                granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                granted = false
            }
        }

        await MainActor.run {
            if granted {
                Haptics.success()
                completeOnboarding(in: appState)
            } else {
                Haptics.error()
                advance() // → re-opt-in
            }
        }
    }

    func completeOnboarding(in appState: AppState) {
        guard !isCompleting else { return }
        isCompleting = true
        Haptics.success()
        Task { @MainActor in
            defer { isCompleting = false }
            // The profile setup screen already writes name/phone/address to the
            // user record. Fall back to whatever is present to avoid overwriting.
            await appState.completeOnboarding(
                name: appState.user?.name ?? "",
                phone: appState.user?.phone ?? "",
                address: appState.user?.address ?? "",
                role: selectedRole,
                hasLocationConsent: false
            )
            // Promote authState so RootView re-evaluates and switches to MainTabView.
            if case .authenticated(let id) = appState.authState {
                appState.authState = .authenticated(id)
            }
        }
    }
}
