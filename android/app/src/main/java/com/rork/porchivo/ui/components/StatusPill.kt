package com.rork.porchivo.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.model.DeliveryStatus
import com.rork.porchivo.model.PackageTrackingStatus
import com.rork.porchivo.ui.theme.PorchivoTheme

/** Small tinted status chip — mirrors the Expo app's StatusPill component. */
@Composable
fun StatusPill(
    label: String,
    tint: Color,
    softTint: Color,
    modifier: Modifier = Modifier,
) {
    Text(
        text = label,
        color = tint,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.2.sp,
        modifier = modifier
            .background(softTint, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

@Composable
fun PackageStatusPill(status: PackageTrackingStatus, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val (tint, soft) = when (status) {
        PackageTrackingStatus.DELIVERED, PackageTrackingStatus.PICKED_UP -> c.success to c.successSoft
        PackageTrackingStatus.OUT_FOR_DELIVERY -> c.warmOrange to c.warmOrangeSoft
        PackageTrackingStatus.SHIPPED -> c.accent to c.accentSoft
        PackageTrackingStatus.RETURNED -> c.danger to c.dangerSoft
        PackageTrackingStatus.ORDERED -> c.textSecondary to c.elevated
    }
    StatusPill(label = status.label, tint = tint, softTint = soft, modifier = modifier)
}

@Composable
fun DeliveryStatusPill(status: DeliveryStatus, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val (tint, soft) = when (status) {
        DeliveryStatus.DELIVERED, DeliveryStatus.DELIVERED_TO_HOMEOWNER -> c.success to c.successSoft
        DeliveryStatus.OUT_FOR_DELIVERY -> c.warmOrange to c.warmOrangeSoft
        DeliveryStatus.IN_TRANSIT -> c.accent to c.accentSoft
        DeliveryStatus.PENDING -> c.textSecondary to c.elevated
    }
    StatusPill(label = status.label, tint = tint, softTint = soft, modifier = modifier)
}
