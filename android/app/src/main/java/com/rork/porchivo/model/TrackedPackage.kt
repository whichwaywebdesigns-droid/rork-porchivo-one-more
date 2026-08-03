package com.rork.porchivo.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PackageStatusEvent(
    val status: PackageTrackingStatus,
    val timestamp: Long? = null,
    val completed: Boolean,
)

/**
 * Mirrors the TrackedPackage type from expo/types/index.ts.
 * Stored locally in SharedPreferences (no DB table — matches Expo's AsyncStorage approach).
 */
@Serializable
data class TrackedPackage(
    val id: String,
    val name: String,
    val carrier: Carrier,
    val trackingNumber: String,
    val expectedDeliveryDate: Long,
    val currentStatus: PackageTrackingStatus,
    val addressNickname: AddressNickname,
    val customAddressLabel: String? = null,
    val notesForPartner: String = "",
    val statusHistory: List<PackageStatusEvent> = emptyList(),
    val createdAt: Long,
)
