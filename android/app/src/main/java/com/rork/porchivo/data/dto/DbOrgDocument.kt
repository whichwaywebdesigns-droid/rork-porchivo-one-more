package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Document row from `org_documents` (RLS-gated: all active org members read).
 * Exactly one of [externalUrl] / [filePath] is set (DB check constraint).
 */
@Serializable
data class DbOrgDocument(
    @SerialName("id") val id: String = "",
    @SerialName("org_id") val orgId: String? = null,
    @SerialName("name") val name: String = "",
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("file_path") val filePath: String? = null,
    @SerialName("file_size") val fileSize: Long? = null,
    @SerialName("mime_type") val mimeType: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

/** Amenity row from `org_amenities`. */
@Serializable
data class DbOrgAmenity(
    @SerialName("id") val id: String = "",
    @SerialName("org_id") val orgId: String? = null,
    @SerialName("name") val name: String = "",
)

/** Embedded `member:profiles(name)` object on reservation rows. */
@Serializable
data class DbReservationMember(
    @SerialName("name") val name: String? = null,
)

/**
 * Reservation row from `org_amenity_reservations` (confirmed, upcoming).
 * Double-booking is impossible: a DB-level GiST EXCLUDE constraint
 * (`org_amenity_reservations_no_overlap`) rejects overlapping confirmed slots.
 */
@Serializable
data class DbOrgAmenityReservation(
    @SerialName("id") val id: String = "",
    @SerialName("org_id") val orgId: String? = null,
    @SerialName("amenity_id") val amenityId: String = "",
    @SerialName("reserved_by") val reservedBy: String = "",
    @SerialName("starts_at") val startsAt: String = "",
    @SerialName("ends_at") val endsAt: String = "",
    @SerialName("status") val status: String = "confirmed",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("member") val member: DbReservationMember? = null,
)

/** Single-column row from `organizations?select=plan_tier`. */
@Serializable
data class DbPlanTierRow(
    @SerialName("plan_tier") val planTier: String? = null,
)

/** Payment row from `org_payments` (ledger is staff-facing; RLS restricts reads). */
@Serializable
data class DbOrgPayment(
    @SerialName("id") val id: String = "",
    @SerialName("org_id") val orgId: String? = null,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("amount_cents") val amountCents: Long = 0,
    @SerialName("status") val status: String = "",
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("member") val member: DbReservationMember? = null,
)

/**
 * Thrown when a booking overlaps an existing confirmed slot — the Postgres
 * GiST exclusion constraint surfaces as SQLSTATE 23P01 (exclusion_violation).
 */
class SlotTakenException : Exception("Someone grabbed that slot first. Pick another time.")
