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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Person3
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Shield
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
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

@Composable
fun MoreScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()

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
        item {
            EmptyState(
                icon = Icons.Outlined.Inventory2,
                title = "No packages tracked",
                body = "Add a package to start tracking deliveries.",
                ctaLabel = "Add package",
                onCta = { navController.navigate(Routes.ADD_PACKAGE) },
            )
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
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.CalendarMonth, tint = c.accent, label = "Calendar") { }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.Build, tint = c.success, label = "Maintenance") { }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.Person3, tint = c.accent, label = "Resident Directory") { }
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
                    LinkRow(icon = Icons.Outlined.Settings, tint = c.textSecondary, label = "Settings") {
                        navController.navigate(Routes.PROFILE)
                    }
                    HorizontalDivider(color = c.border)
                    LinkRow(icon = Icons.Outlined.Shield, tint = c.warmOrange, label = "Safety Score") {
                        navController.navigate(Routes.SAFETY)
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
                        LinkRow(icon = Icons.Outlined.CreditCard, tint = c.gold, label = "Manage Subscription") { }
                        HorizontalDivider(color = c.border)
                        LinkRow(icon = Icons.Outlined.Apartment, tint = c.accent, label = "Invite Code") { }
                        HorizontalDivider(color = c.border)
                        LinkRow(icon = Icons.Outlined.Person3, tint = c.warmOrange, label = "Pending Members") { }
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
