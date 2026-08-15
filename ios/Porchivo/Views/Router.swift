//
//  Router.swift
//  Porchivo
//
//  Type-safe routing for NavigationStack destinations.
//

import SwiftUI

enum Route: Hashable {
    case create
    case safety
    case alerts
    case addPackage
    case shipmentDetail(String)
    case packageDetail(String)
    case residentDirectory
    case chat(String) // threadId
    case editProfile
    case settings
    case orgSignup

    static func == (lhs: Route, rhs: Route) -> Bool {
        switch (lhs, rhs) {
        case (.create, .create), (.safety, .safety),
             (.alerts, .alerts), (.addPackage, .addPackage),
             (.residentDirectory, .residentDirectory),
             (.editProfile, .editProfile), (.settings, .settings),
             (.orgSignup, .orgSignup):
            return true
        case (.shipmentDetail(let a), .shipmentDetail(let b)): return a == b
        case (.packageDetail(let a), .packageDetail(let b)): return a == b
        case (.chat(let a), .chat(let b)): return a == b
        default: return false
        }
    }

    func hash(into hasher: inout Hasher) {
        switch self {
        case .create: hasher.combine(0)
        case .safety: hasher.combine(2)
        case .alerts: hasher.combine(3)
        case .addPackage: hasher.combine(4)
        case .shipmentDetail(let id): hasher.combine(5); hasher.combine(id)
        case .packageDetail(let id): hasher.combine(6); hasher.combine(id)
        case .residentDirectory: hasher.combine(7)
        case .chat(let id): hasher.combine(8); hasher.combine(id)
        case .editProfile: hasher.combine(9)
        case .settings: hasher.combine(10)
        case .orgSignup: hasher.combine(11)
        }
    }
}

/// Routes a `Route` to the right destination view inside a NavigationStack.
struct RouteView: View {
    let route: Route
    @Binding var path: NavigationPath

    var body: some View {
        switch route {
        case .create:        CreateScreen()
        case .safety:        SafetyScreen()
        case .alerts:        AlertsScreen()
        case .addPackage:    AddPackageScreen()
        case .shipmentDetail(let id): ShipmentDetailScreen(shipmentId: id)
        case .packageDetail(let id):  PackageDetailScreen(packageId: id)
        case .residentDirectory:      ResidentDirectoryScreen()
        case .chat(let threadId):      ChatScreen(threadId: threadId)
        case .editProfile:   EditProfileScreen()
        case .settings:      SettingsScreen()
        case .orgSignup:     OrgSignupScreen()
        }
    }
}
