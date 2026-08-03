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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.model.DeliveryNotification
import com.rork.porchivo.model.NotificationType
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.ShipmentCard
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.NotificationsViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel
import com.rork.porchivo.util.TimeFormat

@Composable
fun ActivityScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
    notificationsViewModel: NotificationsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val activeShipments by shipmentsViewModel.activeShipments.collectAsStateWithLifecycle()
    val completedShipments by shipmentsViewModel.completedShipments.collectAsStateWithLifecycle()
    val notifications by notificationsViewModel.notifications.collectAsStateWithLifecycle()
    val unreadCount by notificationsViewModel.unreadCount.collectAsStateWithLifecycle()

    val isEmpty = activeShipments.isEmpty() && completedShipments.isEmpty() && notifications.isEmpty()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = "Activity",
                color = c.textPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
            )
        }

        if (notifications.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Notifications,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(16.dp),
                    )
                    if (unreadCount > 0) {
                        Text(
                            text = "$unreadCount",
                            color = c.onAccent,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .padding(start = 6.dp)
                                .background(c.danger, CircleShape)
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                        )
                    }
                    Box(modifier = Modifier.weight(1f))
                    if (unreadCount > 0) {
                        TextButton(onClick = { notificationsViewModel.markAllRead() }) {
                            Text(
                                text = "Mark all read",
                                color = c.accent,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
            items(notifications.take(10), key = { it.id }) { notif ->
                NotificationCard(
                    notification = notif,
                    onClick = {
                        notificationsViewModel.markRead(notif.id)
                        navController.navigate(Routes.shipmentDetail(notif.shipmentId))
                    },
                )
            }
        }

        if (activeShipments.isNotEmpty()) {
            item { SectionHeader(title = "In Progress", count = activeShipments.size) }
            items(activeShipments, key = { "active-${it.id}" }) { shipment ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShipmentCard(
                        shipment = shipment,
                        onClick = { navController.navigate(Routes.shipmentDetail(shipment.id)) },
                    )
                    val currentUserId = (AppRepositoryHolder.get().authState.value as? AuthState.Authenticated)?.userId
                    if (shipment.status == ShipmentStatus.ACCEPTED &&
                        shipment.partnerId == currentUserId
                    ) {
                        Button(
                            onClick = { shipmentsViewModel.completeShipment(shipment.id) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = c.success),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Check,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                text = "  Mark as Completed",
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }

        if (completedShipments.isNotEmpty()) {
            item { SectionHeader(title = "Completed", count = completedShipments.size) }
            items(completedShipments, key = { "done-${it.id}" }) { shipment ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShipmentCard(
                        shipment = shipment,
                        onClick = { navController.navigate(Routes.shipmentDetail(shipment.id)) },
                    )
                    val currentUserId2 = (AppRepositoryHolder.get().authState.value as? AuthState.Authenticated)?.userId
                    if (shipment.homeownerId == currentUserId2) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(c.peach, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Favorite,
                                contentDescription = null,
                                tint = c.warmOrange,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                text = "Thank your Porch Partner for keeping your package safe!",
                                color = c.textPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }
        }

        if (isEmpty) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Notifications,
                    title = "No activity yet",
                    body = "When you create or accept shipments, your activity will show up here.",
                    ctaLabel = "Create a Shipment",
                    onCta = { navController.navigate(Routes.CREATE) },
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, count: Int, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            color = c.textPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "$count",
            color = c.textSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun NotificationCard(
    notification: DeliveryNotification,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val (icon, tint, soft) = when (notification.type) {
        NotificationType.PACKAGE_DELIVERED -> Triple(Icons.Outlined.Inventory2, c.success, c.successSoft)
        NotificationType.PARTNER_PICKUP_ALERT -> Triple(Icons.Outlined.Notifications, c.success, c.successSoft)
        NotificationType.TRACKING_ADDED, NotificationType.PACKAGE_OUT_FOR_DELIVERY ->
            Triple(Icons.Outlined.LocalShipping, c.accent, c.skyBlue)
        else -> Triple(Icons.Filled.DoneAll, c.warmOrange, c.peach)
    }

    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.read) c.surface else c.skyBlue,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(soft, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = tint,
                    modifier = Modifier.size(16.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    color = c.textPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = notification.message,
                    color = c.textSecondary,
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = TimeFormat.timeAgo(notification.createdAt),
                    color = c.textMuted,
                    fontSize = 11.sp,
                )
            }
            if (!notification.read) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(c.accent, CircleShape),
                )
            }
        }
    }
}
