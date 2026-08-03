package com.rork.porchivo.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Handshake
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.util.TimeFormat

/** Shipment summary card — mirrors the Expo app's ShipmentCard component. */
@Composable
fun ShipmentCard(
    shipment: Shipment,
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
                CarrierIcon(carrier = shipment.carrier)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = shipment.packagesExpected,
                        color = c.textPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "${shipment.carrier.label} · ${shipment.addressText}",
                        color = c.textSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                DeliveryStatusPill(status = shipment.deliveryStatus)
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp),
                color = c.border,
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Schedule,
                    contentDescription = null,
                    tint = c.textMuted,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    text = TimeFormat.window(shipment.deliveryWindowStart, shipment.deliveryWindowEnd),
                    color = c.textSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
                when (shipment.status) {
                    ShipmentStatus.OPEN -> {
                        Text(
                            text = "Awaiting Partner",
                            color = c.accent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    ShipmentStatus.ACCEPTED -> {
                        Icon(
                            imageVector = Icons.Outlined.Handshake,
                            contentDescription = null,
                            tint = c.warmOrange,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = shipment.partnerName ?: "Partner",
                            color = c.warmOrange,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    ShipmentStatus.COMPLETED -> {
                        Icon(
                            imageVector = Icons.Outlined.CheckCircle,
                            contentDescription = null,
                            tint = c.success,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = "Completed",
                            color = c.success,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    ShipmentStatus.CANCELLED -> {
                        Text(
                            text = "Cancelled",
                            color = c.textMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}
