package com.rork.porchivo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.data.AppLanguage
import com.rork.porchivo.data.dto.OrgMembership
import com.rork.porchivo.data.dto.OrgCheckoutResponse
import com.rork.porchivo.data.dto.OrgConfirmResponse
import com.rork.porchivo.data.dto.DbOrgAmenity
import com.rork.porchivo.data.dto.DbOrgAmenityReservation
import com.rork.porchivo.data.dto.DbOrgDocument
import com.rork.porchivo.data.dto.DbOrgPayment
import com.rork.porchivo.data.dto.RiskScoreResponse
import com.rork.porchivo.model.Announcement
import com.rork.porchivo.model.MaintenanceRequest
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch

/**
 * Session-level state: auth, user, subscription tier, theme.
 * Mirrors AppContext + ThemeContext from the Expo app.
 *
 * All data is backed by AppRepository which talks to Supabase.
 */
class AppViewModel : ViewModel() {

    private val repo = AppRepositoryHolder.get()

    val authState: StateFlow<AuthState> = repo.authState
    val user: StateFlow<User?> = repo.user
    val tier: StateFlow<SubscriptionTier> = repo.tier
    val orgMembership: StateFlow<OrgMembership?> = repo.orgMembership
    val announcements: StateFlow<List<Announcement>> = repo.announcements
    val maintenanceRequests: StateFlow<List<MaintenanceRequest>> = repo.maintenanceRequests
    val darkThemeOverride: StateFlow<Boolean?> = repo.darkThemeOverride
    val language: StateFlow<AppLanguage> = repo.language
    val authError: StateFlow<String?> = repo.authError
    val isReadyToShowUI: StateFlow<Boolean> = repo.isReadyToShowUI

    // ── Language transition (fade) ─────────────────────────────────────
    private val _languageTransitioning = MutableStateFlow(false)
    val languageTransitioning: StateFlow<Boolean> = _languageTransitioning.asStateFlow()

    // ── Auth fail (oops) screen ────────────────────────────────────────
    private val _showAuthFail = MutableStateFlow(false)
    val showAuthFail: StateFlow<Boolean> = _showAuthFail.asStateFlow()

    fun setShowAuthFail(value: Boolean) {
        _showAuthFail.value = value
    }
    val isOnboarded: Boolean get() = repo.isOnboarded
    val isOrgMember: Boolean get() = repo.isOrgMember
    val isOrgAdmin: Boolean get() = repo.isOrgAdmin

    fun signIn(email: String, password: String) {
        viewModelScope.launch { repo.signIn(email, password) }
    }

    fun signUp(email: String, password: String) {
        viewModelScope.launch { repo.signUp(email, password) }
    }

    suspend fun sendMagicLink(email: String): Boolean {
        return repo.sendMagicLink(email)
    }

    suspend fun verifyOtp(email: String, token: String): Boolean {
        return repo.verifyOtp(email, token)
    }

    suspend fun developerLogin() {
        repo.developerLogin()
    }

    fun signOut() {
        repo.signOut()
    }

    suspend fun requestAccountDeletion(): Result<String?> {
        return repo.requestAccountDeletion()
    }

    fun updateRole(role: UserRole) {
        viewModelScope.launch { repo.updateRole(role) }
    }

    fun setLocationConsent(granted: Boolean) {
        viewModelScope.launch { repo.setLocationConsent(granted) }
    }

    fun setDarkTheme(dark: Boolean) = repo.setDarkTheme(dark)

    fun setLanguage(language: AppLanguage) {
        if (_languageTransitioning.value) return
        _languageTransitioning.value = true

        viewModelScope.launch {
            delay(220)
            repo.setLanguage(language)
            delay(60)
            _languageTransitioning.value = false
        }
    }

    fun setLanguage(code: String) {
        if (_languageTransitioning.value) return
        AppLanguage.fromCode(code) ?: return
        _languageTransitioning.value = true

        viewModelScope.launch {
            delay(220)
            repo.setLanguage(code)
            delay(60)
            _languageTransitioning.value = false
        }
    }

    fun upgradeTier(tier: SubscriptionTier) = repo.upgradeTier(tier)

    fun refreshOrgContext() {
        viewModelScope.launch { repo.refreshOrgContext() }
    }

    suspend fun postAnnouncement(title: String, body: String): Boolean {
        return repo.postAnnouncement(title, body)
    }

    suspend fun submitMaintenanceRequest(
        category: String,
        priority: String,
        title: String,
        description: String?,
        location: String?,
    ): Boolean {
        return repo.submitMaintenanceRequest(category, priority, title, description, location)
    }

    // ── Org documents + amenities (paid-tier community features) ──────

    val orgDocuments: StateFlow<List<DbOrgDocument>> = repo.orgDocuments
    val orgDocumentsLoadState: StateFlow<LoadState<Unit>> = repo.orgDocumentsLoadState
    val orgAmenities: StateFlow<List<DbOrgAmenity>> = repo.orgAmenities
    val orgAmenitiesLoadState: StateFlow<LoadState<Unit>> = repo.orgAmenitiesLoadState
    val orgReservations: StateFlow<List<DbOrgAmenityReservation>> = repo.orgReservations
    val orgReservationsLoadState: StateFlow<LoadState<Unit>> = repo.orgReservationsLoadState
    val orgPlanTier: StateFlow<String?> = repo.orgPlanTier

    val isOrgStaff: Boolean get() = repo.isOrgStaff
    val currentUserId: String? get() = repo.currentUserId

    fun loadOrgDocuments() {
        viewModelScope.launch { repo.loadOrgDocuments() }
    }

    suspend fun addOrgDocumentLink(name: String, url: String): Result<Unit> {
        return repo.addOrgDocumentLink(name, url)
    }

    suspend fun uploadOrgDocument(
        name: String,
        bytes: ByteArray,
        ext: String,
        mime: String,
        sizeBytes: Long,
    ): Result<Unit> {
        return repo.uploadOrgDocument(name, bytes, ext, mime, sizeBytes)
    }

    suspend fun removeOrgDocument(id: String, filePath: String?): Result<Unit> {
        return repo.removeOrgDocument(id, filePath)
    }

    suspend fun openOrgDocument(filePath: String): Result<String> {
        return repo.openOrgDocument(filePath)
    }

    fun loadOrgAmenitiesAndReservations() {
        viewModelScope.launch {
            repo.loadOrgPlanTier()
            repo.loadOrgAmenities()
            repo.loadOrgReservations()
        }
    }

    val orgPayments: StateFlow<List<DbOrgPayment>> = repo.orgPayments
    val orgPaymentsLoadState: StateFlow<LoadState<Unit>> = repo.orgPaymentsLoadState

    /** Staff: loads plan tier + payment ledger for the Payments Ledger screen. */
    fun loadOrgLedger() {
        viewModelScope.launch {
            repo.loadOrgPlanTier()
            repo.loadOrgPayments()
        }
    }

    fun refreshOrgReservations() {
        viewModelScope.launch { repo.loadOrgReservations() }
    }

    suspend fun addOrgAmenity(name: String): Result<Unit> {
        return repo.addOrgAmenity(name)
    }

    suspend fun removeOrgAmenity(amenityId: String): Result<Unit> {
        return repo.removeOrgAmenity(amenityId)
    }

    suspend fun reserveAmenity(amenityId: String, startIso: String, endIso: String): Result<Unit> {
        return repo.reserveAmenity(amenityId, startIso, endIso)
    }

    suspend fun cancelOrgReservation(reservationId: String): Result<Unit> {
        return repo.cancelOrgReservation(reservationId)
    }

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
        return repo.createOrgCheckout(
            name, type, address, city, state, zip, totalUnits, planTier, billingCycle, returnUrl,
        )
    }

    suspend fun confirmOrgSignup(sessionId: String, orgId: String): Result<OrgConfirmResponse> {
        return repo.confirmOrgSignup(sessionId, orgId)
    }

    fun markOnboardingComplete() {
        viewModelScope.launch { repo.markOnboardingComplete() }
    }

    fun completeOnboarding(
        name: String,
        phone: String,
        address: String,
        role: UserRole,
        hasLocationConsent: Boolean,
    ) {
        viewModelScope.launch {
            repo.completeOnboarding(name, phone, address, role, hasLocationConsent)
        }
    }

    /**
     * Fetch a ZIP-based theft risk score from the `risk-score` edge function.
     * Session-cached in the repository. Falls back to a demo score if unavailable.
     */
    suspend fun fetchRiskScore(zip: String): RiskScoreResponse {
        return repo.fetchRiskScore(zip)
    }
}
