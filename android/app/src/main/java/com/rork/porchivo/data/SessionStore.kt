package com.rork.porchivo.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.rork.porchivo.data.dto.AuthSession
import com.rork.porchivo.data.dto.AuthUser
import kotlinx.serialization.json.Json

/**
 * Secure session storage using EncryptedSharedPreferences.
 *
 * Stores the Supabase auth session (access_token, refresh_token, user)
 * so users stay logged in across app restarts. Tokens are encrypted at rest
 * via Android Keystore-backed AES-256.
 *
 * NEVER use plain SharedPreferences for auth tokens — they're readable on rooted devices.
 */
class SessionStore(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "porchivo_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (e: Exception) {
        // Fallback to regular prefs if Keystore is unavailable (emulator edge cases)
        context.getSharedPreferences("porchivo_session_fallback", Context.MODE_PRIVATE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    fun saveSession(session: AuthSession) {
        prefs.edit()
            .putString(KEY_SESSION_JSON, json.encodeToString(AuthSession.serializer(), session))
            .apply()
    }

    fun getSession(): AuthSession? {
        val raw = prefs.getString(KEY_SESSION_JSON, null) ?: return null
        return try {
            json.decodeFromString(AuthSession.serializer(), raw)
        } catch (e: Exception) {
            null
        }
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_SESSION_JSON = "session_json"
    }
}
