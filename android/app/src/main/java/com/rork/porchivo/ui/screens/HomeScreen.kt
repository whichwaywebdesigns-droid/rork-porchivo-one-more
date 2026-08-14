package com.rork.porchivo.ui.screens

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Paid
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.data.MockData
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.ShipmentCard
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import com.rork.porchivo.ui.viewmodel.NotificationsViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel
import com.rork.porchivo.util.RiskEngine
import java.util.Calendar

@Composable
fun HomeScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
    notificationsViewModel: NotificationsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val user by appViewModel.user.collectAsStateWithLifecycle()
    val tier by appViewModel.tier.collectAsStateWithLifecycle()
    val myShipments by shipmentsViewModel.myShipments.collectAsStateWithLifecycle()
    val unreadCount by notificationsViewModel.unreadCount.collectAsStateWithLifecycle()
    val shipmentsLoadState by shipmentsViewModel.shipmentsLoadState.collectAsStateWithLifecycle()

    val isFree = false // HOA-provisioned model — all users have full access
    val riskScore = remember(myShipments) { RiskEngine.score(myShipments) }
    val theftFact = remember {
        val dayOfYear = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        MockData.theftFacts[dayOfYear % MockData.theftFacts.size]
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                text = "Porchivo",
                color = c.textPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
            )
        }

        item { TheftFactCard(fact = theftFact) }

        item {
            PartnerUpsellBanner(onClick = { navController.navigate(Routes.CREATE) })
        }

        if (isFree) {
            item {
                WinbackBanner(onClick = { navController.navigate(Routes.UPGRADE) })
            }
        }

        item {
            TodayRiskCard(
                score = riskScore,
                onClick = { navController.navigate(Routes.SAFETY) },
            )
        }

        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Hello, ${user?.name?.substringBefore(' ') ?: "there"}",
                        color = c.textPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.4).sp,
                    )
                    Text(
                        text = "Your delivery dashboard",
                        color = c.textSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .background(c.accent, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Bolt,
                        contentDescription = null,
                        tint = c.onAccent,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                QuickLink(
                    label = "Alerts",
                    icon = Icons.Outlined.Notifications,
                    tint = c.danger,
                    softTint = c.dangerSoft,
                    badge = unreadCount,
                    onClick = { navController.navigate(Routes.ACTIVITY) },
                )
                QuickLink(
                    label = "Safety",
                    icon = Icons.Outlined.BarChart,
                    tint = c.accent,
                    softTint = c.accentSoft,
                    onClick = { navController.navigate(Routes.SAFETY) },
                )
                QuickLink(
                    label = "Add Package",
                    icon = Icons.Filled.Add,
                    tint = c.success,
                    softTint = c.successSoft,
                    onClick = { navController.navigate(Routes.ADD_PACKAGE) },
                )
                QuickLink(
                    label = "Porch Risk",
                    icon = Icons.Outlined.GppMaybe,
                    tint = c.warmOrange,
                    softTint = c.warmOrangeSoft,
                    onClick = { navController.navigate(Routes.SAFETY) },
                )
            }
        }

        item {
            Text(
                text = "My Shipments",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        if (myShipments.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Shield,
                    title = "No packages yet",
                    body = "Add your first package to start tracking deliveries and scoring porch risk.",
                    ctaLabel = "Add your first package",
                    onCta = { navController.navigate(Routes.ADD_PACKAGE) },
                )
            }
        } else {
            items(myShipments, key = { it.id }) { shipment ->
                ShipmentCard(
                    shipment = shipment,
                    onClick = { navController.navigate(Routes.shipmentDetail(shipment.id)) },
                )
            }
        }
    }
}

@Composable
private fun TheftFactCard(fact: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(c.peach, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = Icons.Outlined.Shield,
            contentDescription = null,
            tint = c.warmOrange,
            modifier = Modifier.size(20.dp),
        )
        Column {
            Text(
                text = "DAILY THEFT FACT",
                color = c.warmOrange,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
            )
            Text(
                text = fact,
                color = c.textPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                lineHeight = 18.sp,
            )
        }
    }
}

@Composable
private fun PartnerUpsellBanner(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .background(c.successSoft, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Paid,
                    contentDescription = null,
                    tint = c.success,
                    modifier = Modifier.size(15.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Earn $80–$250/mo on your schedule",
                    color = c.textPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Hold packages for neighbors · Keep 85% · 2-day payout",
                    color = c.textSecondary,
                    fontSize = 11.sp,
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = c.success,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun WinbackBanner(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.accent),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .background(Color(0x33FFFFFF), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.WorkspacePremium,
                    contentDescription = null,
                    tint = c.onAccent,
                    modifier = Modifier.size(14.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Special offer — ${AppConfig.Pricing.WINBACK_LABEL}",
                    color = c.onAccent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Only ${AppConfig.Pricing.WINBACK_DISPLAY} · Upgrade to protect more",
                    color = Color(0xBFFFFFFF),
                    fontSize = 11.sp,
                )
            }
            Text(
                text = "CLAIM",
                color = c.accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.3.sp,
                modifier = Modifier
                    .background(c.onAccent, RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            )
        }
    }
}

@Composable
private fun TodayRiskCard(score: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val level = RiskEngine.level(score)
    val tint = when (level) {
        RiskEngine.RiskLevel.HIGH -> c.danger
        RiskEngine.RiskLevel.MEDIUM -> c.warmOrange
        RiskEngine.RiskLevel.LOW -> c.success
    }

    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "TODAY'S PORCH RISK",
                    color = c.textMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.4.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = level.label,
                    color = tint,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .background(tint.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = "$score",
                    color = c.textPrimary,
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1.4).sp,
                )
                Text(
                    text = " / 100",
                    color = c.textMuted,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { score / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = tint,
                trackColor = c.elevated,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "View breakdown →",
                color = c.accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun QuickLink(
    label: String,
    icon: ImageVector,
    tint: Color,
    softTint: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: Int = 0,
) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier.width(76.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(softTint, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = tint,
                        modifier = Modifier.size(18.dp),
                    )
                }
                if (badge > 0) {
                    Badge(
                        containerColor = c.danger,
                        modifier = Modifier.align(Alignment.TopEnd),
                    ) {
                        Text(text = if (badge > 9) "9+" else "$badge")
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = label,
                color = c.textSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
        }
    }
}
