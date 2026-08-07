package com.rork.porchivo.model

/** Mirrors the Shipment type from expo/types/index.ts (timestamps as epoch millis). */
data class Shipment(
    val id: String,
    val homeownerId: String,
    val homeownerName: String,
    val partnerId: String? = null,
    val partnerName: String? = null,
    val status: ShipmentStatus,
    val carrier: Carrier,
    val packagesExpected: String,
    val deliveryWindowStart: Long,
    val deliveryWindowEnd: Long,
    val addressText: String,
    val homeLocationVisibleToPartner: Boolean = false,
    val notes: String = "",
    val preferredReturnTime: String = "Anytime",
    val trackingNumber: String? = null,
    val deliveryStatus: DeliveryStatus,
    val completionPhotoUrl: String? = null,
    val createdAt: Long,
    val updatedAt: Long,
)
