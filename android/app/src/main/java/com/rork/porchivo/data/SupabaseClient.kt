package com.rork.porchivo.data

import com.rork.porchivo.BuildConfig
import com.rork.porchivo.data.dto.DbAnnouncement
import com.rork.porchivo.data.dto.AuthSession
import com.rork.porchivo.data.dto.AuthUser
import com.rork.porchivo.data.dto.DbMyMaintenanceRequest
import com.rork.porchivo.data.dto.DbNotification
import com.rork.porchivo.data.dto.DbOrgContextRow
import com.rork.porchivo.data.dto.DbProfile
import com.rork.porchivo.data.dto.DbShipment
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.URLBuilder
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Response from the request_account_deletion RPC. */
@Serializable
data class DeletionResult(
    val success: Boolean = false,
    val error: String? = null,
    val email: String? = null,
)

/**
 * Supabase REST + Auth client using Ktor.
 *
 * - All data queries go through the PostgREST endpoint ({supabaseUrl}/rest/v1/)
 * - Auth goes through {supabaseUrl}/auth/v1/
 * - Session tokens are stored in [SessionStore] (EncryptedSharedPreferences)
 * - The anon key is sent as `apikey` header on every request
 * - The access_token is sent as `Authorization: Bearer ...` when authenticated
 */
class SupabaseClient(
    private val supabaseUrl: String,
    private val anonKey: String,
    private val sessionStore: SessionStore,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    private val httpClient = HttpClient(Android) {
        install(ContentNegotiation) { json(this@SupabaseClient.json) }
        install(HttpTimeout) {
            requestTimeoutMillis = 20_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 20_000
        }
    }

    private val restBase = "$supabaseUrl/rest/v1"
    private val authBase = "$supabaseUrl/auth/v1"

    // ── Session ────────────────────────────────────────────────────────

    val currentSession: AuthSession?
        get() = sessionStore.getSession()

    val currentUserId: String?
        get() = currentSession?.user?.id

    val isAuthenticated: Boolean
        get() = currentSession != null

    // ── Auth ───────────────────────────────────────────────────────────

    suspend fun signInWithEmail(email: String, password: String): Result<AuthSession> = try {
        val response = httpClient.post("$authBase/token?grant_type=password") {
            header(HttpHeaders.ContentType, "application/json")
            setBody(mapOf("email" to email, "password" to password))
        }
        if (response.status.isSuccess()) {
            val session: AuthSession = response.body()
            // Fetch user info
            val userResponse = httpClient.get("$authBase/user") {
                header("Authorization", "Bearer ${session.accessToken}")
            }
            val fullSession = if (userResponse.status.isSuccess()) {
                val user: AuthUser = userResponse.body()
                session.copy(user = user)
            } else session
            sessionStore.saveSession(fullSession)
            Result.success(fullSession)
        } else {
            Result.failure(Exception("Invalid email or password"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun signUpWithEmail(email: String, password: String): Result<AuthSession> = try {
        val response = httpClient.post("$authBase/signup") {
            header(HttpHeaders.ContentType, "application/json")
            setBody(mapOf("email" to email, "password" to password))
        }
        if (response.status.isSuccess()) {
            val session: AuthSession = response.body()
            if (session.accessToken.isNotBlank()) {
                sessionStore.saveSession(session)
                Result.success(session)
            } else {
                // Email confirmation required
                Result.failure(Exception("Check your email to confirm your account, then sign in."))
            }
        } else {
            Result.failure(Exception("Sign-up failed. Email may already be registered."))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Request a magic-link / OTP email from Supabase Auth.
     * Returns success if the request was accepted (the user must check email).
     */
    suspend fun sendMagicLink(email: String): Result<Unit> = try {
        val response = httpClient.post("$authBase/otp") {
            header(HttpHeaders.ContentType, "application/json")
            header("apikey", anonKey)
            setBody(
                mapOf(
                    "email" to email,
                    "options" to mapOf("should_create_user" to true),
                )
            )
        }
        if (response.status.isSuccess()) {
            Result.success(Unit)
        } else {
            val msg = parseErrorMessage(response)
            Result.failure(Exception(msg ?: "Could not send magic link. Check your email and try again."))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Verify the 6-digit OTP from the magic-link email and establish a session.
     */
    suspend fun verifyOtp(email: String, token: String): Result<AuthSession> = try {
        val response = httpClient.post("$authBase/token?grant_type=otp") {
            header(HttpHeaders.ContentType, "application/json")
            header("apikey", anonKey)
            setBody(
                mapOf(
                    "email" to email,
                    "token" to token,
                    "type" to "magiclink",
                )
            )
        }
        if (response.status.isSuccess()) {
            val session: AuthSession = response.body()
            // Fetch user info
            val userResponse = httpClient.get("$authBase/user") {
                header("Authorization", "Bearer ${session.accessToken}")
                header("apikey", anonKey)
            }
            val fullSession = if (userResponse.status.isSuccess()) {
                val user: AuthUser = userResponse.body()
                session.copy(user = user)
            } else session
            sessionStore.saveSession(fullSession)
            Result.success(fullSession)
        } else {
            val msg = parseErrorMessage(response)
            Result.failure(Exception(msg ?: "Invalid or expired code. Try again."))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    private suspend fun parseErrorMessage(response: io.ktor.client.statement.HttpResponse): String? = try {
        val body = response.body<String>()
        val jsonObject = json.parseToJsonElement(body).jsonObject
        jsonObject["message"]?.jsonPrimitive?.content
            ?: jsonObject["error"]?.jsonPrimitive?.content
            ?: jsonObject["msg"]?.jsonPrimitive?.content
    } catch (_: Exception) {
        null
    }

    suspend fun restoreSession(): AuthSession? {
        val stored = sessionStore.getSession() ?: return null
        // Check if token is expired (with 60s buffer)
        val now = System.currentTimeMillis() / 1000
        if (stored.expiresAt > 0 && stored.expiresAt - 60 < now) {
            // Try to refresh
            refreshSession(stored.refreshToken)?.let { return it }
            // Refresh failed — clear session
            sessionStore.clearSession()
            return null
        }
        return stored
    }

    private suspend fun refreshSession(refreshToken: String): AuthSession? = try {
        val response = httpClient.post("$authBase/token?grant_type=refresh_token") {
            header(HttpHeaders.ContentType, "application/json")
            setBody(mapOf("refresh_token" to refreshToken))
        }
        if (response.status.isSuccess()) {
            val session: AuthSession = response.body()
            sessionStore.saveSession(session)
            session
        } else null
    } catch (e: Exception) { null }

    fun signOut() {
        sessionStore.clearSession()
    }

    // ── REST queries ───────────────────────────────────────────────────

    private fun authHeaders(): Map<String, String> {
        val headers = mutableMapOf("apikey" to anonKey)
        currentSession?.accessToken?.let {
            headers["Authorization"] = "Bearer $it"
        }
        return headers
    }

    /** SELECT from a table with optional query params. Returns deserialized list. */
    private suspend inline fun <reified T> selectFrom(
        table: String,
        params: Map<String, String> = emptyMap(),
    ): Result<List<T>> = try {
        val urlBuilder = URLBuilder("$restBase/$table")
        params.forEach { (key, value) -> urlBuilder.parameters.append(key, value) }
        val response = httpClient.get(urlBuilder.buildString()) {
            authHeaders().forEach { (k, v) -> header(k, v) }
            header("Accept", "application/json")
        }
        if (response.status.isSuccess()) {
            val list: List<T> = response.body()
            Result.success(list)
        } else {
            Result.failure(Exception("Failed to fetch $table: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** SELECT single row from a table. */
    private suspend inline fun <reified T> selectSingle(
        table: String,
        params: Map<String, String> = emptyMap(),
    ): Result<T?> = try {
        val urlBuilder = URLBuilder("$restBase/$table")
        params.forEach { (key, value) -> urlBuilder.parameters.append(key, value) }
        urlBuilder.parameters.append("limit", "1")
        val response = httpClient.get(urlBuilder.buildString()) {
            authHeaders().forEach { (k, v) -> header(k, v) }
            header("Accept", "application/vnd.pgrst.object+json")
        }
        if (response.status.isSuccess()) {
            val item: T = response.body()
            Result.success(item)
        } else if (response.status.value == 406) {
            // No rows — PGRST116 equivalent
            Result.success(null)
        } else {
            Result.failure(Exception("Failed to fetch $table: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** INSERT into a table and return the created row. */
    private suspend inline fun <reified T> insertInto(
        table: String,
        body: Map<String, Any?>,
    ): Result<T> = try {
        val response = httpClient.post("$restBase/$table") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(body)
        }
        if (response.status.isSuccess()) {
            val list: List<T> = response.body()
            if (list.isNotEmpty()) Result.success(list.first())
            else Result.failure(Exception("Insert returned no rows"))
        } else {
            Result.failure(Exception("Insert failed: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** PATCH (update) a row by ID. */
    private suspend inline fun <reified T> updateById(
        table: String,
        id: String,
        updates: Map<String, Any?>,
    ): Result<T> = try {
        val response = httpClient.patch("$restBase/$table?id=eq.$id") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(updates)
        }
        if (response.status.isSuccess()) {
            val list: List<T> = response.body()
            if (list.isNotEmpty()) Result.success(list.first())
            else Result.failure(Exception("Update returned no rows"))
        } else {
            Result.failure(Exception("Update failed: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    // ── Domain operations ──────────────────────────────────────────────

    suspend fun fetchProfile(userId: String): Result<DbProfile?> =
        selectSingle("profiles", mapOf("id" to "eq.$userId"))

    suspend fun updateProfile(userId: String, updates: Map<String, Any?>): Result<DbProfile> =
        updateById("profiles", userId, updates)

    suspend fun fetchShipments(userId: String): Result<List<DbShipment>> =
        selectFrom("shipments", mapOf(
            "or" to "(homeowner_id.eq.$userId,partner_id.eq.$userId,status.eq.open)",
            "order" to "created_at.desc",
        ))

    suspend fun insertShipment(body: Map<String, Any?>): Result<DbShipment> =
        insertInto("shipments", body)

    suspend fun updateShipment(id: String, updates: Map<String, Any?>): Result<DbShipment> =
        updateById("shipments", id, updates)

    suspend fun fetchNotifications(userId: String): Result<List<DbNotification>> =
        selectFrom("notifications", mapOf(
            "recipient_id" to "eq.$userId",
            "order" to "created_at.desc",
        ))

    suspend fun markNotificationRead(id: String): Result<Unit> = try {
        val response = httpClient.patch("$restBase/notifications?id=eq.$id") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            header("Prefer", "return=minimal")
            setBody(mapOf("read" to true))
        }
        if (response.status.isSuccess()) Result.success(Unit)
        else Result.failure(Exception("Failed to mark notification read"))
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun markAllNotificationsRead(userId: String): Result<Unit> = try {
        val response = httpClient.patch("$restBase/notifications?recipient_id=eq.$userId&read=eq.false") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            header("Prefer", "return=minimal")
            setBody(mapOf("read" to true))
        }
        if (response.status.isSuccess()) Result.success(Unit)
        else Result.failure(Exception("Failed to mark all notifications read"))
    } catch (e: Exception) {
        Result.failure(e)
    }

    // ── RPC ────────────────────────────────────────────────────────────

    suspend fun acceptShipment(shipmentId: String): Result<Unit> = try {
        val response = httpClient.post("$restBase/rpc/accept_shipment") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf("p_shipment_id" to shipmentId))
        }
        if (response.status.isSuccess()) Result.success(Unit)
        else Result.failure(Exception("Failed to accept shipment"))
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Graceful account deletion: stamps deletion_requested_at, bans the user
     * (invalidates sessions), and starts the 30-day grace period.
     * Returns the user's email for the confirmation email.
     */
    suspend fun requestAccountDeletion(): Result<DeletionResult> = try {
        val response = httpClient.post("$restBase/rpc/request_account_deletion") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(emptyMap<String, Any?>())
        }
        if (response.status.isSuccess()) {
            val result: DeletionResult = response.body()
            Result.success(result)
        } else {
            Result.failure(Exception("Failed to request account deletion: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Fetch published announcements for the user's org (direct table read, RLS-gated).
     */
    suspend fun fetchAnnouncements(orgId: String): Result<List<DbAnnouncement>> = try {
        val response = httpClient.get("$restBase/org_announcements") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            header("Accept", "application/json")
            url {
                parameters.append("org_id", "eq.$orgId")
                parameters.append("or", "(scheduled_at.is.null,scheduled_at.lte.now())")
                parameters.append("order", "is_pinned.desc,created_at.desc")
                parameters.append("limit", "30")
            }
        }
        if (response.status.isSuccess()) {
            val list: List<DbAnnouncement> = response.body()
            Result.success(list)
        } else {
            Result.failure(Exception("Failed to fetch announcements: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Post a new announcement (direct table insert, RLS-gated). */
    suspend fun insertAnnouncement(body: Map<String, Any?>): Result<DbAnnouncement> =
        insertInto("org_announcements", body)

    /** Submit a maintenance request via `submit_maintenance_request` RPC. Returns the new request UUID. */
    suspend fun submitMaintenanceRequest(
        orgId: String,
        category: String,
        priority: String,
        title: String,
        description: String?,
        location: String?,
    ): Result<String> = try {
        val response = httpClient.post("$restBase/rpc/submit_maintenance_request") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(buildMap<String, Any?> {
                put("p_org_id", orgId)
                put("p_category", category)
                put("p_priority", priority)
                put("p_title", title)
                description?.let { put("p_description", it) }
                location?.let { put("p_location", it) }
            })
        }
        if (response.status.isSuccess()) {
            // RPC returns a UUID string directly
            val raw: String = response.body()
            // PostgREST may return it quoted or as a JSON string
            val clean = raw.trim().removeSurrounding("\"")
            Result.success(clean)
        } else {
            Result.failure(Exception("Failed to submit maintenance request: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Fetch the current user's maintenance requests via `get_my_maintenance_requests` RPC. */
    suspend fun fetchMyMaintenanceRequests(orgId: String): Result<List<DbMyMaintenanceRequest>> = try {
        val response = httpClient.post("$restBase/rpc/get_my_maintenance_requests") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf("p_org_id" to orgId))
        }
        if (response.status.isSuccess()) {
            val list: List<DbMyMaintenanceRequest> = response.body()
            Result.success(list)
        } else {
            Result.success(emptyList())
        }
    } catch (e: Exception) {
        Result.success(emptyList())
    }

    /**
     * Fetch the current user's org memberships via `get_my_org_context` RPC.
     * Returns active + pending memberships. Empty list if the user belongs
     * to no org or the RPC is unavailable.
     */
    suspend fun fetchOrgContext(): Result<List<DbOrgContextRow>> = try {
        val response = httpClient.post("$restBase/rpc/get_my_org_context") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(emptyMap<String, Any?>())
        }
        if (response.status.isSuccess()) {
            val list: List<DbOrgContextRow> = response.body()
            Result.success(list)
        } else {
            Result.success(emptyList())
        }
    } catch (e: Exception) {
        Result.success(emptyList())
    }

    // ── Edge Functions ───────────────────────────────────────────────────

    /**
     * Invoke a Supabase Edge Function by name.
     * Uses {supabaseUrl}/functions/v1/{name} with the user's auth token.
     */
    suspend fun <T> invokeFunction(
        name: String,
        body: Map<String, Any?>,
        responseType: kotlinx.serialization.KSerializer<T>,
    ): Result<T> = try {
        val response = httpClient.post("$supabaseUrl/functions/v1/$name") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        if (response.status.isSuccess()) {
            val responseText = response.body<String>()
            val result = json.decodeFromString(responseType, responseText)
            Result.success(result)
        } else {
            Result.failure(Exception("Function $name failed: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Invoke a Supabase Edge Function by name without deserializing the response.
     * Used for fire-and-forget calls like dev-confirm-user where only success/failure matters.
     */
    suspend fun invokeFunctionRaw(
        name: String,
        body: Map<String, Any?>,
    ): Result<Unit> = try {
        val response = httpClient.post("$supabaseUrl/functions/v1/$name") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        if (response.status.isSuccess()) {
            Result.success(Unit)
        } else {
            Result.failure(Exception("Function $name failed: ${response.status}"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    // ── Offline queue replay ───────────────────────────────────────────

    /**
     * Replay a queued action against Supabase REST. Used by the offline
     * action queue when connectivity is restored. Returns true on HTTP success.
     */
    suspend fun replayQueuedAction(
        type: String,
        target: String,
        payload: String,
        filter: Map<String, String>? = null,
    ): Boolean {
        return try {
            when (type) {
                "insert" -> {
                    val response = httpClient.post("$restBase/$target") {
                        authHeaders().forEach { (k, v) -> header(k, v) }
                        contentType(ContentType.Application.Json)
                        header("Prefer", "return=minimal")
                        setBody(payload)
                    }
                    response.status.isSuccess()
                }
                "update" -> {
                    val query = filter?.entries?.joinToString("&") { "${it.key}=eq.${it.value}" } ?: ""
                    val url = if (query.isNotEmpty()) "$restBase/$target?$query" else "$restBase/$target"
                    val response = httpClient.patch(url) {
                        authHeaders().forEach { (k, v) -> header(k, v) }
                        contentType(ContentType.Application.Json)
                        header("Prefer", "return=minimal")
                        setBody(payload)
                    }
                    response.status.isSuccess()
                }
                "rpc" -> {
                    val response = httpClient.post("$restBase/rpc/$target") {
                        authHeaders().forEach { (k, v) -> header(k, v) }
                        contentType(ContentType.Application.Json)
                        setBody(payload)
                    }
                    response.status.isSuccess()
                }
                else -> false
            }
        } catch (e: Exception) {
            false
        }
    }

    fun close() {
        httpClient.close()
    }
}
