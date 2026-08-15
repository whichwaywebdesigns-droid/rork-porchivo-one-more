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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.BackHand
import androidx.compose.material.icons.outlined.Paid
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.ShipmentCard
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel

@Composable
fun PorchPartnerScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val myShipments by shipmentsViewModel.myShipments.collectAsStateWithLifecycle()

    val activeHolds = myShipments.filter { it.status == ShipmentStatus.ACCEPTED }

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
                text = "Porch Partner",
                color = c.textPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
            )
        }
        item {
            Text(
                text = "Earn by helping neighbors",
                color = c.textSecondary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        item {
            EarningsCard()
        }
        item {
            Text(
                text = "Active Holds",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (activeHolds.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.BackHand,
                    title = "No active holds",
                    body = "When you accept a package hold request, it will appear here.",
                    ctaLabel = "Browse open requests",
                    onCta = { navController.navigate(Routes.CREATE) },
                )
            }
        } else {
            items(activeHolds, key = { it.id }) { shipment ->
                ShipmentCard(
                    shipment = shipment,
                    onClick = { navController.navigate(Routes.shipmentDetail(shipment.id)) },
                )
            }
        }
        item {
            Text(
                text = "Quick Actions",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Column {
                    ActionRow(icon = Icons.Outlined.LocationOn, tint = c.accent, label = "Find nearby requests") {
                        navController.navigate(Routes.CREATE)
                    }
                    Spacer(modifier = Modifier.height(0.dp))
                    ActionRow(icon = Icons.Outlined.Paid, tint = c.success, label = "My earnings") {
                        navController.navigate(Routes.CREATE)
                    }
                    Spacer(modifier = Modifier.height(0.dp))
                    ActionRow(icon = Icons.Outlined.VerifiedUser, tint = c.warmOrange, label = "Get verified") {
                        navController.navigate(Routes.CREATE)
                    }
                }
            }
        }
    }
}

@Composable
private fun EarningsCard() {
    val c = PorchivoTheme.colors
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(c.successSoft, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Paid,
                    contentDescription = null,
                    tint = c.success,
                    modifier = Modifier.size(22.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Potential: $80–$250/mo",
                    color = c.textPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    text = "Hold packages for neighbors · Keep 85% · 2-day payout",
                    color = c.textSecondary,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun ActionRow(
    icon: ImageVector,
    tint: androidx.compose.ui.graphics.Color,
    label: String,
    onClick: () -> Unit,
) {
    val c = PorchivoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = label,
            color = c.textPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = c.textMuted,
            modifier = Modifier.size(18.dp),
        )
    }
}
