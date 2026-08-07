import UIKit
import UserNotifications
import SwiftUI
import os.log

final class PorchivoAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var appState: AppState? {
        didSet { registerForRemoteNotificationsIfNeeded() }
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        os_log("Registered for remote notifications: %{private}@", log: .default, type: .info, String(token.suffix(8)))
        Task { @MainActor in
            await appState?.registerAPNSToken(token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        os_log("Failed to register for remote notifications: %@", log: .default, type: .error, error.localizedDescription)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let shipmentId = userInfo["shipmentId"] as? String {
            Task { @MainActor in
                appState?.pendingDeepLinkShipmentId = shipmentId
            }
        }
        completionHandler()
    }

    private func registerForRemoteNotificationsIfNeeded() {
        guard appState != nil else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }
}
