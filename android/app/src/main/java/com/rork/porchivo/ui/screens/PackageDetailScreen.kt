package com.rork.porchivo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.draw.clip
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.PhotoCamera
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil3.compose.AsyncImage
import com.rork.porchivo.model.PackageTrackingStatus
import com.rork.porchivo.ui.components.CarrierIcon
import com.rork.porchivo.ui.components.PackageStatusPill
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.PackagesViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel
import com.rork.porchivo.util.TimeFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun PackageDetailScreen(
    navController: NavController,
    packageId: String,
    modifier: Modifier = Modifier,
    packagesViewModel: PackagesViewModel = viewModel(),
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val packages by packagesViewModel.packages.collectAsStateWithLifecycle()
    val shipments by shipmentsViewModel.shipments.collectAsStateWithLifecycle()
    val pkg = remember(packages, packageId) { packages.firstOrNull { it.id == packageId } }
    val timestampFormat = remember { SimpleDateFormat("MMM d, h:mm a", Locale.US) }
    var showFullPhoto by remember { mutableStateOf(false) }

    val deliveryPhotoUrl = remember(pkg, shipments) {
        val trackingNumber = pkg?.trackingNumber
        if (trackingNumber.isNullOrBlank() || pkg?.currentStatus != PackageTrackingStatus.DELIVERED) {
            null
        } else {
            shipments.firstOrNull {
                it.trackingNumber == trackingNumber && !it.completionPhotoUrl.isNullOrBlank()
            }?.completionPhotoUrl
        }
    }

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
                text = "Package Details",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        if (pkg == null) {
            Text(
                text = "Package not found.",
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
                        CarrierIcon(carrier = pkg.carrier, size = 48.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = pkg.name,
                                color = c.textPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                text = "${pkg.carrier.label} · #${pkg.trackingNumber}",
                                color = c.textSecondary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        PackageStatusPill(status = pkg.currentStatus)
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row {
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
                        Column {
                            Text(
                                text = "DELIVER TO",
                                color = c.textMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                letterSpacing = 0.5.sp,
                            )
                            Text(
                                text = pkg.customAddressLabel ?: pkg.addressNickname.label,
                                color = c.textPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "TRACKING TIMELINE",
                        color = c.textMuted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.4.sp,
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    pkg.statusHistory.forEachIndexed { index, event ->
                        Row(verticalAlignment = Alignment.Top) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier
                                        .size(22.dp)
                                        .background(
                                            if (event.completed) c.success else c.elevated,
                                            CircleShape,
                                        ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (event.completed) {
                                        Icon(
                                            imageVector = Icons.Filled.Check,
                                            contentDescription = null,
                                            tint = c.onAccent,
                                            modifier = Modifier.size(12.dp),
                                        )
                                    }
                                }
                                if (index < pkg.statusHistory.lastIndex) {
                                    Box(
                                        modifier = Modifier
                                            .width(2.dp)
                                            .height(28.dp)
                                            .background(
                                                if (event.completed) c.success else c.border,
                                            ),
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.padding(top = 2.dp)) {
                                Text(
                                    text = event.status.label,
                                    color = if (event.completed) c.textPrimary else c.textMuted,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                if (event.timestamp != null) {
                                    Text(
                                        text = timestampFormat.format(Date(event.timestamp)),
                                        color = c.textSecondary,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            deliveryPhotoUrl?.let { photoUrl ->
                DeliveryConfirmationCard(
                    photoUrl = photoUrl,
                    onClick = { showFullPhoto = true },
                )
            }

            if (pkg.notesForPartner.isNotBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = c.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "NOTES FOR PARTNER",
                            color = c.textMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.4.sp,
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = pkg.notesForPartner,
                            color = c.textPrimary,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }
    }

    if (showFullPhoto && deliveryPhotoUrl != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showFullPhoto = false },
            modifier = Modifier.fillMaxSize().padding(0.dp),
            containerColor = androidx.compose.ui.graphics.Color.Black,
            confirmButton = {},
            dismissButton = {},
            text = {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    AsyncImage(
                        model = deliveryPhotoUrl,
                        contentDescription = "Delivery confirmation photo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize().clickable { showFullPhoto = false },
                    )
                    androidx.compose.material3.TextButton(
                        onClick = { showFullPhoto = false },
                        modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                    ) {
                        Text(text = "Close", color = androidx.compose.ui.graphics.Color.White)
                    }
                }
            },
        )
    }
}

@Composable
private fun DeliveryConfirmationCard(
    photoUrl: String,
    onClick: () -> Unit,
) {
    val c = PorchivoTheme.colors
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.PhotoCamera,
                    contentDescription = null,
                    tint = c.success,
                    modifier = Modifier.size(18.dp),
                )
                Column {
                    Text(
                        text = "Delivery Confirmation Photo",
                        color = c.textPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Your Porch Partner captured this photo when marking the delivery complete.",
                        color = c.textMuted,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            AsyncImage(
                model = photoUrl,
                contentDescription = "Delivery confirmation photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onClick),
            )
        }
    }
}
