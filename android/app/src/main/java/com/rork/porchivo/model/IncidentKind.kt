package com.rork.porchivo.model

/**
 * Incident types mirroring the DB `incident_type` enum on `incident_reports`.
 * Mirrors the Expo app's file-incident screen.
 */
enum class IncidentKind(
    val value: String,
    val label: String,
    val emoji: String,
    /** Package-issue types where the carrier handles claims — shows the carrier reminder and the estimated-value field. */
    val isCarrierAction: Boolean,
) {
    MISSING_PACKAGE("missing_package", "Package missing", "📦", true),
    DELIVERED_NOT_FOUND("delivered_not_found", "Delivered but not found", "🔍", true),
    MISDELIVERED("misdelivered", "Delivered to wrong unit", "📬", true),
    DAMAGED("damaged", "Package damaged", "💥", true),
    TAMPERED("tampered", "Opened or tampered with", "🔓", true),
    SUSPICIOUS_ACTIVITY("suspicious_activity", "Suspicious activity", "🚨", false),
    HELD_TOO_LONG("held_too_long", "Held too long", "⏳", false),
    WRONG_PICKUP("wrong_pickup", "Wrong person picked up", "🙅", false),
    RULE_VIOLATION("rule_violation", "Outside delivery rules", "📋", false),
    CARRIER_FAILURE("carrier_failure", "Carrier didn't follow instructions", "🚚", true),
    DUPLICATE_COMPLAINT("duplicate_complaint", "Duplicate complaint", "🔁", false),
    OTHER("other", "Something else", "❓", false);

    /** Default one-line title, pre-filled when the user picks a type. */
    val defaultTitle: String
        get() = when (this) {
            MISSING_PACKAGE -> "Package missing from expected location"
            DELIVERED_NOT_FOUND -> "Carrier marked delivered but package not found"
            MISDELIVERED -> "Package delivered to wrong unit"
            DAMAGED -> "Package arrived damaged"
            TAMPERED -> "Package appears opened or tampered with"
            SUSPICIOUS_ACTIVITY -> "Suspicious activity near delivery area"
            HELD_TOO_LONG -> "Package held in common area too long"
            WRONG_PICKUP -> "Package picked up by wrong person"
            RULE_VIOLATION -> "Delivery made outside community rules"
            CARRIER_FAILURE -> "Carrier failed to follow delivery instructions"
            DUPLICATE_COMPLAINT -> "Duplicate complaint about same package"
            OTHER -> "Package delivery issue"
        }
}
