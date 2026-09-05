package com.rork.porchivo.model

/** Incident severity values mirroring the DB `incident_severity` enum. */
enum class IncidentSeverity(val value: String, val label: String) {
    LOW("low", "Low"),
    MEDIUM("medium", "Medium"),
    HIGH("high", "High"),
    CRITICAL("critical", "Critical"),
}
