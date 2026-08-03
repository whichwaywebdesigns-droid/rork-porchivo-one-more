package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DB row from `public.shipments` — matches expo/types/database.ts DbShipment.
 */
@Serializable
data class DbShipment(
    val id: String,
    @SerialName("homeowner_id") val homeownerId: String,
    @SerialName("homeowner_name") val homeownerName: String,
    @SerialName("partner_id") val partnerId: String? = null,
    @SerialName("partner_name") val partnerName: String? = null,
    val status: String = "open",
    val carrier: String = "Other",
    @SerialName("packages_expected") val packagesExpected: String = "",
    @SerialName("delivery_window_start") val deliveryWindowStart: String,
    @SerialName("delivery_window_end") val deliveryWindowEnd: String,
    @SerialName("tracking_submitted_at") val trackingSubmittedAt: String? = null,
    @SerialName("address_text") val addressText: String = "",
    @SerialName("approximate_lat") val approximateLat: Double? = null,
    @SerialName("approximate_lng") val approximateLng: Double? = null,
    @SerialName("precise_lat") val preciseLat: Double? = null,
    @SerialName("precise_lng") val preciseLng: Double? = null,
    @SerialName("dropoff_lat") val dropoffLat: Double? = null,
    @SerialName("dropoff_lng") val dropoffLng: Double? = null,
    @SerialName("home_location_visible_to_partner") val homeLocationVisibleToPartner: Boolean = false,
    val notes: String = "",
    @SerialName("preferred_return_time") val preferredReturnTime: String = "Anytime",
    @SerialName("tracking_number") val trackingNumber: String? = null,
    @SerialName("carrier_tracking_url") val carrierTrackingUrl: String? = null,
    @SerialName("delivery_status") val deliveryStatus: String = "pending",
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)
