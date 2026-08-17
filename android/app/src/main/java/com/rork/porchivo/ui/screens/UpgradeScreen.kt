package com.rork.porchivo.ui.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import androidx.core.net.toUri
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.data.RevenueCatService
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import kotlinx.coroutines.launch

private data class PlanOption(
    val plan: RevenueCatService.Plan,
    val name: String,
    val price: String,
    val perMonth: String,
    val description: String,
    val badge: String? = null,
    val isBestValue: Boolean = false,
)

@Composable
fun UpgradeScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tier by appViewModel.tier.collectAsStateWithLifecycle()

    val plans = remember {
        listOf(
            PlanOption(
                plan = RevenueCatService.Plan.MONTHLY,
                name = "Monthly",
                price = AppConfig.Pricing.MONTHLY_DISPLAY,
                perMonth = AppConfig.Pricing.MONTHLY_PER_MONTH,
                description = "Best for trying out Premium",
            ),
            PlanOption(
                plan = RevenueCatService.Plan.ANNUAL,
                name = "Annual",
                price = AppConfig.Pricing.ANNUAL_DISPLAY,
                perMonth = AppConfig.Pricing.ANNUAL_PER_MONTH,
                description = "7-day free trial",
                badge = AppConfig.Pricing.ANNUAL_SAVINGS_LABEL,
                isBestValue = true,
            ),
            PlanOption(
                plan = RevenueCatService.Plan.FAMILY,
                name = "Family",
                price = AppConfig.FamilyPlan.ANNUAL_DISPLAY,
                perMonth = AppConfig.FamilyPlan.ANNUAL_PER_MONTH,
                description = "7-day free trial · Up to ${AppConfig.FamilyPlan.MAX_MEMBERS} members",
                badge = AppConfig.FamilyPlan.ANNUAL_SAVINGS_LABEL,
            ),
            PlanOption(
                plan = RevenueCatService.Plan.LIFETIME,
                name = "Lifetime",
                price = AppConfig.Pricing.LIFETIME_DISPLAY,
                perMonth = "One-time payment",
                description = "Pay once, keep it forever",
            ),
        )
    }

    var selectedPlan by remember { mutableStateOf(RevenueCatService.Plan.ANNUAL) }
    var isPurchasing by remember { mutableStateOf(false) }
    var isRestoring by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = c.textPrimary,
                )
            }
            Text(
                text = "Upgrade",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        if (tier != SubscriptionTier.FREE) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(c.successSoft, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = c.success,
                        modifier = Modifier.size(32.dp),
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "You're on ${tier.label}",
                    color = c.textPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Enjoy unlimited packages, Theft Shield, and all premium features.",
                    color = c.textSecondary,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(24.dp))
                TextButton(onClick = { navController.popBackStack() }) {
                    Text("Back to app", color = c.accent, fontWeight = FontWeight.Bold)
                }
            }
            return@Column
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text(
                text = "Unlock Premium",
                color = c.textPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Unlimited package tracking, Theft Shield, 90-second refresh, and more.",
                color = c.textSecondary,
                fontSize = 14.sp,
                lineHeight = 20.sp,
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            FeatureItem("Unlimited package tracking")
            FeatureItem("Theft Shield — proactive theft alerts")
            FeatureItem("90-second status refresh rate")
            FeatureItem("Priority delivery notifications")
            FeatureItem("Advanced porch risk analytics")
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            plans.forEach { option ->
                PlanCard(
                    option = option,
                    isSelected = selectedPlan == option.plan,
                    onClick = { selectedPlan = option.plan },
                )
            }
        }

        errorMessage?.let { err ->
            if (err != "cancelled") {
                Text(
                    text = err,
                    color = c.danger,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }

        val selectedOption = plans.first { it.plan == selectedPlan }
        val buttonText = when (selectedPlan) {
            RevenueCatService.Plan.LIFETIME -> "Buy — ${selectedOption.price}"
            RevenueCatService.Plan.ANNUAL, RevenueCatService.Plan.FAMILY -> "Start 7-day free trial"
            RevenueCatService.Plan.MONTHLY -> "Subscribe — ${selectedOption.price}/mo"
        }

        Button(
            onClick = {
                if (isPurchasing) return@Button
                errorMessage = null
                isPurchasing = true
                scope.launch {
                    val activity = context.findActivity()
                    if (activity == null) {
                        isPurchasing = false
                        errorMessage = "Unable to process purchase."
                        return@launch
                    }
                    val result = RevenueCatService.purchase(activity, selectedPlan)
                    isPurchasing = false
                    if (result.tier != null) {
                        appViewModel.upgradeTier(result.tier!!)
                        navController.popBackStack()
                    } else if (result.error != null && result.error != "cancelled") {
                        errorMessage = result.error
                    }
                }
            },
            enabled = !isPurchasing,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.accent,
                disabledContainerColor = c.elevated,
            ),
        ) {
            if (isPurchasing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = c.onAccent,
                )
            } else {
                Text(
                    text = buttonText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = c.onAccent,
                )
            }
        }

        TextButton(
            onClick = {
                if (isRestoring) return@TextButton
                errorMessage = null
                isRestoring = true
                scope.launch {
                    val result = RevenueCatService.restorePurchases()
                    isRestoring = false
                    if (result.tier != null) {
                        appViewModel.upgradeTier(result.tier!!)
                        navController.popBackStack()
                    } else if (result.error != null) {
                        errorMessage = result.error
                    }
                }
            },
            enabled = !isRestoring,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isRestoring) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = c.textSecondary,
                )
            } else {
                Text("Restore Purchases", color = c.textSecondary, fontSize = 14.sp)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, AppConfig.Support.PRIVACY_POLICY_URL.toUri()))
            }) {
                Text("Privacy Policy", color = c.textMuted, fontSize = 12.sp)
            }
            Text("·", color = c.textMuted, fontSize = 12.sp)
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, AppConfig.Support.TERMS_URL.toUri()))
            }) {
                Text("Terms of Service", color = c.textMuted, fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun PlanCard(
    option: PlanOption,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val borderColor = if (isSelected) c.accent else c.border

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(c.surface)
            .border(2.dp, borderColor, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .border(2.dp, if (isSelected) c.accent else c.border, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (isSelected) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .background(c.accent, CircleShape),
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = option.name,
                        color = c.textPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    option.badge?.let { badge ->
                        Text(
                            text = badge,
                            color = c.onAccent,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .background(c.warmOrange, RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    if (option.isBestValue) {
                        Text(
                            text = "Best Value",
                            color = c.gold,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .background(c.goldSoft, RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
                Text(
                    text = option.perMonth,
                    color = c.textSecondary,
                    fontSize = 13.sp,
                )
            }

            Text(
                text = option.price,
                color = c.textPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = option.description,
            color = c.textMuted,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun FeatureItem(text: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .background(c.successSoft, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = null,
                tint = c.success,
                modifier = Modifier.size(14.dp),
            )
        }
        Text(
            text = text,
            color = c.textSecondary,
            fontSize = 14.sp,
        )
    }
}

private fun Context.findActivity(): Activity? {
    var ctx: Context? = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}
