package com.rork.porchivo

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.ui.navigation.RootNavigation
import com.rork.porchivo.ui.theme.AppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = AppRepositoryHolder.get()

        // Handle deep link if the activity was launched via an intent filter
        // (e.g. porchivo://org-signup/success redirect from Stripe Checkout)
        handleDeepLink(intent, repository)

        setContent {
            // Restore session on app start
            LaunchedEffect(Unit) {
                try {
                    repository.restoreSession()
                } catch (e: Exception) {
                    // If session restore fails, fall back to unauthenticated state
                    // instead of crashing the app.
                    android.util.Log.e("MainActivity", "Session restore failed", e)
                }
            }

            val darkOverride by repository.darkThemeOverride.collectAsStateWithLifecycle()
            val darkTheme = darkOverride ?: isSystemInDarkTheme()
            AppTheme(darkTheme = darkTheme) {
                RootNavigation()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val repository = AppRepositoryHolder.get()
        handleDeepLink(intent, repository)
    }

    /**
     * Checks if the intent contains a porchivo:// deep link and passes it
     * to the repository so the OrgSignupScreen can react to the redirect.
     */
    private fun handleDeepLink(intent: Intent?, repository: com.rork.porchivo.data.AppRepository) {
        val data = intent?.data ?: return
        val url = data.toString()
        if (url.startsWith("porchivo://org-signup/")) {
            repository.setOrgSignupRedirect(url)
        }
    }
}
