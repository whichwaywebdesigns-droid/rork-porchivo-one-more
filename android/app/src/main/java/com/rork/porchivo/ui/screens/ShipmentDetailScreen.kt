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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Handshake
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.ui.components.CarrierIcon
import com.rork.porchivo.ui.components.DeliveryStatusPill
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel
import com.rork.porchivo.util.TimeFormat

@Composable
fun ShipmentDetailScreen(
    navController: NavController,
    shipmentId: String,
    modifier: Modifier = Modifier,
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val shipments by shipmentsViewModel.shipments.collectAsStateWithLifecycle()
    val shipment = remember(shipments, shipmentId) { shipments.firstOrNull { it.id == shipmentId } }

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
                text = "Shipment Details",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        if (shipment == null) {
            Text(
                text = "Shipment not found.",
                color = c.textSecondary,
                modifier = Modifier.padding(24.dp),
            )
            return
        }

        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CarrierIcon(carrier = shipment.carrier, size = 48.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = shipment.packagesExpected,
                                color = c.textPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                text = shipment.carrier.label +
                                    (shipment.trackingNumber?.let { " · #$it" } ?: ""),
                                color = c.textSecondary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        DeliveryStatusPill(status = shipment.deliveryStatus)
                    }
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 12.dp),
                        color = c.border,
                    )
                    DetailRow(
                        icon = Icons.Outlined.Home,
                        label = "Address",
                        value = shipment.addressText,
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    DetailRow(
                        icon = Icons.Outlined.Schedule,
                        label = "Delivery window",
                        value = TimeFormat.window(shipment.deliveryWindowStart, shipment.deliveryWindowEnd),
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    DetailRow(
                        icon = Icons.Outlined.Schedule,
                        label = "Preferred return",
                        value = shipment.preferredReturnTime,
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    DetailRow(
                        icon = Icons.Outlined.Handshake,
                        label = "Porch Partner",
                        value = shipment.partnerName ?: "Awaiting partner",
                    )
                }
            }

            if (shipment.notes.isNotBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = c.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.StickyNote2,
                            contentDescription = null,
                            tint = c.warmOrange,
                            modifier = Modifier.size(18.dp),
                        )
                        Column {
                            Text(
                                text = "NOTES",
                                color = c.textMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = 1.4.sp,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = shipment.notes,
                                color = c.textPrimary,
                                fontSize = 14.sp,
                                lineHeight = 20.sp,
                            )
                        }
                    }
                }
            }

            val currentUserId = (AppRepositoryHolder.get().authState.value as? AuthState.Authenticated)?.userId
            if (shipment.status == ShipmentStatus.ACCEPTED &&
                shipment.partnerId == currentUserId
            ) {
                Button(
                    onClick = {
                        shipmentsViewModel.completeShipment(shipment.id)
                        navController.popBackStack()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = c.success),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "  Mark as Completed",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

@Composable
private fun DetailRow(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = c.accent,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = label,
            color = c.textSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            color = c.textPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
