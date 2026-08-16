package com.rork.porchivo.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.R
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

/**
 * Auth screen — magic link authentication with the Porchivo welcome-porch hero.
 * Email → 6-digit OTP code → verified. No passwords.
 * A developer login link sits under the magic link button for internal testing bypass.
 */
@Composable
fun LoginScreen(
    onAuthSuccess: () -> Unit,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val authState by appViewModel.authState.collectAsStateWithLifecycle()
    val authError by appViewModel.authError.collectAsStateWithLifecycle()

    var email by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var phase by remember { mutableStateOf(AuthPhase.EMAIL) }
    var linkSent by remember { mutableStateOf(false) }

    val isLoading = authState is AuthState.Loading
    val scope = rememberCoroutineScope()

    // Side-effect: navigate out once authenticated.
    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated) {
            onAuthSuccess()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        // Hero illustration fills the background.
        Image(
            painter = painterResource(id = R.drawable.porchlogin),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )

        // Dark scrim so the white porch doesn't blow out in dark mode.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.22f)
                .background(Color.Black),
        )

        // Scrollable bottom controls.
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Bottom,
        ) {
            Spacer(modifier = Modifier.weight(1f))
            ControlsCard(
                email = email,
                onEmailChange = { email = it },
                otpCode = otpCode,
                onOtpChange = { otpCode = it.filter(Char::isDigit).take(6) },
                phase = phase,
                onPhaseChange = { phase = it },
                linkSent = linkSent,
                onLinkSentChange = { linkSent = it },
                authError = authError,
                isLoading = isLoading,
                onSendMagicLink = {
                    scope.launch {
                        val ok = appViewModel.sendMagicLink(email)
                        if (ok) {
                            linkSent = true
                            phase = AuthPhase.CODE
                        }
                    }
                },
                onVerifyOtp = {
                    scope.launch { appViewModel.verifyOtp(email, otpCode) }
                },
                onDeveloperLogin = { appViewModel.developerLogin() },
            )
        }
    }
}

@Composable
private fun ControlsCard(
    email: String,
    onEmailChange: (String) -> Unit,
    otpCode: String,
    onOtpChange: (String) -> Unit,
    phase: AuthPhase,
    onPhaseChange: (AuthPhase) -> Unit,
    linkSent: Boolean,
    onLinkSentChange: (Boolean) -> Unit,
    authError: String?,
    isLoading: Boolean,
    onSendMagicLink: () -> Unit,
    onVerifyOtp: () -> Unit,
    onDeveloperLogin: () -> Unit,
) {
    val c = PorchivoTheme.colors

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(c.surface.copy(alpha = 0.92f), RoundedCornerShape(24.dp))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (phase) {
            AuthPhase.EMAIL -> EmailPhase(
                email = email,
                onEmailChange = onEmailChange,
                linkSent = linkSent,
                authError = authError,
                isLoading = isLoading,
                onSendMagicLink = onSendMagicLink,
                onDeveloperLogin = onDeveloperLogin,
            )
            AuthPhase.CODE -> CodePhase(
                email = email,
                otpCode = otpCode,
                onOtpChange = onOtpChange,
                authError = authError,
                isLoading = isLoading,
                onVerifyOtp = onVerifyOtp,
                onBackToEmail = { onPhaseChange(AuthPhase.EMAIL) },
                onResendCode = onSendMagicLink,
            )
        }
    }
}

@Composable
private fun EmailPhase(
    email: String,
    onEmailChange: (String) -> Unit,
    linkSent: Boolean,
    authError: String?,
    isLoading: Boolean,
    onSendMagicLink: () -> Unit,
    onDeveloperLogin: () -> Unit,
) {
    val c = PorchivoTheme.colors
    val isValidEmail = email.trim().contains("@") && email.trim().contains(".")

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Color(0xFFD4A574),
        unfocusedBorderColor = Color(0xFFD4A574),
        focusedContainerColor = Color(0xFFF5E6D3),
        unfocusedContainerColor = Color(0xFFF5E6D3),
        focusedTextColor = Color(0xFF3D2B1F),
        unfocusedTextColor = Color(0xFF3D2B1F),
        cursorColor = Color(0xFF8B5E3C),
    )

    OutlinedTextField(
        value = email,
        onValueChange = onEmailChange,
        placeholder = { Text("Enter your email", color = Color(0xFF8B5E3C)) },
        leadingIcon = {
            Icon(
                imageVector = Icons.Filled.Mail,
                contentDescription = null,
                tint = Color(0xFF8B5E3C),
                modifier = Modifier.width(20.dp),
            )
        },
        colors = fieldColors,
        shape = RoundedCornerShape(12.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(modifier = Modifier.height(16.dp))

    Button(
        onClick = onSendMagicLink,
        enabled = isValidEmail && !isLoading,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF2E5A96),
            disabledContainerColor = c.elevated,
        ),
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = c.onAccent,
                strokeWidth = 2.dp,
                modifier = Modifier.width(20.dp),
            )
        } else {
            Icon(
                imageVector = Icons.Filled.Mail,
                contentDescription = null,
                tint = c.onAccent,
                modifier = Modifier.width(20.dp),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (linkSent) "Sending link…" else "Send magic link",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = c.onAccent,
            )
        }
    }

    if (linkSent) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Check your email for a 6-digit code.",
            color = c.textSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
    }

    Spacer(modifier = Modifier.height(12.dp))

    TextButton(onClick = onDeveloperLogin) {
        Text(
            text = "Developer login",
            color = c.textSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            textDecoration = TextDecoration.Underline,
        )
    }

    authError?.let { errorMsg ->
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = errorMsg,
            color = c.danger,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun CodePhase(
    email: String,
    otpCode: String,
    onOtpChange: (String) -> Unit,
    authError: String?,
    isLoading: Boolean,
    onVerifyOtp: () -> Unit,
    onBackToEmail: () -> Unit,
    onResendCode: () -> Unit,
) {
    val c = PorchivoTheme.colors
    val isOtpComplete = otpCode.length == 6

    Text(
        text = "We sent a 6-digit code to $email",
        color = c.textSecondary,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(modifier = Modifier.height(16.dp))

    OutlinedTextField(
        value = otpCode,
        onValueChange = onOtpChange,
        placeholder = { Text("6-digit code", color = c.textMuted) },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = c.accent,
            unfocusedBorderColor = c.border,
            focusedContainerColor = c.surface,
            unfocusedContainerColor = c.surface,
            focusedTextColor = c.textPrimary,
            unfocusedTextColor = c.textPrimary,
            cursorColor = c.accent,
        ),
        shape = RoundedCornerShape(12.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(modifier = Modifier.height(16.dp))

    Button(
        onClick = onVerifyOtp,
        enabled = isOtpComplete && !isLoading,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF2E5A96),
            disabledContainerColor = c.elevated,
        ),
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = c.onAccent,
                strokeWidth = 2.dp,
                modifier = Modifier.width(20.dp),
            )
        } else {
            Text(
                text = "Verify code",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = c.onAccent,
            )
        }
    }

    Spacer(modifier = Modifier.height(8.dp))

    TextButton(onClick = onBackToEmail) {
        Text(
            text = "Use a different email",
            color = c.accent,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }

    TextButton(onClick = onResendCode) {
        Text(
            text = "Resend code",
            color = c.textSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }

    authError?.let { errorMsg ->
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = errorMsg,
            color = c.danger,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private enum class AuthPhase {
    EMAIL,
    CODE,
}
