package com.rork.porchivo.ui.navigation

import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.view.Surface
import android.view.TextureView

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
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
    val initialLoadError by appViewModel.initialLoadError.collectAsStateWithLifecycle()
    val showAuthFail by appViewModel.showAuthFail.collectAsStateWithLifecycle()
    // Collected so the onboarding → main-app gate recomposes when
    // markOnboardingComplete() flips the user's flag (a plain getter
    // wouldn't observe the StateFlow update).
    val user by appViewModel.user.collectAsStateWithLifecycle()
    val c = PorchivoTheme.colors

    val showSplash = authState is AuthState.Loading ||
        (authState is AuthState.Authenticated && !isReadyToShowUI)

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
                if (user?.isOnboarded == true) {
                    AppNavigation()
                } else {
                    OnboardingFlowScreen(
                        onComplete = { appViewModel.markOnboardingComplete() },
                    )
                }
            }
        }

        // Splash overlay — matches the native launch window background.
        // Hard gate on the STATE, not an animated alpha: if removal waited for
        // splashAlpha to reach 0f, the splash could linger forever whenever
        // frame production stalls (it must always lift, reliably).
        if (showSplash) {
            SplashScreen()
            // Post-login initial load failed — surface a retry instead of
            // leaving the user on the logo screen forever.
            initialLoadError?.let { error ->
                SplashErrorOverlay(message = error, onRetry = { appViewModel.retryInitialLoad() })
            }
        }
    }
}

/**
 * Shown over the splash when the post-login initial load fails (e.g. the
 * profile fetch). Offers "Try again" instead of leaving the user stuck.
 */
@Composable
private fun SplashErrorOverlay(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.72f))
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Couldn't load your dashboard",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Text(
                text = message,
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Button(onClick = onRetry) {
                Text(text = "Try again")
            }
        }
    }
}

@Composable
private fun SplashScreen(modifier: Modifier = Modifier) {
    val isDark = isSystemInDarkTheme()
    var videoFailed by remember { mutableStateOf(false) }

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
        // Static splash behind the video — visible until the first frame
        // renders and restored if playback fails on this device.
        Image(
            painter = painterResource(id = R.drawable.splash),
            contentDescription = null,
            modifier = Modifier.size(width = 320.dp, height = 693.dp),
            contentScale = ContentScale.Fit,
        )

        if (!videoFailed) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    TextureView(ctx).apply {
                        surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                            var player: MediaPlayer? = null

                            override fun onSurfaceTextureAvailable(
                                surface: SurfaceTexture,
                                width: Int,
                                height: Int,
                            ) {
                                val mp = MediaPlayer.create(ctx, R.raw.splash_video)
                                if (mp == null) {
                                    videoFailed = true
                                    return
                                }
                                player = mp
                                mp.setSurface(Surface(surface))
                                // Hold the final frame after playback instead of looping
                                mp.setOnCompletionListener { }
                                mp.setOnErrorListener { _, _, _ ->
                                    videoFailed = true
                                    true
                                }
                                // Cover-fit: scale the video to fill the screen,
                                // centered, cropping the overflow
                                if (mp.videoWidth > 0 && mp.videoHeight > 0) {
                                    val sx = width.toFloat() / mp.videoWidth
                                    val sy = height.toFloat() / mp.videoHeight
                                    val s = maxOf(sx, sy)
                                    val m = Matrix().apply {
                                        setScale(s, s)
                                        postTranslate(
                                            (width - mp.videoWidth * s) / 2f,
                                            (height - mp.videoHeight * s) / 2f,
                                        )
                                    }
                                    setTransform(m)
                                }
                                mp.start()
                            }

                            override fun onSurfaceTextureSizeChanged(
                                surface: SurfaceTexture,
                                width: Int,
                                height: Int,
                            ) = Unit

                            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                                player?.release()
                                player = null
                                return true
                            }

                            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
                        }
                    }
                },
            )
        }
    }
}
