package com.rork.porchivo.model

/** Mirrors the DeliveryNotification type from expo/types/index.ts. */
data class DeliveryNotification(
    val id: String,
    val shipmentId: String,
    val type: NotificationType,
    val title: String,
    val message: String,
    val read: Boolean,
    val createdAt: Long,
)
