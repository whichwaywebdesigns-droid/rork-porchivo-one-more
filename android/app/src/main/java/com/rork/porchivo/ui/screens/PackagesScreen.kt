package com.rork.porchivo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.ui.components.CarrierIcon
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.PackageStatusPill
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.PackagesViewModel
import com.rork.porchivo.util.TimeFormat

@Composable
fun PackagesScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    packagesViewModel: PackagesViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val packages by packagesViewModel.packages.collectAsStateWithLifecycle()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
    ) {
        if (packages.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.Center,
            ) {
                EmptyState(
                    icon = Icons.Outlined.Inventory2,
                    title = "No packages yet",
                    body = "Start tracking your deliveries to keep them safe.",
                    ctaLabel = "Add your first package",
                    onCta = { navController.navigate(Routes.ADD_PACKAGE) },
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text(
                        text = "My Packages",
                        color = c.textPrimary,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
                items(packages, key = { it.id }) { pkg ->
                    PackageCard(
                        pkg = pkg,
                        onClick = { navController.navigate(Routes.packageDetail(pkg.id)) },
                    )
                }
            }
        }

        ExtendedFloatingActionButton(
            onClick = { navController.navigate(Routes.ADD_PACKAGE) },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp),
            containerColor = c.accent,
            contentColor = c.onAccent,
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text(text = "Add Package", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        )
    }
}

@Composable
private fun PackageCard(
    pkg: TrackedPackage,
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
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CarrierIcon(carrier = pkg.carrier)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = pkg.name,
                        color = c.textPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "${pkg.carrier.label} · #${pkg.trackingNumber.takeLast(8)}",
                        color = c.textSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                PackageStatusPill(status = pkg.currentStatus)
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp),
                color = c.border,
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "EXPECTED",
                        color = c.textMuted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.sp,
                    )
                    Text(
                        text = TimeFormat.expectedDay(pkg.expectedDeliveryDate),
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Text(
                    text = pkg.customAddressLabel ?: pkg.addressNickname.label,
                    color = c.accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .background(c.skyBlue, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                )
                Icon(
                    imageVector = Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = c.textMuted,
                    modifier = Modifier
                        .padding(start = 8.dp)
                        .size(18.dp),
                )
            }
        }
    }
}
