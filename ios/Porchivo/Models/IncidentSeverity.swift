//
//  IncidentSeverity.swift
//  Porchivo
//
//  Incident severity values mirroring the DB `incident_severity` enum.
//

import Foundation

enum IncidentSeverity: String, CaseIterable, Identifiable {
    case low
    case medium
    case high
    case critical

    var id: String { rawValue }

    var label: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
}
