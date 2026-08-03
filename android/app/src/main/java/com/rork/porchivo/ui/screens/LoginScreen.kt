package com.rork.porchivo.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.R
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

/**
 * Auth screen — email/password sign-in and sign-up.
 * Mirrors the Expo app's auth flow (Supabase Auth with PKCE).
 *
 * On successful auth, the navigation graph automatically switches to the main
 * tabs because AppNavigation observes authState.
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
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }

    val isLoading = authState is AuthState.Loading

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.accent,
        unfocusedBorderColor = c.border,
        focusedContainerColor = c.surface,
        unfocusedContainerColor = c.surface,
        focusedTextColor = c.textPrimary,
        unfocusedTextColor = c.textPrimary,
        cursorColor = c.accent,
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Logo / brand — Porchivo mark underlaid by the cartoon cardboard box
        Box(
            modifier = Modifier.size(150.dp),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(id = R.drawable.delivery_box_cardboard),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
                alpha = 0.95f,
            )
            Image(
                painter = painterResource(id = R.drawable.brand_logo),
                contentDescription = "Porchivo",
                modifier = Modifier.size(96.dp),
                contentScale = ContentScale.Fit,
            )
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Porchivo",
            color = c.textPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = (-0.5).sp,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = if (isSignUp) "Create your account" else "Welcome back",
            color = c.textSecondary,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Email
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            placeholder = { Text("Email", color = c.textMuted) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Mail,
                    contentDescription = null,
                    tint = c.textMuted,
                    modifier = Modifier.size(20.dp),
                )
            },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Password
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            placeholder = { Text("Password", color = c.textMuted) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = c.textMuted,
                    modifier = Modifier.size(20.dp),
                )
            },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Error message
        authError?.let { errorMsg ->
            Text(
                text = errorMsg,
                color = c.danger,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
            )
        }

        // Submit button
        Button(
            onClick = {
                if (email.isNotBlank() && password.isNotBlank()) {
                    if (isSignUp) {
                        appViewModel.signUp(email, password)
                    } else {
                        appViewModel.signIn(email, password)
                    }
                }
            },
            enabled = email.isNotBlank() && password.isNotBlank() && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.accent,
                disabledContainerColor = c.elevated,
            ),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = c.onAccent,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                Text(
                    text = if (isSignUp) "Create Account" else "Sign In",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (email.isNotBlank() && password.isNotBlank()) c.onAccent else c.textMuted,
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Toggle sign-in / sign-up
        TextButton(onClick = { isSignUp = !isSignUp }) {
            Text(
                text = if (isSignUp) "Already have an account? Sign in" else "New to Porchivo? Create an account",
                color = c.accent,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
