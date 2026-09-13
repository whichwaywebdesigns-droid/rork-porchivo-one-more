package com.rork.porchivo.ui.screens

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Pool
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.ReportProblem
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.ShipmentCard
import com.rork.porchivo.ui.components.rememberPressHaptic
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel

@Composable
fun MoreScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val pressHaptic = rememberPressHaptic()
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()
    val myShipments by shipmentsViewModel.myShipments.collectAsStateWithLifecycle()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                text = "More",
                color = c.textPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
            )
        }
        item {
            Text(
                text = "My Deliveries",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (myShipments.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Inventory2,
                    title = "No packages tracked",
                    body = "Add a package to start tracking deliveries.",
                    ctaLabel = "Add package",
                    onCta = { navController.navigate(Routes.ADD_PACKAGE) },
                )
            }
        } else {
            // Real shipment rows (top 3) — this section used to always show the
            // "No packages tracked" empty state, even with shipments on the way.
            items(myShipments.take(3), key = { it.id }) { shipment ->
                ShipmentCard(
                    shipment = shipment,
                    onClick = { pressHaptic(); navController.navigate(Routes.shipmentDetail(shipment.id)) },
                )
            }
        }
        item {
            Text(
                text = "Community",
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
                    LinkRow(icon = Icons.Outlined.Campaign, tint = c.warmOrange, label = "Announcements") {
                        navController.navigate(Routes.ANNOUNCEMENTS)
                    }
                    if (orgMembership?.isActive == true) {
                        HorizontalDivider(color = c.border)
                        LinkRow(icon = Icons.Outlined.FolderOpen, tint = c.success, label = "Documents") {
                            navController.navigate(Routes.ORG_DOCUMENTS)
                        }
                        HorizontalDivider(color = c.border)
                        LinkRow(icon = Icons.Outlined.Pool, tint = c.accent, label = "Amenities") {
                            navController.navigate(Routes.ORG_AMENITIES)
                        }
                    }
                }
            }
        }
        item {
            Text(
                text = "Account",
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
                    LinkRow(icon = Icons.Outlined.Settings, tint = c.textSecondary, label = "Account & Settings") {
                        navController.navigate(Routes.PROFILE)
                    }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.Shield, tint = c.warmOrange, label = "Safety Score") {
                        navController.navigate(Routes.SAFETY)
                    }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.ReportProblem, tint = c.danger, label = "File an Incident") {
                        navController.navigate(Routes.FILE_INCIDENT)
                    }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.HelpOutline, tint = c.success, label = "Support") {
                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("mailto:${AppConfig.Support.EMAIL}"))
                        navController.context.startActivity(intent)
                    }
                }
            }
        }
        if (orgMembership?.isAdmin == true) {
            item {
                Text(
                    text = "Admin Tools",
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
                        LinkRow(icon = Icons.Outlined.Receipt, tint = c.gold, label = "Payments Ledger") {
                            navController.navigate(Routes.ORG_LEDGER)
                        }
                        HorizontalDivider(color = c.border)
                        LinkRow(icon = Icons.Outlined.People, tint = c.warmOrange, label = "Pending Members") {
                            navController.navigate(Routes.PENDING_MEMBERS)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LinkRow(
    icon: ImageVector,
    tint: androidx.compose.ui.graphics.Color,
    label: String,
    onClick: () -> Unit,
) {
    val c = PorchivoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
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
