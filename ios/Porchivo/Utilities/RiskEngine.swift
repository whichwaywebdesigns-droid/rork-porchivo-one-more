//
//  RiskEngine.swift
//  Porchivo
//
//  Porch risk scoring — mirrors expo RISK_THRESHOLDS.factors and android RiskEngine.kt.
//

import Foundation

enum RiskEngine {
    struct RiskFactor: Identifiable, Equatable {
        let id = UUID()
        let label: String
        let delta: Int
    }

    enum RiskLevel: String {
        case low, medium, high
        var label: String {
            switch self {
            case .low: "Low Risk"
            case .medium: "Medium Risk"
            case .high: "High Risk"
            }
        }
    }

    static func factors(_ shipments: [Shipment]) -> [RiskFactor] {
        var out: [RiskFactor] = []
        out.append(RiskFactor(label: "1–2 theft alerts on your block", delta: 14))
        let active = shipments.filter { $0.status == .open || $0.status == .accepted }
        if active.count >= 6 {
            out.append(RiskFactor(label: "High delivery traffic this week", delta: 12))
        }
        let hasPartner = active.contains { $0.partnerId != nil }
        if hasPartner {
            out.append(RiskFactor(label: "Porch Partner holding your package", delta: -22))
        } else {
            out.append(RiskFactor(label: "No Porch Partner assigned", delta: 8))
        }
        let lateWindow = active.contains { Calendar.current.component(.hour, from: $0.deliveryWindowEnd) >= 16 }
        if lateWindow {
            out.append(RiskFactor(label: "Delivery window after 4 PM", delta: 14))
        } else {
            out.append(RiskFactor(label: "Daytime delivery window", delta: -4))
        }
        if active.contains(where: { !$0.notes.isEmpty }) {
            out.append(RiskFactor(label: "Drop instructions added", delta: -4))
        }
        return out
    }

    static func score(_ shipments: [Shipment]) -> Int {
        let total = AppConfig.RiskThresholds.baseScore + factors(shipments).reduce(0) { $0 + $1.delta }
        return max(0, min(100, total))
    }

    static func level(_ score: Int) -> RiskLevel {
        if score >= AppConfig.RiskThresholds.high { return .high }
        if score >= AppConfig.RiskThresholds.medium { return .medium }
        return .low
    }
}
