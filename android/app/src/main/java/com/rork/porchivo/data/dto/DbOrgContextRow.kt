package com.rork.porchivo.data.dto

import kotlinx.serialization.Serializable

/**
 * Org context row from `get_my_org_context` RPC.
 * Mirrors DbOrgContextRow in the iOS app and OrgContextRow in Expo.
 */
@Serializable
data class DbOrgContextRow(
    val membershipId: String? = null,
    val orgId: String? = null,
    val orgName: String? = null,
    val orgType: String? = null,
    val orgLogoUrl: String? = null,
    val orgIsVerified: Boolean? = null,
    val unitId: String? = null,
    val unitNumber: String? = null,
    val role: String? = null,
    val status: String? = null,
    val joinedAt: String? = null,
)

/**
 * Lightweight org membership for AppRepository.
 */
@Serializable
data class OrgMembership(
    val orgId: String,
    val orgName: String,
    val role: String,
    val status: String,
    val inviteCode: String? = null,
) {
    val isActive: Boolean get() = status == "active"
    val isPending: Boolean get() = status == "pending"
    val isAdmin: Boolean
        get() {
            val adminRoles = setOf("hoa_admin", "property_manager", "board_member")
            return isActive && adminRoles.contains(role)
        }
}
