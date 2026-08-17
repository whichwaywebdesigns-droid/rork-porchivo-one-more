package com.rork.porchivo.ui.screens

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.R
import com.rork.porchivo.ui.theme.PorchivoTheme

/**
 * "Oops!" screen — shown when a user attempts to sign in without having
 * created an account first. Displays the brand logo, a friendly message,
 * and a back arrow to return to the login screen.
 */
@Composable
fun AuthFailScreen(
    onBack: () -> Unit,
    onCreateAccount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current

    var logoReady by remember { mutableStateOf(false) }
    var contentReady by remember { mutableStateOf(false) }

    val logoScale by animateFloatAsState(
        targetValue = if (logoReady) 1f else 0.8f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMedium),
        label = "logoScale",
    )
    val contentAlpha by animateFloatAsState(
        targetValue = if (contentReady) 1f else 0f,
        animationSpec = tween(durationMillis = 500),
        label = "contentAlpha",
    )
    val contentOffset by animateFloatAsState(
        targetValue = if (contentReady) 0f else 30f,
        animationSpec = spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow),
        label = "contentOffset",
    )

    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(100)
        logoReady = true
        kotlinx.coroutines.delay(100)
        contentReady = true
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(c.background, c.elevated),
                ),
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top,
        ) {
            // Back arrow
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                Button(
                    onClick = onBack,
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = c.surface,
                        contentColor = c.accent,
                    ),
                    modifier = Modifier.size(44.dp),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back to Login",
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Logo
            Image(
                painter = painterResource(id = R.drawable.brand_logo),
                contentDescription = "Porchivo logo",
                modifier = Modifier
                    .size(100.dp)
                    .scale(logoScale),
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Message
            Column(
                modifier = Modifier.alpha(contentAlpha),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Oops!",
                    fontSize = 42.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = c.textPrimary,
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "We couldn't find an account with that email.\nYou need to create an account first to sign in.",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = c.textSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 24.sp,
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            // Buttons
            Column(
                modifier = Modifier
                    .alpha(contentAlpha)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Button(
                    onClick = onBack,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = c.accent,
                        contentColor = c.onAccent,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Back to Login",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                TextButton(onClick = onCreateAccount) {
                    Icon(
                        imageVector = Icons.Filled.PersonAdd,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = c.accent,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Create an Account",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = c.accent,
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Support link
            TextButton(onClick = {
                val intent = android.content.Intent(
                    android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse("mailto:support@porchivo.com?subject=Porchivo%20Support"),
                )
                context.startActivity(intent)
            }) {
                Icon(
                    imageVector = Icons.Outlined.HelpOutline,
                    contentDescription = null,
                    modifier = Modifier.size(13.dp),
                    tint = c.textMuted,
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Need help? Contact support",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = c.textMuted,
                )
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
