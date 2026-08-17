package com.rork.porchivo.data

import android.content.Context
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * SharedPreferences-backed queue for [PendingAction]s.
 * Serialises the entire list as a single JSON string so it survives app restarts.
 */
class PendingActionStore(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(PendingAction.serializer())

    /** Load all queued actions from disk. */
    fun loadActions(): List<PendingAction> {
        val stored = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            json.decodeFromString(serializer, stored)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** Persist the full action list to disk. */
    fun saveActions(actions: List<PendingAction>) {
        val encoded = json.encodeToString(serializer, actions)
        prefs.edit().putString(KEY, encoded).apply()
    }

    /** Remove all queued actions (called on sign-out). */
    fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    companion object {
        private const val PREFS_NAME = "porchivo_pending_actions"
        private const val KEY = "pending_actions"
    }
}
