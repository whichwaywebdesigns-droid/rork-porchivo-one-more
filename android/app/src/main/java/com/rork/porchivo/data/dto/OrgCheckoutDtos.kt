package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Response from `create-org-checkout` edge function.
 * Contains the Stripe Checkout URL, session ID, and the created org ID.
 */
@Serializable
data class OrgCheckoutResponse(
    val checkoutUrl: String,
    val sessionId: String,
    val orgId: String,
    val plan: PlanSummary? = null,
)

@Serializable
data class PlanSummary(
    val name: String? = null,
    val price: Int? = null,
    val interval: String? = null,
)

/**
 * Response from `confirm-org-signup` edge function.
 * On success, contains the activated org details including invite code.
 */
@Serializable
data class OrgConfirmResponse(
    val success: Boolean? = null,
    val alreadyActive: Boolean? = null,
    val error: String? = null,
    val org: OrgConfirmOrg? = null,
)

@Serializable
data class OrgConfirmOrg(
    val id: String? = null,
    val name: String? = null,
    @SerialName("inviteCode")
    val inviteCode: String? = null,
    @SerialName("planTier")
    val planTier: String? = null,
    @SerialName("billingCycle")
    val billingCycle: String? = null,
)
