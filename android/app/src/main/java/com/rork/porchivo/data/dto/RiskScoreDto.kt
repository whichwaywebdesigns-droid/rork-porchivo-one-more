package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Response from the `risk-score` Supabase Edge Function.
 * Returns a 0–100 theft risk score for a given ZIP code.
 */
@Serializable
data class RiskScoreResponse(
    val zip: String,
    val score: Int,
    val level: String,
    val factors: List<RiskFactor> = emptyList(),
    val cached: Boolean = false,
)

@Serializable
data class RiskFactor(
    val label: String,
    val delta: Int,
)
