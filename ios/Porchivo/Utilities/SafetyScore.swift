//
//  SafetyScore.swift
//  Porchivo
//
//  Safety-score flip — the single source of truth for score direction.
//  Risk-style scores (RiskEngine, ZIP theft risk) are always displayed as a
//  SAFETY score where HIGHER = SAFER. Never inline `100 - risk` elsewhere.
//
//  Bands on a safety score: 0–33 High, 34–66 Medium, 67–100 Low.
//

import Foundation

enum SafetyScore {
    /// Flips a 0–100 risk score (higher = riskier) into a safety score (higher = safer).
    static func value(fromRisk riskScore: Int) -> Int {
        max(0, min(100, 100 - riskScore))
    }

    /// Shared risk band, keyed off the SAFETY score.
    /// Reuses `RiskEngine.RiskLevel` so existing tint switches keep working.
    static func band(_ safetyScore: Int) -> RiskEngine.RiskLevel {
        if safetyScore >= 67 { return .low }
        if safetyScore >= 34 { return .medium }
        return .high
    }
}
