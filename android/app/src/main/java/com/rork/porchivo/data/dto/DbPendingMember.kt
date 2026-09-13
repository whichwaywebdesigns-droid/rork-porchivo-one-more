package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Pending membership request returned by the `get_pending_members` RPC.
 * Mirrors PendingMemberRow in the iOS app (snake_case JSON keys).
 */
@Serializable
data class DbPendingMember(
    @SerialName("membership_id") val membershipId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("display_name") val displayName: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("unit_number") val unitNumber: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    val notes: String? = null,
)
