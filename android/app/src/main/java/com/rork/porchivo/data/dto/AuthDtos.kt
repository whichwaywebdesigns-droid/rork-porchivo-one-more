package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Supabase Auth session response — the relevant subset.
 */
@Serializable
data class AuthSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    val expiresIn: Long = 0,
    @SerialName("expires_at") val expiresAt: Long = 0,
    val tokenType: String = "bearer",
    val user: AuthUser? = null,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String? = null,
    @SerialName("aud") val aud: String = "",
    @SerialName("role") val role: String = "",
    @SerialName("app_metadata") val appMetadata: Map<String, String> = emptyMap(),
    @SerialName("user_metadata") val userMetadata: Map<String, String> = emptyMap(),
    @SerialName("created_at") val createdAt: String = "",
)
