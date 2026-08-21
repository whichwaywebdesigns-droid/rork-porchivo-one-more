package com.rork.porchivo.ui.navigation

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.R
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.ui.screens.AuthFailScreen
import com.rork.porchivo.ui.screens.LoginScreen
import com.rork.porchivo.ui.screens.OnboardingFlowScreen
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

/**
 * Root navigation — gates the main app behind auth state.
 *
 * - AuthState.Loading → splash image (session restore in progress)
 * - AuthState.Unauthenticated → LoginScreen
 * - AuthState.Authenticated → AppNavigation (main tabs)
 * - AuthState.Error → LoginScreen with error
 *
 * A seamless splash overlay stays on screen while the home dashboard's initial
 * data loads and fades out once everything is ready.
 */
@Composable
fun RootNavigation() {
    val appViewModel: AppViewModel = viewModel()
    val authState by appViewModel.authState.collectAsStateWithLifecycle()
    val isReadyToShowUI by appViewModel.isReadyToShowUI.collectAsStateWithLifecycle()
    val showAuthFail by appViewModel.showAuthFail.collectAsStateWithLifecycle()
    val c = PorchivoTheme.colors

    val showSplash = authState is AuthState.Loading ||
        (authState is AuthState.Authenticated && !isReadyToShowUI)
    val splashAlpha by animateFloatAsState(
        targetValue = if (showSplash) 1f else 0f,
        animationSpec = tween(durationMillis = 450),
        label = "splashAlpha",
    )

    Box(modifier = Modifier.fillMaxSize()) {
        when (authState) {
            is AuthState.Loading -> {
                /* Content is hidden behind the splash overlay. */
            }

            is AuthState.Unauthenticated,
            is AuthState.Error -> {
                if (showAuthFail) {
                    AuthFailScreen(
                        onBack = {
                            appViewModel.setShowAuthFail(false)
                        },
                        onCreateAccount = {
                            appViewModel.setShowAuthFail(false)
                        },
                    )
                } else {
                    LoginScreen(
                        onAuthSuccess = { /* Navigation switches automatically via state */ },
                        appViewModel = appViewModel,
                    )
                }
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

        // Splash overlay — matches the native launch window background.
        if (splashAlpha > 0f) {
            SplashScreen(modifier = Modifier.alpha(splashAlpha))
        }
    }
}

@Composable
private fun SplashScreen(modifier: Modifier = Modifier) {
    val isDark = isSystemInDarkTheme()
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                color = colorResource(
                    id = if (isDark) R.color.splash_background_dark else R.color.splash_background,
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(id = R.drawable.splash),
            contentDescription = null,
            modifier = Modifier.size(width = 320.dp, height = 693.dp),
            contentScale = ContentScale.Fit,
        )
    }
}
