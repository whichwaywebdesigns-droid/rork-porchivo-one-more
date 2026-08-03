//
//  BiometricAuthService.swift
//  Porchivo
//
//  Thin wrapper over LocalAuthentication for Face ID / Touch ID unlock.
//  Lets returning users restore their Supabase session without re-entering
//  credentials. The Swift analog of expo-local-authentication on the Expo app.
//

import Foundation
import LocalAuthentication

/// Strongest biometry available on this device.
enum BiometryType: Equatable, Sendable {
    case none
    case faceID
    case touchID
    case opticID

    var label: String {
        switch self {
        case .none: return "Biometrics"
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        }
    }

    var systemImage: String {
        switch self {
        case .none: return "lock.fill"
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        }
    }

    var unlockVerb: String {
        switch self {
        case .none: return "Unlock"
        case .faceID: return "Unlock with Face ID"
        case .touchID: return "Unlock with Touch ID"
        case .opticID: return "Unlock with Optic ID"
        }
    }
}

enum BiometricAuthService {
    /// Detects the strongest available biometry on the device. Returns `.none`
    /// when no hardware is present, the user has no enrolled biometric, or the
    /// policy cannot be evaluated.
    static func availableType() -> BiometryType {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        case .none: return .none
        @unknown default: return .none
        }
    }

    /// Prompts the user for biometric authentication, falling back to the
    /// device passcode if biometrics fail or are unavailable mid-prompt.
    /// Returns `true` on success, `false` on cancel/failure.
    static func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Password"
        context.localizedCancelTitle = "Cancel"
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            return success
        } catch {
            return false
        }
    }
}
