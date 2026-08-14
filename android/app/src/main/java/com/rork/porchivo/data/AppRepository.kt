package com.rork.porchivo.data

import android.content.Context
import com.rork.porchivo.BuildConfig
import com.rork.porchivo.data.dto.AuthSession
import com.rork.porchivo.data.dto.DbNotification
import com.rork.porchivo.data.dto.DbProfile
import com.rork.porchivo.data.dto.DbShipment
import com.rork.porchivo.data.dto.RiskScoreResponse
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.DeliveryNotification
import com.rork.porchivo.model.DeliveryStatus
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

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

    // Local storage for tracked packages (SharedPreferences — mirrors Expo AsyncStorage)
    private val packagesPrefs = context.getSharedPreferences("porchivo_packages", Context.MODE_PRIVATE)
    private val packagesJson = kotlinx.serialization.json.Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
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

    /**
     * Sign out — clears session and all data.
     */
    fun signOut() {
        supabase?.signOut()
        _authState.value = AuthState.Unauthenticated
        _user.value = null
        _tier.value = SubscriptionTier.FREE
        _shipments.value = emptyList()
        _notifications.value = emptyList()
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
    private suspend fun loadInitialData(userId: String) {
        loadProfile(userId)
        loadShipments(userId)
        loadNotifications(userId)
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
        return true // HOA-provisioned model — all users have full access
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

    // ── Theme ───────────────────────────────────────────────────────────

    fun setDarkTheme(dark: Boolean) {
        _darkThemeOverride.value = dark
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
