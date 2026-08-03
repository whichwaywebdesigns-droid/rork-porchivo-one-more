package com.rork.porchivo.util

import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import java.util.Calendar

/**
 * Porch risk scoring — mirrors RISK_THRESHOLDS.factors in expo/config/app.ts.
 * Score runs 0 (no risk) to 100 (very high risk).
 */
object RiskEngine {

    data class RiskFactor(val label: String, val delta: Int)

    enum class RiskLevel(val label: String) {
        LOW("Low Risk"),
        MEDIUM("Medium Risk"),
        HIGH("High Risk"),
    }

    fun factors(shipments: List<Shipment>): List<RiskFactor> {
        val factors = mutableListOf<RiskFactor>()

        // Mirrors someActiveAlerts (+14) — demo block has 1–2 active alerts
        factors.add(RiskFactor("1–2 theft alerts on your block", +14))

        val active = shipments.filter {
            it.status == ShipmentStatus.OPEN || it.status == ShipmentStatus.ACCEPTED
        }

        if (active.size >= 6) {
            factors.add(RiskFactor("High delivery traffic this week", +12))
        }

        val hasPartner = active.any { it.partnerId != null }
        if (hasPartner) {
            factors.add(RiskFactor("Porch Partner holding your package", -22))
        } else {
            factors.add(RiskFactor("No Porch Partner assigned", +8))
        }

        val lateWindow = active.any { shipment ->
            val cal = Calendar.getInstance().apply { timeInMillis = shipment.deliveryWindowEnd }
            cal.get(Calendar.HOUR_OF_DAY) >= 16
        }
        if (lateWindow) {
            factors.add(RiskFactor("Delivery window after 4 PM", +14))
        } else {
            factors.add(RiskFactor("Daytime delivery window", -4))
        }

        if (active.any { it.notes.isNotBlank() }) {
            factors.add(RiskFactor("Drop instructions added", -4))
        }

        return factors
    }

    fun score(shipments: List<Shipment>): Int {
        val total = AppConfig.RiskThresholds.BASE_SCORE + factors(shipments).sumOf { it.delta }
        return total.coerceIn(0, 100)
    }

    fun level(score: Int): RiskLevel = when {
        score >= AppConfig.RiskThresholds.HIGH -> RiskLevel.HIGH
        score >= AppConfig.RiskThresholds.MEDIUM -> RiskLevel.MEDIUM
        else -> RiskLevel.LOW
    }
}
