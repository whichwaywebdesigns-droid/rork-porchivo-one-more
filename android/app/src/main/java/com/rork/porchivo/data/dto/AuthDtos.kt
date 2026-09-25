package com.rork.porchivo.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

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
    // JsonElement (not String) — app_metadata holds nested arrays/objects
    // (e.g. providers: ["email"], provider_id: {...}) that break Map<String, String>.
    @SerialName("app_metadata") val appMetadata: Map<String, JsonElement> = emptyMap(),
    // JsonElement (not String) — user_metadata holds booleans/arrays
    // (e.g. email_verified: true) that break Map<String, String>.
    @SerialName("user_metadata") val userMetadata: Map<String, JsonElement> = emptyMap(),
    @SerialName("created_at") val createdAt: String = "",
)
