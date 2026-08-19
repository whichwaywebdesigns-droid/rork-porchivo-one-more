package com.rork.porchivo.data

import android.content.Context
import com.rork.porchivo.BuildConfig
import com.rork.porchivo.data.dto.DbAnnouncement
import com.rork.porchivo.data.dto.DbMyMaintenanceRequest
import com.rork.porchivo.data.dto.AuthSession
import com.rork.porchivo.data.dto.DbNotification
import com.rork.porchivo.data.dto.DbOrgContextRow
import com.rork.porchivo.data.dto.DbProfile
import com.rork.porchivo.data.dto.DbShipment
import com.rork.porchivo.data.dto.OrgCheckoutResponse
import com.rork.porchivo.data.dto.OrgConfirmResponse
import com.rork.porchivo.data.dto.OrgMembership
import com.rork.porchivo.data.dto.RiskScoreResponse
import com.rork.porchivo.model.Announcement
import com.rork.porchivo.model.MaintenanceRequest
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.DeliveryNotification
import com.rork.porchivo.model.DeliveryStatus
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Loading state for async data operations.
 */
sealed class LoadState<out T> {
    data object Loading : LoadState<Nothing>()
    data class Success<T>(val data: T) : LoadState<T>()
    data class Error(val message: String) : LoadState<Nothing>()
    data object Idle : LoadState<Nothing>()
}

/**
 * Auth state — tracks whether the user is authenticated, loading, or needs login.
 */
sealed class AuthState {
    data object Loading : AuthState()
    data object Unauthenticated : AuthState()
    data class Authenticated(val userId: String) : AuthState()
    data class Error(val message: String) : AuthState()
}

/**
 * Single source of truth for all app data — mirrors the Expo app's
 * context providers (AppContext, ShipmentsContext, PackagesContext, NotificationsContext).
 *
 * Data flows:
 * - Auth: Supabase Auth (email/password) → session stored in EncryptedSharedPreferences
 * - Profile: `profiles` table via Supabase REST
 * - Shipments: `shipments` table via Supabase REST
 * - Notifications: `notifications` table via Supabase REST
 * - Tracked packages: local SharedPreferences (mirrors Expo's AsyncStorage — no DB table exists)
 * - Subscription tier: derived from profile.is_premium (written by RevenueCat webhook)
 */
class AppRepository(context: Context) {

    private val sessionStore = SessionStore(context)
    val languageManager = LanguageManager(context)
    private val supabase: SupabaseClient? = if (BuildConfig.SUPABASE_URL.isNotBlank()) {
        SupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL.trimEnd('/'),
            anonKey = BuildConfig.SUPABASE_ANON_KEY,
            sessionStore = sessionStore,
        )
    } else null

    val isSupabaseConfigured: Boolean = supabase != null

    // ── Auth state ──────────────────────────────────────────────────────

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // ── Data state ──────────────────────────────────────────────────────

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _tier = MutableStateFlow(SubscriptionTier.FREE)
    val tier: StateFlow<SubscriptionTier> = _tier.asStateFlow()

    private val _shipments = MutableStateFlow<List<Shipment>>(emptyList())
    val shipments: StateFlow<List<Shipment>> = _shipments.asStateFlow()

    private val _shipmentsLoadState = MutableStateFlow<LoadState<Unit>>(LoadState.Idle)
    val shipmentsLoadState: StateFlow<LoadState<Unit>> = _shipmentsLoadState.asStateFlow()

    private val _packages = MutableStateFlow<List<TrackedPackage>>(emptyList())
    val packages: StateFlow<List<TrackedPackage>> = _packages.asStateFlow()

    private val _notifications = MutableStateFlow<List<DeliveryNotification>>(emptyList())
    val notifications: StateFlow<List<DeliveryNotification>> = _notifications.asStateFlow()

    private val _notificationsLoadState = MutableStateFlow<LoadState<Unit>>(LoadState.Idle)
    val notificationsLoadState: StateFlow<LoadState<Unit>> = _notificationsLoadState.asStateFlow()

    private val _darkThemeOverride = MutableStateFlow<Boolean?>(null)
    val darkThemeOverride: StateFlow<Boolean?> = _darkThemeOverride.asStateFlow()

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    // ── Language preference ────────────────────────────────────────────
    private val _language = MutableStateFlow(AppLanguage.DEFAULT)
    val language: StateFlow<AppLanguage> = _language.asStateFlow()

    // ── Org membership (Free vs Community tier) ────────────────────────
    private val _orgMembership = MutableStateFlow<OrgMembership?>(null)
    val orgMembership: StateFlow<OrgMembership?> = _orgMembership.asStateFlow()

    val isOrgMember: Boolean get() = _orgMembership.value?.isActive == true
    val isOrgAdmin: Boolean get() = _orgMembership.value?.isAdmin == true

    // ── Announcements + Maintenance (loaded when org member) ──────────
    private val _announcements = MutableStateFlow<List<Announcement>>(emptyList())
    val announcements: StateFlow<List<Announcement>> = _announcements.asStateFlow()

    private val _maintenanceRequests = MutableStateFlow<List<MaintenanceRequest>>(emptyList())
    val maintenanceRequests: StateFlow<List<MaintenanceRequest>> = _maintenanceRequests.asStateFlow()

    // ── Org signup deep link redirect ─────────────────────────────────
    private val _orgSignupRedirectUrl = MutableStateFlow<String?>(null)
    val orgSignupRedirectUrl: StateFlow<String?> = _orgSignupRedirectUrl.asStateFlow()

    fun setOrgSignupRedirect(url: String) {
        _orgSignupRedirectUrl.value = url
    }

    fun clearOrgSignupRedirect() {
        _orgSignupRedirectUrl.value = null
    }

    // ── Offline action queue ───────────────────────────────────────────
    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _pendingActions = MutableStateFlow<List<PendingAction>>(emptyList())
    val pendingActions: StateFlow<List<PendingAction>> = _pendingActions.asStateFlow()

    private val pendingActionStore = PendingActionStore(context)
    private val networkMonitor = NetworkMonitor(context)
    private val queueScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Local storage for tracked packages (SharedPreferences — mirrors Expo AsyncStorage)
    private val packagesPrefs = context.getSharedPreferences("porchivo_packages", Context.MODE_PRIVATE)

    // Local storage for org membership cache (SharedPreferences — instant tier resolution on launch)
    private val orgPrefs = context.getSharedPreferences("porchivo_org", Context.MODE_PRIVATE)
    private val packagesJson = kotlinx.serialization.json.Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    init {
        // Resolve language on instantiation — auto-detects system language
        // on first launch, restores saved preference on subsequent launches.
        val (lang, _) = languageManager.loadOrDetect()
        _language.value = lang
        // Start network monitoring and load any pending actions from disk.
        networkMonitor.start()
        _pendingActions.value = pendingActionStore.loadActions()
        // Watch for connectivity changes — auto-sync when connection restores.
        queueScope.launch {
            var wasOffline = false
            networkMonitor.isOnline.collect { online ->
                _isOnline.value = online
                if (!online) wasOffline = true
                if (online && wasOffline && _pendingActions.value.isNotEmpty()) {
                    wasOffline = false
                    processPendingActions()
                }
            }
        }
    }

    // ── Offline action queue helpers ───────────────────────────────────

    /** Convert a Map<String, Any?> to a JSON string for queue persistence. */
    private fun Map<String, Any?>.toJsonString(): String {
        val jsonObject = buildJsonObject {
            this@toJsonString.forEach { (key, value) ->
                when (value) {
                    null -> put(key, JsonNull)
                    is Boolean -> put(key, JsonPrimitive(value))
                    is Number -> put(key, JsonPrimitive(value))
                    is String -> put(key, JsonPrimitive(value))
                    else -> put(key, JsonPrimitive(value.toString()))
                }
            }
        }
        return jsonObject.toString()
    }

    private fun enqueueAction(
        type: String,
        target: String,
        payload: String,
        filter: Map<String, String>? = null,
        refreshKey: String? = null,
    ) {
        val action = PendingAction(
            id = "action_${System.currentTimeMillis()}_${UUID.randomUUID()}",
            type = type,
            target = target,
            payload = payload,
            filter = filter,
            refreshKey = refreshKey,
            timestamp = System.currentTimeMillis(),
        )
        val updated = _pendingActions.value + action
        _pendingActions.value = updated
        pendingActionStore.saveActions(updated)
    }

    /** Replay all queued actions against Supabase. Called automatically when connectivity restores. */
    suspend fun processPendingActions() {
        val client = supabase ?: return
        val actions = _pendingActions.value
        if (actions.isEmpty()) return

        val remaining = mutableListOf<PendingAction>()
        for (action in actions) {
            val ok = client.replayQueuedAction(
                type = action.type,
                target = action.target,
                payload = action.payload,
                filter = action.filter,
            )
            if (ok) {
                action.refreshKey?.let { refreshData(it) }
            } else {
                val updated = action.copy(retryCount = action.retryCount + 1)
                if (updated.retryCount < updated.maxRetries) {
                    remaining.add(updated)
                }
            }
        }
        _pendingActions.value = remaining
        pendingActionStore.saveActions(remaining)
    }

    /** Clear all pending actions — called on sign-out so queued ops from the
     *  previous user's session are not replayed under a new account. */
    private fun clearPendingActions() {
        _pendingActions.value = emptyList()
        pendingActionStore.clear()
    }

    /** Re-fetch data after a successful replay so StateFlows reflect the change. */
    private suspend fun refreshData(key: String) {
        val userId = (_authState.value as? AuthState.Authenticated)?.userId ?: return
        when (key) {
            "shipments" -> loadShipments(userId)
            "notifications" -> loadNotifications(userId)
            "announcements" -> _orgMembership.value?.orgId?.let { loadAnnouncements(it) }
            "maintenance" -> _orgMembership.value?.orgId?.let { loadMaintenanceRequests(it) }
            "profile" -> loadProfile(userId)
        }
    }

    // ── Initialization / Session restore ────────────────────────────────

    /**
     * Called on app start — restores the session if one exists.
     * Sets auth state to Authenticated or Unauthenticated.
     */
    suspend fun restoreSession() {
        _authState.value = AuthState.Loading
        val session = supabase?.restoreSession()
        if (session != null) {
            _authState.value = AuthState.Authenticated(session.user?.id ?: "")
            loadInitialData(session.user?.id ?: "")
        } else {
            _authState.value = AuthState.Unauthenticated
        }
    }

    /**
     * Sign in with email and password.
     */
    suspend fun signIn(email: String, password: String): Boolean {
        _authError.value = null
        val client = supabase ?: run {
            _authError.value = "Backend not configured."
            return false
        }
        val result = client.signInWithEmail(email.trim(), password)
        return if (result.isSuccess) {
            val session = result.getOrNull()
            if (session != null) {
                _authState.value = AuthState.Authenticated(session.user?.id ?: "")
                loadInitialData(session.user?.id ?: "")
            }
            true
        } else {
            _authError.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
            false
        }
    }

    /**
     * Sign up with email and password.
     */
    suspend fun signUp(email: String, password: String): Boolean {
        _authError.value = null
        val client = supabase ?: run {
            _authError.value = "Backend not configured."
            return false
        }
        val result = client.signUpWithEmail(email.trim(), password)
        return if (result.isSuccess) {
            val session = result.getOrNull()
            if (session != null && session.user != null) {
                _authState.value = AuthState.Authenticated(session.user?.id ?: "")
                loadInitialData(session.user?.id ?: "")
            }
            true
        } else {
            _authError.value = result.exceptionOrNull()?.message ?: "Sign-up failed"
            false
        }
    }

    // ── Reviewer test credentials ──────────────────────────────────────
    // Static OTP bypass for Play Store / App Store reviewers.
    // Reviewer enters this email → gets OTP prompt → enters 123456 → logged in.
    private val testReviewerEmail = "reviewer@porchivo.com"
    private val testReviewerOtp = "123456"

    /**
     * Request a magic-link / OTP email. Returns true if Supabase accepted the request.
     */
    suspend fun sendMagicLink(email: String): Boolean {
        _authError.value = null
        // Reviewer test bypass — skip Supabase, pretend the link was sent.
        if (email.trim().equals(testReviewerEmail, ignoreCase = true)) {
            return true
        }
        if (!isSupabaseConfigured) {
            // Demo mode — pretend the link was sent.
            return true
        }
        val result = supabase!!.sendMagicLink(email.trim())
        return if (result.isSuccess) {
            true
        } else {
            _authError.value = result.exceptionOrNull()?.message ?: "Could not send magic link."
            false
        }
    }

    /**
     * Verify the 6-digit OTP from the magic-link email.
     */
    suspend fun verifyOtp(email: String, token: String): Boolean {
        _authError.value = null
        // Reviewer test bypass — static OTP for Play Store / App Store review.
        if (email.trim().equals(testReviewerEmail, ignoreCase = true) && token.trim() == testReviewerOtp) {
            seedDemoUser()
            return true
        }
        if (!isSupabaseConfigured) {
            // Demo mode — any 6 digits signs in.
            seedDemoUser()
            return true
        }
        val result = supabase!!.verifyOtp(email.trim(), token.trim())
        return if (result.isSuccess) {
            val session = result.getOrNull()
            if (session != null) {
                _authState.value = AuthState.Authenticated(session.user?.id ?: "")
                loadInitialData(session.user?.id ?: "")
            }
            true
        } else {
            _authError.value = result.exceptionOrNull()?.message ?: "Invalid or expired code."
            false
        }
    }

    /**
     * Developer sign-in via the dev-confirm-user edge function + single
     * signInWithPassword. Avoids Supabase Auth rate limits by doing all
     * account setup (create / confirm / set password) server-side via the
     * Admin API, then making exactly one auth call from the client.
     * Falls back to local demo mode if Supabase isn't configured.
     */
    suspend fun developerLogin() {
        _authError.value = null
        if (!isSupabaseConfigured) {
            seedDemoUser()
            return
        }

        val qaEmail = "qa@porchivo.dev"
        val qaPassword = "PorchivoQA2025!"
        val client = supabase!!

        // ── Step 1: Ensure QA account exists + confirmed + password set ─────
        val ensureResult = client.invokeFunctionRaw(
            "dev-confirm-user",
            mapOf("email" to qaEmail, "password" to qaPassword),
        )
        if (ensureResult.isFailure) {
            _authError.value = "Dev setup failed: ${ensureResult.exceptionOrNull()?.message ?: "unknown"}. Make sure dev-confirm-user is deployed."
            return
        }

        // ── Step 2: Single signInWithPassword with retry on rate limit ────
        val backoffMs = longArrayOf(0, 2000, 5000, 10000)
        for (attempt in 0..3) {
            if (attempt > 0) {
                delay(backoffMs[attempt])
            }
            val result = client.signInWithEmail(qaEmail, qaPassword)
            if (result.isSuccess) {
                val session = result.getOrNull()
                if (session != null) {
                    _authState.value = AuthState.Authenticated(session.user?.id ?: "")
                    loadInitialData(session.user?.id ?: "")
                }
                return
            }
            val errMsg = result.exceptionOrNull()?.message?.lowercase() ?: ""
            val isRateLimit = errMsg.contains("rate limit") || errMsg.contains("too many") || errMsg.contains("over_request")
            if (!isRateLimit || attempt == 3) {
                _authError.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                return
            }
            // Rate-limited — retry with backoff on next iteration
        }
    }

    /**
     * Seed the demo user and local data. Used in demo mode and by the developer bypass.
     */
    private fun seedDemoUser() {
        _user.value = MockData.user
        _tier.value = SubscriptionTier.FREE
        _shipments.value = MockData.shipments
        _notifications.value = MockData.notifications
        _packages.value = MockData.trackedPackages
        saveLocalPackages(_packages.value)
        _authState.value = AuthState.Authenticated(MockData.CURRENT_USER_ID)
    }

    /**
     * Sign out — clears session and all data.
     */
    fun signOut() {
        val userId = (authState.value as? AuthState.Authenticated)?.userId
        supabase?.signOut()
        clearPendingActions()
        // Clear org cache so a different user doesn't see stale tier
        if (userId != null) {
            orgPrefs.edit().remove("org_cache_$userId").apply()
        }
        _authState.value = AuthState.Unauthenticated
        _user.value = null
        _tier.value = SubscriptionTier.FREE
        _shipments.value = emptyList()
        _notifications.value = emptyList()
        _orgMembership.value = null
        _announcements.value = emptyList()
        _maintenanceRequests.value = emptyList()
        _shipmentsLoadState.value = LoadState.Idle
        _notificationsLoadState.value = LoadState.Idle
    }

    /**
     * Graceful account deletion: stamps deletion_requested_at, bans the user
     * (invalidates sessions), and starts the 30-day grace period before
     * permanent deletion. Returns the user's email for confirmation.
     */
    suspend fun requestAccountDeletion(): Result<String?> {
        val client = supabase ?: return Result.failure(Exception("Backend not configured"))
        val result = client.requestAccountDeletion()
        return if (result.isSuccess) {
            val deletionResult = result.getOrNull()
            if (deletionResult != null && deletionResult.success) {
                Result.success(deletionResult.email)
            } else {
                Result.failure(Exception(deletionResult?.error ?: "Deletion request failed"))
            }
        } else {
            Result.failure(result.exceptionOrNull() ?: Exception("Unknown error"))
        }
    }

    /**
     * Load all initial data after authentication.
     */
    /// Loads cached org membership from SharedPreferences so the correct tier
    /// (Free vs Community) renders instantly on launch without waiting for
    /// the network fetch. The RPC fetch still runs and updates if the data
    /// has changed.
    private fun loadCachedOrgContext(userId: String) {
        val raw = orgPrefs.getString("org_cache_$userId", null) ?: return
        try {
            val cached = packagesJson.decodeFromString<OrgMembership>(raw)
            _orgMembership.value = cached
        } catch (e: Exception) { /* corrupt cache — ignore */ }
    }

    private suspend fun loadInitialData(userId: String) {
        loadCachedOrgContext(userId)
        loadProfile(userId)
        loadShipments(userId)
        loadNotifications(userId)
        loadOrgContext()
        if (isOrgMember) {
            _orgMembership.value?.orgId?.let { orgId ->
                loadAnnouncements(orgId)
                loadMaintenanceRequests(orgId)
            }
        }
        loadLocalPackages()
    }

    // ── Profile ─────────────────────────────────────────────────────────

    suspend fun loadProfile(userId: String) {
        val client = supabase ?: return
        val result = client.fetchProfile(userId)
        if (result.isSuccess) {
            val dbProfile = result.getOrNull()
            if (dbProfile != null) {
                _user.value = Mappers.dbProfileToUser(dbProfile)
                _tier.value = if (dbProfile.isPremium) SubscriptionTier.PREMIUM else SubscriptionTier.FREE
            }
        }
    }

    suspend fun updateRole(role: UserRole) {
        val client = supabase ?: return
        val currentUser = _user.value ?: return
        val result = client.updateProfile(currentUser.id, mapOf("role" to role.name.lowercase()))
        if (result.isSuccess) {
            _user.value = currentUser.copy(role = role)
        }
    }

    suspend fun setLocationConsent(granted: Boolean) {
        val client = supabase ?: return
        val currentUser = _user.value ?: return
        val result = client.updateProfile(currentUser.id, mapOf("has_location_consent" to granted))
        if (result.isSuccess) {
            _user.value = currentUser.copy(hasLocationConsent = granted)
        }
    }

    suspend fun completeOnboarding(
        name: String,
        phone: String,
        address: String,
        role: UserRole,
        hasLocationConsent: Boolean,
    ) {
        val client = supabase ?: return
        val userId = (authState.value as? AuthState.Authenticated)?.userId ?: return
        val updates = mapOf(
            "name" to name,
            "phone" to phone,
            "address" to address,
            "role" to role.name.lowercase(),
            "has_location_consent" to hasLocationConsent,
            "is_onboarded" to true,
        )
        if (!_isOnline.value) {
            enqueueAction(
                type = "update",
                target = "profiles",
                payload = updates.toJsonString(),
                filter = mapOf("id" to userId),
                refreshKey = "profile",
            )
            return
        }
        val result = client.updateProfile(userId, updates)
        if (result.isSuccess) {
            val dbProfile = result.getOrNull()
            if (dbProfile != null) {
                _user.value = Mappers.dbProfileToUser(dbProfile)
            }
        }
    }

    val isOnboarded: Boolean
        get() = _user.value?.isOnboarded == true

    // ── Shipments ───────────────────────────────────────────────────────

    suspend fun loadShipments(userId: String) {
        val client = supabase ?: return
        _shipmentsLoadState.value = LoadState.Loading
        val result = client.fetchShipments(userId)
        if (result.isSuccess) {
            val dbShipments = result.getOrNull() ?: emptyList()
            _shipments.value = dbShipments.map { Mappers.dbShipmentToShipment(it) }
            _shipmentsLoadState.value = LoadState.Success(Unit)
        } else {
            _shipmentsLoadState.value = LoadState.Error(
                result.exceptionOrNull()?.message ?: "Failed to load shipments",
            )
        }
    }

    suspend fun addShipment(
        carrier: Carrier,
        packagesExpected: String,
        trackingNumber: String?,
        notes: String,
        preferredReturnTime: String,
        homeLocationVisibleToPartner: Boolean,
    ): Boolean {
        val client = supabase ?: return false
        val currentUser = _user.value ?: return false
        val now = System.currentTimeMillis()
        val isoNow = Mappers.millisToIso(now)
        val body = mapOf(
            "homeowner_id" to currentUser.id,
            "homeowner_name" to currentUser.name,
            "status" to "open",
            "carrier" to carrier.label,
            "packages_expected" to packagesExpected,
            "delivery_window_start" to Mappers.millisToIso(now + 2 * 3_600_000L),
            "delivery_window_end" to Mappers.millisToIso(now + 6 * 3_600_000L),
            "address_text" to currentUser.address,
            "home_location_visible_to_partner" to homeLocationVisibleToPartner,
            "notes" to notes,
            "preferred_return_time" to preferredReturnTime.ifBlank { "Anytime" },
            "tracking_number" to trackingNumber?.takeIf { it.isNotBlank() },
            "delivery_status" to "pending",
        )
        if (!_isOnline.value) {
            enqueueAction(
                type = "insert",
                target = "shipments",
                payload = body.toJsonString(),
                refreshKey = "shipments",
            )
            return true
        }
        val result = client.insertShipment(body)
        return if (result.isSuccess) {
            val dbShipment = result.getOrNull()
            if (dbShipment != null) {
                val newShipment = Mappers.dbShipmentToShipment(dbShipment)
                _shipments.value = listOf(newShipment) + _shipments.value
            }
            true
        } else false
    }

    suspend fun completeShipment(id: String): Boolean {
        val client = supabase ?: return false
        if (!_isOnline.value) {
            enqueueAction(
                type = "update",
                target = "shipments",
                payload = mapOf("status" to "completed", "delivery_status" to "delivered_to_homeowner").toJsonString(),
                filter = mapOf("id" to id),
                refreshKey = "shipments",
            )
            return true
        }
        val result = client.updateShipment(id, mapOf(
            "status" to "completed",
            "delivery_status" to "delivered_to_homeowner",
        ))
        return if (result.isSuccess) {
            val dbShipment = result.getOrNull()
            if (dbShipment != null) {
                val updated = Mappers.dbShipmentToShipment(dbShipment)
                _shipments.value = _shipments.value.map {
                    if (it.id == id) updated else it
                }
            }
            true
        } else false
    }

    suspend fun acceptShipment(id: String): Boolean {
        val client = supabase ?: return false
        if (!_isOnline.value) {
            enqueueAction(
                type = "rpc",
                target = "accept_shipment",
                payload = mapOf("p_shipment_id" to id).toJsonString(),
                refreshKey = "shipments",
            )
            return true
        }
        val result = client.acceptShipment(id)
        return if (result.isSuccess) {
            val currentUser = _user.value
            _shipments.value = _shipments.value.map {
                if (it.id == id) it.copy(
                    status = ShipmentStatus.ACCEPTED,
                    partnerId = currentUser?.id,
                    partnerName = currentUser?.name,
                    updatedAt = System.currentTimeMillis(),
                ) else it
            }
            true
        } else false
    }

    // ── Tracked packages (local — mirrors Expo AsyncStorage) ────────────

    private fun loadLocalPackages() {
        val raw = packagesPrefs.getString(KEY_PACKAGES_JSON, null) ?: return
        try {
            val list = packagesJson.decodeFromString<List<TrackedPackage>>(raw)
            _packages.value = list
        } catch (e: Exception) { /* corrupt data — start fresh */ }
    }

    private fun saveLocalPackages(list: List<TrackedPackage>) {
        packagesPrefs.edit()
            .putString(KEY_PACKAGES_JSON, packagesJson.encodeToString(list))
            .apply()
    }

    fun canAddPackage(): Boolean {
        if (_tier.value != SubscriptionTier.FREE) return true
        return _packages.value.size < com.rork.porchivo.config.AppConfig.FreeLimits.MAX_PACKAGES
    }

    fun addPackage(pkg: TrackedPackage) {
        if (!canAddPackage()) return
        val updated = listOf(pkg) + _packages.value
        _packages.value = updated
        saveLocalPackages(updated)
    }

    fun deletePackage(id: String) {
        val updated = _packages.value.filter { it.id != id }
        _packages.value = updated
        saveLocalPackages(updated)
    }

    // ── Notifications ───────────────────────────────────────────────────

    suspend fun loadNotifications(userId: String) {
        val client = supabase ?: return
        _notificationsLoadState.value = LoadState.Loading
        val result = client.fetchNotifications(userId)
        if (result.isSuccess) {
            val dbNotifs = result.getOrNull() ?: emptyList()
            _notifications.value = dbNotifs.map { Mappers.dbNotificationToNotification(it) }
            _notificationsLoadState.value = LoadState.Success(Unit)
        } else {
            _notificationsLoadState.value = LoadState.Error(
                result.exceptionOrNull()?.message ?: "Failed to load notifications",
            )
        }
    }

    suspend fun markNotificationRead(id: String) {
        val client = supabase ?: return
        if (!_isOnline.value) {
            enqueueAction(
                type = "update",
                target = "notifications",
                payload = mapOf("read" to true).toJsonString(),
                filter = mapOf("id" to id),
                refreshKey = "notifications",
            )
            return
        }
        val result = client.markNotificationRead(id)
        if (result.isSuccess) {
            _notifications.value = _notifications.value.map {
                if (it.id == id) it.copy(read = true) else it
            }
        }
    }

    suspend fun markAllNotificationsRead() {
        val client = supabase ?: return
        val userId = (authState.value as? AuthState.Authenticated)?.userId ?: return
        if (!_isOnline.value) {
            enqueueAction(
                type = "update",
                target = "notifications",
                payload = mapOf("read" to true).toJsonString(),
                filter = mapOf("recipient_id" to userId, "read" to "false"),
                refreshKey = "notifications",
            )
            return
        }
        val result = client.markAllNotificationsRead(userId)
        if (result.isSuccess) {
            _notifications.value = _notifications.value.map { it.copy(read = true) }
        }
    }

    // ── Risk Score (Theft Shield) ───────────────────────────────────────

    /** Session-level cache for the ZIP risk score (avoids re-fetching during onboarding). */
    private var cachedRiskScore: RiskScoreResponse? = null

    /**
     * Fetch a ZIP-based theft risk score from the `risk-score` edge function.
     * Result is cached for the session — onboarding only calls this once.
     * Falls back to a demo score of 34 if the function is unavailable.
     */
    suspend fun fetchRiskScore(zip: String): RiskScoreResponse {
        cachedRiskScore?.let { return it }

        val client = supabase ?: run {
            // Demo mode — return a sensible default
            return RiskScoreResponse(zip = zip.take(5), score = 34, level = "LOW", cached = true)
        }

        val result = client.invokeFunction("risk-score", mapOf("zip" to zip), RiskScoreResponse.serializer())
        return if (result.isSuccess) {
            val response = result.getOrNull()
            if (response != null) {
                cachedRiskScore = response
                response
            } else {
                RiskScoreResponse(zip = zip.take(5), score = 34, level = "LOW", cached = false)
            }
        } else {
            // Network/edge function failure — use demo score so onboarding continues
            RiskScoreResponse(zip = zip.take(5), score = 34, level = "LOW", cached = false)
        }
    }

    // ── Org checkout (B2B Stripe Checkout) ───────────────────────────

    /**
     * Calls `create-org-checkout` edge function to create a pending org + Stripe Checkout session.
     * Returns the checkout URL, session ID, and org ID.
     */
    suspend fun createOrgCheckout(
        name: String,
        type: String,
        address: String,
        city: String,
        state: String,
        zip: String,
        totalUnits: Int?,
        planTier: String,
        billingCycle: String,
        returnUrl: String,
    ): Result<OrgCheckoutResponse> {
        val client = supabase ?: return Result.failure(Exception("Backend not configured"))
        val body = buildMap {
            put("name", name)
            put("type", type)
            put("address", address)
            put("city", city)
            put("state", state)
            put("zip", zip)
            if (totalUnits != null) put("totalUnits", totalUnits)
            put("planTier", planTier)
            put("billingCycle", billingCycle)
            put("returnUrl", returnUrl)
        }
        return client.invokeFunction(
            "create-org-checkout",
            body,
            OrgCheckoutResponse.serializer(),
        )
    }

    /**
     * Calls `confirm-org-signup` edge function to verify payment and activate the org.
     */
    suspend fun confirmOrgSignup(sessionId: String, orgId: String): Result<OrgConfirmResponse> {
        val client = supabase ?: return Result.failure(Exception("Backend not configured"))
        val body = mapOf(
            "sessionId" to sessionId,
            "orgId" to orgId,
        )
        return client.invokeFunction(
            "confirm-org-signup",
            body,
            OrgConfirmResponse.serializer(),
        )
    }

    // ── Theme ───────────────────────────────────────────────────────────

    fun setDarkTheme(dark: Boolean) {
        _darkThemeOverride.value = dark
    }

    fun setLanguage(language: AppLanguage) {
        languageManager.setLanguage(language)
        _language.value = language
    }

    fun setLanguage(code: String) {
        languageManager.setLanguage(code)
        AppLanguage.fromCode(code)?.let { _language.value = it }
    }

    // ── Org membership (Free vs Community tier) ────────────────────────

    suspend fun loadOrgContext() {
        val client = supabase ?: return
        val result = client.fetchOrgContext()
        if (result.isSuccess) {
            val rows = result.getOrNull() ?: emptyList()
            val active = rows.firstOrNull { it.status == "active" }
                ?: rows.firstOrNull { it.status == "pending" }
            val userId = (authState.value as? AuthState.Authenticated)?.userId
            if (active != null && active.orgId != null) {
                val membership = OrgMembership(
                    orgId = active.orgId,
                    orgName = active.orgName ?: "Your Community",
                    role = active.role ?: "resident",
                    status = active.status ?: "pending",
                    inviteCode = null,
                )
                _orgMembership.value = membership
                // Persist to SharedPreferences for instant tier resolution on next launch
                if (userId != null) {
                    orgPrefs.edit()
                        .putString("org_cache_$userId", packagesJson.encodeToString(membership))
                        .apply()
                }
            } else {
                _orgMembership.value = null
                // Clear stale cache so a removed member doesn't see Community tier
                if (userId != null) {
                    orgPrefs.edit().remove("org_cache_$userId").apply()
                }
            }
        }
    }

    suspend fun refreshOrgContext() {
        loadOrgContext()
        if (isOrgMember) {
            _orgMembership.value?.orgId?.let { orgId ->
                loadAnnouncements(orgId)
                loadMaintenanceRequests(orgId)
            }
        }
    }

    // ── Announcements ─────────────────────────────────────────────────

    suspend fun loadAnnouncements(orgId: String) {
        val client = supabase ?: return
        val result = client.fetchAnnouncements(orgId)
        if (result.isSuccess) {
            val rows = result.getOrNull() ?: emptyList()
            _announcements.value = rows.map { Mappers.dbAnnouncementToAnnouncement(it) }
        }
    }

    suspend fun postAnnouncement(title: String, body: String): Boolean {
        val client = supabase ?: return false
        val orgId = _orgMembership.value?.orgId ?: return false
        val userId = (authState.value as? AuthState.Authenticated)?.userId ?: return false
        val payload = buildMap<String, Any?> {
            put("org_id", orgId)
            put("author_id", userId)
            put("title", title)
            put("body", body)
            put("priority", "normal")
            put("category", "general")
            put("is_pinned", false)
        }
        if (!_isOnline.value) {
            enqueueAction(
                type = "insert",
                target = "org_announcements",
                payload = payload.toJsonString(),
                refreshKey = "announcements",
            )
            return true
        }
        val result = client.insertAnnouncement(payload)
        return if (result.isSuccess) {
            result.getOrNull()?.let { Mappers.dbAnnouncementToAnnouncement(it) }?.let { item ->
                _announcements.value = listOf(item) + _announcements.value
            }
            true
        } else false
    }

    // ── Maintenance ──────────────────────────────────────────────────

    suspend fun loadMaintenanceRequests(orgId: String) {
        val client = supabase ?: return
        val result = client.fetchMyMaintenanceRequests(orgId)
        if (result.isSuccess) {
            val rows = result.getOrNull() ?: emptyList()
            _maintenanceRequests.value = rows.map { Mappers.dbMyMaintenanceToRequest(it) }
        }
    }

    suspend fun submitMaintenanceRequest(
        category: String,
        priority: String,
        title: String,
        description: String?,
        location: String?,
    ): Boolean {
        val client = supabase ?: return false
        val orgId = _orgMembership.value?.orgId ?: return false
        if (!_isOnline.value) {
            enqueueAction(
                type = "rpc",
                target = "submit_maintenance_request",
                payload = mapOf(
                    "p_org_id" to orgId,
                    "p_category" to category,
                    "p_priority" to priority,
                    "p_title" to title,
                    "p_description" to description,
                    "p_location" to location,
                ).toJsonString(),
                refreshKey = "maintenance",
            )
            return true
        }
        val result = client.submitMaintenanceRequest(
            orgId = orgId,
            category = category,
            priority = priority,
            title = title,
            description = description,
            location = location,
        )
        return if (result.isSuccess) {
            loadMaintenanceRequests(orgId)
            true
        } else false
    }

    // ── Subscription ────────────────────────────────────────────────────

    fun upgradeTier(newTier: SubscriptionTier) {
        _tier.value = newTier
    }

    suspend fun markOnboardingComplete() {
        val client = supabase ?: run {
            // Demo mode — mark local user as onboarded
            val currentUser = _user.value
            if (currentUser != null) {
                _user.value = currentUser.copy(isOnboarded = true)
            }
            return
        }
        val userId = (authState.value as? AuthState.Authenticated)?.userId ?: return
        val result = client.updateProfile(userId, mapOf("is_onboarded" to true))
        if (result.isSuccess) {
            val dbProfile = result.getOrNull()
            if (dbProfile != null) {
                _user.value = Mappers.dbProfileToUser(dbProfile)
            } else {
                _user.value = _user.value?.copy(isOnboarded = true)
            }
        } else {
            _user.value = _user.value?.copy(isOnboarded = true)
        }
    }

    companion object {
        private const val KEY_PACKAGES_JSON = "tracked_packages_json"
    }
}
