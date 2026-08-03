package com.rork.porchivo.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

private enum class Plan { MONTHLY, ANNUAL, FAMILY }

/** Paywall — mirrors the Expo app's upgrade screen and PRICING config. */
@Composable
fun UpgradeScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    var selectedPlan by remember { mutableStateOf(Plan.ANNUAL) }

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
        }

        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                imageVector = Icons.Filled.WorkspacePremium,
                contentDescription = null,
                tint = c.gold,
                modifier = Modifier.size(44.dp),
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Protect every delivery",
                color = c.textPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.8).sp,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "${AppConfig.SocialProof.PACKAGES_STOLEN_STAT} packages are stolen every year. " +
                    "Don't let yours be one of them.",
                color = c.textSecondary,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp,
            )

            Spacer(modifier = Modifier.height(20.dp))

            listOf(
                "Unlimited package tracking",
                "Theft Shield protection",
                "90-second live refresh",
                "Custom delivery chimes",
                "Priority Porch Partner matching",
            ).forEach { feature ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = c.success,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = feature,
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            PlanCard(
                title = "Annual",
                price = "${AppConfig.Pricing.ANNUAL_DISPLAY}/yr",
                subtitle = "${AppConfig.Pricing.ANNUAL_PER_MONTH} · ${AppConfig.Pricing.ANNUAL_TRIAL_DAYS}-day free trial",
                badge = AppConfig.Pricing.ANNUAL_SAVINGS_LABEL,
                selected = selectedPlan == Plan.ANNUAL,
                onClick = { selectedPlan = Plan.ANNUAL },
            )
            Spacer(modifier = Modifier.height(10.dp))
            PlanCard(
                title = "Monthly",
                price = "${AppConfig.Pricing.MONTHLY_DISPLAY}/mo",
                subtitle = "No trial · cancel anytime",
                badge = null,
                selected = selectedPlan == Plan.MONTHLY,
                onClick = { selectedPlan = Plan.MONTHLY },
            )
            Spacer(modifier = Modifier.height(10.dp))
            PlanCard(
                title = "Family",
                price = "${AppConfig.FamilyPlan.ANNUAL_DISPLAY}/yr",
                subtitle = "Up to ${AppConfig.FamilyPlan.MAX_MEMBERS} members · ${AppConfig.FamilyPlan.ANNUAL_PER_MONTH}",
                badge = AppConfig.FamilyPlan.ANNUAL_SAVINGS_LABEL,
                selected = selectedPlan == Plan.FAMILY,
                onClick = { selectedPlan = Plan.FAMILY },
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    appViewModel.upgradeTier(
                        if (selectedPlan == Plan.FAMILY) SubscriptionTier.FAMILY else SubscriptionTier.PREMIUM,
                    )
                    navController.popBackStack()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = c.accent),
            ) {
                Text(
                    text = when (selectedPlan) {
                        Plan.ANNUAL -> "Start ${AppConfig.Pricing.ANNUAL_TRIAL_DAYS}-Day Free Trial"
                        Plan.MONTHLY -> "Subscribe for ${AppConfig.Pricing.MONTHLY_DISPLAY}/mo"
                        Plan.FAMILY -> "Start Family Plan"
                    },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Billed through Google Play. Auto-renews unless canceled at least 24 hours before the period ends.",
                color = c.textMuted,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                lineHeight = 15.sp,
            )
            Spacer(modifier = Modifier.height(28.dp))
        }
    }
}

@Composable
private fun PlanCard(
    title: String,
    price: String,
    subtitle: String,
    badge: String?,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = if (selected) BorderStroke(2.dp, c.accent) else BorderStroke(1.dp, c.border),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = title,
                        color = c.textPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    if (badge != null) {
                        Text(
                            text = badge,
                            color = c.success,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .background(c.successSoft, RoundedCornerShape(6.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                Text(
                    text = subtitle,
                    color = c.textSecondary,
                    fontSize = 12.sp,
                )
            }
            Text(
                text = price,
                color = if (selected) c.accent else c.textPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
    }
}
