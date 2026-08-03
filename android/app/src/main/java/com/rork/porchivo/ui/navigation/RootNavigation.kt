package com.rork.porchivo.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.ui.screens.LoginScreen
import com.rork.porchivo.ui.screens.OnboardingFlowScreen
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

/**
 * Root navigation — gates the main app behind auth state.
 *
 * - AuthState.Loading → splash spinner (session restore in progress)
 * - AuthState.Unauthenticated → LoginScreen
 * - AuthState.Authenticated → AppNavigation (main tabs)
 * - AuthState.Error → LoginScreen with error
 */
@Composable
fun RootNavigation() {
    val appViewModel: AppViewModel = viewModel()
    val authState by appViewModel.authState.collectAsStateWithLifecycle()
    val c = PorchivoTheme.colors

    when (authState) {
        is AuthState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = c.accent)
            }
        }

        is AuthState.Unauthenticated,
        is AuthState.Error -> {
            LoginScreen(
                onAuthSuccess = { /* Navigation switches automatically via state */ },
                appViewModel = appViewModel,
            )
        }

        is AuthState.Authenticated -> {
            if (appViewModel.isOnboarded) {
                AppNavigation()
            } else {
                OnboardingFlowScreen(
                    onComplete = { appViewModel.markOnboardingComplete() },
                )
            }
        }
    }
}
