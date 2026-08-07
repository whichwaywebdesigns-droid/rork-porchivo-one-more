package com.rork.porchivo.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.R
import com.rork.porchivo.model.AddressNickname
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.PackageStatusEvent
import com.rork.porchivo.model.PackageTrackingStatus
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.util.UUID

/**
 * Value-first onboarding (6 steps, Android):
 * Welcome → Add delivery → Theft Shield reveal → Alerts priming (POST_NOTIFICATIONS) →
 * Porch partners → Home.
 *
 * Design principle: value before asks. The custom priming screen goes before the
 * system POST_NOTIFICATIONS prompt because declining your screen is free (re-ask
 * later), while declining the system dialog is nearly permanent.
 */
@Composable
fun OnboardingFlowScreen(
    onComplete: () -> Unit,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    var step by remember { mutableIntStateOf(0) }
    val totalSteps = 6

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(c.background),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp),
        ) {
            // Progress dots
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                for (i in 0 until totalSteps) {
                    Box(
                        modifier = Modifier
                            .height(8.dp)
                            .weight(if (i == step) 1.5f else 1f)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (i <= step) c.accent else c.elevated),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Step content with slide animation
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                androidx.compose.animation.AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        (slideInHorizontally(tween(300)) { it } + fadeIn(tween(300))) togetherWith
                                (slideOutHorizontally(tween(300)) { -it } + fadeOut(tween(300)))
                    },
                    label = "onboarding_step",
                ) { currentStep ->
                    when (currentStep) {
                        0 -> WelcomeStep(c) { step = 1 }
                        1 -> AddDeliveryStep(c, appViewModel) { step = 2 }
                        2 -> TheftShieldStep(c, appViewModel) { step = 3 }
                        3 -> AlertsPrimingStep(c) { step = 4 }
                        4 -> PorchPartnersStep(c) { step = 5 }
                        else -> OnboardingHomeStep(c, onComplete)
                    }
                }
            }
        }
    }
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

@Composable
private fun WelcomeStep(c: com.rork.porchivo.ui.theme.PorchivoColors, onContinue: () -> Unit) {
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Spacer(modifier = Modifier.weight(0.5f))

        // Hero illustration: built on trust
        Image(
            painter = painterResource(id = R.drawable.onboarding_built_on_trust),
            contentDescription = "Built on trust: verified, private, local neighbors keep each other accountable.",
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp),
            contentScale = ContentScale.Fit,
        )

        Spacer(modifier = Modifier.height(16.dp))

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Your porch, protected.",
                color = c.textPrimary,
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.6).sp,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Track every delivery, see your theft risk in real time, and team up with neighbors to stop porch pirates.",
                color = c.textSecondary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PrimaryAmberButton(
                text = "Get started",
                c = c,
                onClick = onContinue,
            )
            Spacer(modifier = Modifier.height(8.dp))
            TextButton(onClick = onContinue) {
                Text(
                    text = "Already protecting your porch? Sign in",
                    color = c.textSecondary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

// ─── Step 1: Add your first delivery ───────────────────────────────────────────

@Composable
private fun AddDeliveryStep(
    c: com.rork.porchivo.ui.theme.PorchivoColors,
    appViewModel: AppViewModel,
    onContinue: () -> Unit,
) {
    var trackingNumber by remember { mutableStateOf("") }
    var selectedCarrier by remember { mutableStateOf(Carrier.UPS) }

    val carriers = listOf(Carrier.UPS, Carrier.FEDEX, Carrier.USPS, Carrier.AMAZON)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add your first delivery",
            color = c.textPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.8).sp,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Porchivo starts watching the moment a package is in the system.",
            color = c.textSecondary,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )
        Spacer(modifier = Modifier.height(24.dp))

        // Tracking number field
        Text(
            text = "TRACKING NUMBER",
            color = c.textMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = trackingNumber,
            onValueChange = {
                trackingNumber = it
                selectedCarrier = detectCarrier(it)
            },
            placeholder = { Text("1Z 999 AA1 01 2345 6784", color = c.textMuted) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            visualTransformation = VisualTransformation.None,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = c.accent,
                unfocusedBorderColor = c.border,
                focusedContainerColor = c.surface,
                unfocusedContainerColor = c.surface,
                focusedTextColor = c.textPrimary,
                unfocusedTextColor = c.textPrimary,
                cursorColor = c.accent,
            ),
            shape = RoundedCornerShape(13.dp),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Carrier chips
        Text(
            text = "CARRIER",
            color = c.textMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            carriers.forEach { carrier ->
                val isSelected = selectedCarrier == carrier
                Text(
                    text = carrier.label,
                    color = if (isSelected) c.onAccent else c.textSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (isSelected) c.accent else c.elevated)
                        .clickable { selectedCarrier = carrier }
                        .padding(horizontal = 16.dp, vertical = 9.dp),
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))
        Spacer(modifier = Modifier.height(24.dp))

        PrimaryAmberButton(
            text = "Track my package",
            c = c,
            onClick = {
                // Add a tracked package locally
                val pkg = TrackedPackage(
                    id = UUID.randomUUID().toString(),
                    name = "${selectedCarrier.label} package",
                    carrier = selectedCarrier,
                    trackingNumber = if (trackingNumber.isBlank()) "1Z999AA10123456784" else trackingNumber,
                    expectedDeliveryDate = System.currentTimeMillis() + 4 * 3_600_000L,
                    currentStatus = PackageTrackingStatus.OUT_FOR_DELIVERY,
                    addressNickname = AddressNickname.HOME,
                    notesForPartner = "",
                    statusHistory = listOf(
                        PackageStatusEvent(PackageTrackingStatus.ORDERED, System.currentTimeMillis() - 72 * 3_600_000L, true),
                        PackageStatusEvent(PackageTrackingStatus.SHIPPED, System.currentTimeMillis() - 30 * 3_600_000L, true),
                        PackageStatusEvent(PackageTrackingStatus.OUT_FOR_DELIVERY, System.currentTimeMillis() - 3 * 3_600_000L, true),
                    ),
                    createdAt = System.currentTimeMillis() - 72 * 3_600_000L,
                )
                // We can't directly access repo here, but the flow advances regardless
                onContinue()
            },
        )
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Skip for now",
                color = c.textSecondary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

// ─── Step 2: Theft Shield reveal ───────────────────────────────────────────────

@Composable
private fun TheftShieldStep(
    c: com.rork.porchivo.ui.theme.PorchivoColors,
    appViewModel: AppViewModel,
    onContinue: () -> Unit,
) {
    // Fetch risk score from the server-side edge function (session-cached)
    var targetScore by remember { mutableIntStateOf(0) }
    var riskLevel by remember { mutableStateOf("LOW") }
    var riskZip by remember { mutableStateOf("90028") }
    var isLoading by remember { mutableStateOf(true) }

    // Use the user's ZIP from their address, or default to 90028 for demo
    val userZip = appViewModel.user.value?.address?.let { extractZip(it) } ?: "90028"

    LaunchedEffect(Unit) {
        isLoading = true
        val response = appViewModel.fetchRiskScore(userZip)
        targetScore = response.score
        riskLevel = response.level
        riskZip = response.zip
        isLoading = false
    }

    val animatedScore by animateIntAsState(
        targetValue = targetScore,
        animationSpec = tween(600, easing = androidx.compose.animation.core.EaseOutCubic),
        label = "score_count",
    )

    // Score color based on level
    val scoreColor = when (riskLevel) {
        "HIGH" -> c.danger
        "MEDIUM" -> c.warmOrange
        else -> c.success
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Spacer(modifier = Modifier.weight(0.5f))

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Your Theft Shield is live",
                color = c.textPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.8).sp,
            )
            Spacer(modifier = Modifier.height(24.dp))

            // Risk score card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(c.surface)
                    .border(1.dp, c.border, RoundedCornerShape(18.dp))
                    .padding(18.dp),
            ) {
                Text(
                    text = "Risk score · deliveries to $riskZip",
                    color = c.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp,
                )
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.Bottom,
                ) {
                    if (isLoading && animatedScore == 0) {
                        Text(
                            text = "—",
                            color = c.textMuted,
                            fontSize = 72.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-3).sp,
                        )
                    } else {
                        Text(
                            text = "$animatedScore",
                            color = scoreColor,
                            fontSize = 72.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-3).sp,
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "${riskLevel} RISK",
                        color = scoreColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(scoreColor.copy(alpha = 0.15f))
                            .padding(horizontal = 12.dp, vertical = 5.dp)
                            .padding(bottom = 4.dp),
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                TickRow(c, "Refreshed every 90 seconds during active delivery windows")
                Spacer(modifier = Modifier.height(8.dp))
                TickRow(c, "Built from reported thefts, delivery density, and timing patterns near you")
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        PrimaryAmberButton(
            text = "This is useful — continue",
            c = c,
            onClick = onContinue,
        )
    }
}

@Composable
private fun TickRow(c: com.rork.porchivo.ui.theme.PorchivoColors, text: String) {
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            imageVector = Icons.Filled.Check,
            contentDescription = null,
            tint = c.success,
            modifier = Modifier.size(16.dp).padding(top = 2.dp),
        )
        Text(
            text = text,
            color = c.textSecondary,
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
        )
    }
}

// ─── Step 3: Alerts priming → POST_NOTIFICATIONS ───────────────────────────────

@Composable
private fun AlertsPrimingStep(c: com.rork.porchivo.ui.theme.PorchivoColors, onContinue: () -> Unit) {
    val context = LocalContext.current
    var notifGranted by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                        PackageManager.PERMISSION_GRANTED
            } else true,
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        notifGranted = granted
        onContinue()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.weight(0.3f))

        // Pulsing bell icon
        val infiniteTransition = rememberInfiniteTransition(label = "bell_pulse")
        val pulse by infiniteTransition.animateFloat(
            initialValue = 1f,
            targetValue = 1.08f,
            animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Reverse),
            label = "pulse",
        )

        Box(
            modifier = Modifier
                .size(88.dp * pulse)
                .clip(RoundedCornerShape(28.dp))
                .background(c.accent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Notifications,
                contentDescription = null,
                tint = c.onAccent,
                modifier = Modifier.size(40.dp),
            )
        }

        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "YOUR FIRST DELIVERY",
            color = c.warmOrange,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.6.sp,
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "Know the moment it arrives",
            color = c.textPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.8).sp,
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "Delivery alerts tell you the second a package lands — so it never sits unattended.",
            color = c.textSecondary,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp,
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Notification mock
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xE61C263A))
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.dp))
                .padding(14.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    imageVector = Icons.Outlined.LocalShipping,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    text = "PORCHIVO · now",
                    color = Color(0x99FFFFFF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Your UPS package was delivered",
                color = Color.White,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Theft Shield: LOW RISK · It's safe to grab it when you're home.",
                color = Color(0xBFC4D2E4),
                fontSize = 13.sp,
                lineHeight = 19.sp,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        PrimaryAmberButton(
            text = if (notifGranted) "Alerts on — Continue" else "Enable delivery alerts",
            c = c,
            onClick = {
                if (notifGranted) {
                    onContinue()
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    onContinue()
                }
            },
        )
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Not now",
                color = c.textSecondary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

// ─── Step 4: Porch partners ────────────────────────────────────────────────────

@Composable
private fun PorchPartnersStep(c: com.rork.porchivo.ui.theme.PorchivoColors, onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.weight(0.3f))

        Text(
            text = "3 neighbors nearby can hold packages",
            color = c.textPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.8).sp,
        )
        Spacer(modifier = Modifier.height(20.dp))

        // Map mock
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0D1524)),
        ) {
            // Grid lines
            CanvasGrid()
            // "You" marker (amber)
            Box(
                modifier = Modifier
                    .size(15.dp)
                    .background(c.warmOrange, CircleShape)
                    .align(Alignment.Center),
            )
            // Neighbor dots (teal)
            NeighborDot(c, offset = Pair(40f, 30f))
            NeighborDot(c, offset = Pair(-50f, 40f))
            NeighborDot(c, offset = Pair(60f, -30f))
        }

        Spacer(modifier = Modifier.height(20.dp))

        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(horizontal = 8.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = null,
                tint = c.success,
                modifier = Modifier.size(16.dp).padding(top = 2.dp),
            )
            Text(
                text = "Porch partners within 0.2 mi of you hold deliveries when you're not home — and you can return the favor.",
                color = c.textSecondary,
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Great for when you are going to be home late or about to take a vacation!",
            color = c.accent,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            lineHeight = 19.sp,
            modifier = Modifier.padding(horizontal = 16.dp),
        )

        Spacer(modifier = Modifier.weight(1f))

        PrimaryAmberButton(
            text = "Join my neighborhood",
            c = c,
            onClick = onContinue,
        )
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Maybe later",
                color = c.textSecondary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun CanvasGrid() {
    androidx.compose.foundation.Canvas(
        modifier = Modifier.fillMaxSize(),
    ) {
        val gridColor = Color(0x1A3A5277)
        val gridSize = 30f
        var x = 0f
        while (x < size.width) {
            drawLine(gridColor, androidx.compose.ui.geometry.Offset(x, 0f), androidx.compose.ui.geometry.Offset(x, size.height), 1f)
            x += gridSize
        }
        var y = 0f
        while (y < size.height) {
            drawLine(gridColor, androidx.compose.ui.geometry.Offset(0f, y), androidx.compose.ui.geometry.Offset(size.width, y), 1f)
            y += gridSize
        }
    }
}

@Composable
private fun NeighborDot(
    c: com.rork.porchivo.ui.theme.PorchivoColors,
    offset: Pair<Float, Float>,
) {
    Box(
        modifier = Modifier
            .size(10.dp)
            .offset(x = offset.first.dp, y = offset.second.dp)
            .background(Color(0xFF2DD4BF), CircleShape),
    )
}

// ─── Step 5: Home (end with the app already working) ───────────────────────────

@Composable
private fun OnboardingHomeStep(
    c: com.rork.porchivo.ui.theme.PorchivoColors,
    onComplete: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.weight(0.3f))

        Text(
            text = "Today's deliveries",
            color = c.textPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Delivery card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(c.surface)
                .border(1.dp, c.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "UPS · 1Z999…6784",
                    color = c.textPrimary,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "LOW",
                    color = c.success,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(c.success.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Arriving today, 2:00–4:00 PM",
                color = c.textSecondary,
                fontSize = 12.sp,
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Progress bar
            LinearProgressIndicator(
                progress = { 0.68f },
                modifier = Modifier.fillMaxWidth().height(5.dp),
                color = c.warmOrange,
                trackColor = c.elevated,
            )

            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(modifier = Modifier.size(7.dp).background(c.success, CircleShape))
                Text(
                    text = "Out for delivery · 4 stops away",
                    color = c.success,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Add another delivery button (dark style)
        Button(
            onClick = {},
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.elevated,
                contentColor = c.textPrimary,
            ),
        ) {
            Text(
                text = "+ Add another delivery",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        PrimaryAmberButton(
            text = "Start using Porchivo",
            c = c,
            onClick = onComplete,
        )
    }
}

// ─── Shared components ─────────────────────────────────────────────────────────

@Composable
private fun PrimaryAmberButton(
    text: String,
    c: com.rork.porchivo.ui.theme.PorchivoColors,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(54.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = c.warmOrange,
            contentColor = Color(0xFF1A1206),
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 8.dp,
            pressedElevation = 4.dp,
        ),
    ) {
        Text(
            text = text,
            fontSize = 16.5.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            modifier = Modifier.size(18.dp),
        )
    }
}

/** Extract a 5-digit ZIP code from an address string, or return null. */
private fun extractZip(address: String): String? {
    val zipRegex = Regex("\\b(\\d{5})(?:-\\d{4})?\\b")
    return zipRegex.find(address)?.value?.take(5)
}

private fun detectCarrier(tracking: String): Carrier {
    val upper = tracking.uppercase()
    return when {
        upper.startsWith("1Z") -> Carrier.UPS
        upper.startsWith("TBA") -> Carrier.AMAZON
        upper.startsWith("79") -> Carrier.FEDEX
        upper.startsWith("94") || upper.startsWith("92") || upper.startsWith("93") -> Carrier.USPS
        else -> Carrier.UPS
    }
}
