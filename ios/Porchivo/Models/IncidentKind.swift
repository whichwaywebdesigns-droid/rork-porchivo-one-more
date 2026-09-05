//
//  IncidentKind.swift
//  Porchivo
//
//  Incident types mirroring the DB `incident_type` enum on `incident_reports`.
//  Mirrors the Expo app's file-incident screen.
//

import Foundation

enum IncidentKind: String, CaseIterable, Identifiable {
    case missingPackage = "missing_package"
    case deliveredNotFound = "delivered_not_found"
    case misdelivered
    case damaged
    case tampered
    case suspiciousActivity = "suspicious_activity"
    case heldTooLong = "held_too_long"
    case wrongPickup = "wrong_pickup"
    case ruleViolation = "rule_violation"
    case carrierFailure = "carrier_failure"
    case duplicateComplaint = "duplicate_complaint"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .missingPackage: return "Package missing"
        case .deliveredNotFound: return "Delivered but not found"
        case .misdelivered: return "Delivered to wrong unit"
        case .damaged: return "Package damaged"
        case .tampered: return "Opened or tampered with"
        case .suspiciousActivity: return "Suspicious activity"
        case .heldTooLong: return "Held too long"
        case .wrongPickup: return "Wrong person picked up"
        case .ruleViolation: return "Outside delivery rules"
        case .carrierFailure: return "Carrier didn't follow instructions"
        case .duplicateComplaint: return "Duplicate complaint"
        case .other: return "Something else"
        }
    }

    var emoji: String {
        switch self {
        case .missingPackage: return "📦"
        case .deliveredNotFound: return "🔍"
        case .misdelivered: return "📬"
        case .damaged: return "💥"
        case .tampered: return "🔓"
        case .suspiciousActivity: return "🚨"
        case .heldTooLong: return "⏳"
        case .wrongPickup: return "🙅"
        case .ruleViolation: return "📋"
        case .carrierFailure: return "🚚"
        case .duplicateComplaint: return "🔁"
        case .other: return "❓"
        }
    }

    /// Default one-line title, pre-filled when the user picks a type.
    var defaultTitle: String {
        switch self {
        case .missingPackage: return "Package missing from expected location"
        case .deliveredNotFound: return "Carrier marked delivered but package not found"
        case .misdelivered: return "Package delivered to wrong unit"
        case .damaged: return "Package arrived damaged"
        case .tampered: return "Package appears opened or tampered with"
        case .suspiciousActivity: return "Suspicious activity near delivery area"
        case .heldTooLong: return "Package held in common area too long"
        case .wrongPickup: return "Package picked up by wrong person"
        case .ruleViolation: return "Delivery made outside community rules"
        case .carrierFailure: return "Carrier failed to follow delivery instructions"
        case .duplicateComplaint: return "Duplicate complaint about same package"
        case .other: return "Package delivery issue"
        }
    }

    /// Package-issue types where the carrier handles claims — shows the
    /// carrier reminder and the estimated-value field.
    var isCarrierAction: Bool {
        switch self {
        case .missingPackage, .deliveredNotFound, .misdelivered, .damaged, .tampered, .carrierFailure:
            return true
        case .suspiciousActivity, .heldTooLong, .wrongPickup, .ruleViolation, .duplicateComplaint, .other:
            return false
        }
    }
}
