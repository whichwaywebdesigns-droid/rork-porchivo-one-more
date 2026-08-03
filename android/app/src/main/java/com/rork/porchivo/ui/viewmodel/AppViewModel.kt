package com.rork.porchivo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.data.dto.RiskScoreResponse
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole
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
    val darkThemeOverride: StateFlow<Boolean?> = repo.darkThemeOverride
    val authError: StateFlow<String?> = repo.authError
    val isOnboarded: Boolean get() = repo.isOnboarded

    fun signIn(email: String, password: String) {
        viewModelScope.launch { repo.signIn(email, password) }
    }

    fun signUp(email: String, password: String) {
        viewModelScope.launch { repo.signUp(email, password) }
    }

    fun signOut() {
        repo.signOut()
    }

    fun updateRole(role: UserRole) {
        viewModelScope.launch { repo.updateRole(role) }
    }

    fun setLocationConsent(granted: Boolean) {
        viewModelScope.launch { repo.setLocationConsent(granted) }
    }

    fun setDarkTheme(dark: Boolean) = repo.setDarkTheme(dark)

    fun upgradeTier(tier: SubscriptionTier) = repo.upgradeTier(tier)

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
