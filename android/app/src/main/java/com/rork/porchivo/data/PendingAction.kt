package com.rork.porchivo.data

import kotlinx.serialization.Serializable

/**
 * A user action queued for later replay against Supabase when connectivity is restored.
 * Persisted to SharedPreferences via [PendingActionStore] so it survives app restarts.
 */
@Serializable
data class PendingAction(
    val id: String,
    /** "insert", "update", or "rpc". */
    val type: String,
    /** Table name (insert/update) or RPC function name (rpc). */
    val target: String,
    /** JSON-encoded request body. */
    val payload: String,
    /** Column → value eq-filters for updates (e.g. {"id": "abc"}). */
    val filter: Map<String, String>? = null,
    /** Which data set to re-fetch after a successful replay (e.g. "shipments"). */
    val refreshKey: String? = null,
    val timestamp: Long,
    val retryCount: Int = 0,
    val maxRetries: Int = 3,
)
