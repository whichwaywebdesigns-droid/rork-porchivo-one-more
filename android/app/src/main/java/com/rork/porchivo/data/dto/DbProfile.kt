package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DB row from `public.profiles` — matches expo/types/database.ts DbProfile.
 * snake_case columns mapped via @SerialName.
 */
@Serializable
data class DbProfile(
    val id: String,
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val role: String = "homeowner",
    val address: String = "",
    @SerialName("has_location_consent") val hasLocationConsent: Boolean = false,
    @SerialName("has_precise_location_consent") val hasPreciseLocationConsent: Boolean = false,
    @SerialName("expo_push_token") val expoPushToken: String? = null,
    @SerialName("is_premium") val isPremium: Boolean = false,
    @SerialName("subscription_tier") val subscriptionTier: String = "free",
    @SerialName("is_onboarded") val isOnboarded: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)
