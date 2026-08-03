package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DB row from `public.notifications` — matches expo/types/database.ts DbNotification.
 */
@Serializable
data class DbNotification(
    val id: String,
    @SerialName("shipment_id") val shipmentId: String,
    val type: String,
    val title: String,
    val message: String,
    @SerialName("recipient_id") val recipientId: String,
    @SerialName("recipient_role") val recipientRole: String = "homeowner",
    val read: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
)
