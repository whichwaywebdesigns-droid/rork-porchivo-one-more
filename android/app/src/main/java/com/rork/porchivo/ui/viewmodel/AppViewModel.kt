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
import com.rork.porchivo.data.dto.RiskScoreResponse
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
    val darkThemeOverride: StateFlow<Boolean?> = repo.darkThemeOverride
    val language: StateFlow<AppLanguage> = repo.language
    val authError: StateFlow<String?> = repo.authError

    // ── Language transition (fade) ─────────────────────────────────────
    private val _languageTransitioning = MutableStateFlow(false)
    val languageTransitioning: StateFlow<Boolean> = _languageTransitioning.asStateFlow()
    val isOnboarded: Boolean get() = repo.isOnboarded
    val isOrgMember: Boolean get() = repo.isOrgMember
    val isOrgAdmin: Boolean get() = repo.isOrgAdmin

    fun signIn(email: String, password: String) {
        viewModelScope.launch { repo.signIn(email, password) }
    }

    fun signUp(email: String, password: String) {
        viewModelScope.launch { repo.signUp(email, password) }
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
