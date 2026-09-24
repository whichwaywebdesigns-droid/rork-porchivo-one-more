package com.rork.porchivo.util

/**
 * Safety-score flip — single source of truth for score direction.
 * Risk-style scores (RiskEngine, ZIP theft risk) are always displayed as a
 * SAFETY score where HIGHER = SAFER. Never inline `100 - risk` elsewhere.
 *
 * Bands on a safety score: 0–33 High, 34–66 Medium, 67–100 Low.
 */
object SafetyScore {

    /** Flips a 0–100 risk score (higher = riskier) into a safety score (higher = safer). */
    fun fromRisk(riskScore: Int): Int = (100 - riskScore).coerceIn(0, 100)

    /** Shared risk band, keyed off the SAFETY score (reuses RiskEngine.RiskLevel labels). */
    fun band(safetyScore: Int): RiskEngine.RiskLevel = when {
        safetyScore >= 67 -> RiskEngine.RiskLevel.LOW
        safetyScore >= 34 -> RiskEngine.RiskLevel.MEDIUM
        else -> RiskEngine.RiskLevel.HIGH
    }
}
