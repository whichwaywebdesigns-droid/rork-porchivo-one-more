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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.Announcement
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun AnnouncementsScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val announcements by appViewModel.announcements.collectAsStateWithLifecycle()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = c.textPrimary,
                    )
                }
                Text(
                    text = "Announcements",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        if (announcements.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Campaign,
                    title = "No announcements",
                    body = "Community announcements from your HOA or property management will appear here.",
                )
            }
        } else {
            items(announcements, key = { it.id }) { item ->
                AnnouncementCard(item = item)
            }
        }
    }
}

@Composable
private fun AnnouncementCard(item: Announcement, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val dateFormat = remember { SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(c.surface, RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (item.isPinned) {
                Text(
                    text = "📌",
                    fontSize = 12.sp,
                )
            }
            Text(
                text = item.title,
                color = c.textPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
                maxLines = 2,
            )
            PriorityPill(priority = item.priority)
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = item.body,
            color = c.textSecondary,
            fontSize = 13.sp,
            maxLines = 4,
        )

        Spacer(modifier = Modifier.height(6.dp))

        val authorText = item.authorDisplayName?.takeIf { it.isNotBlank() }
        val dateText = dateFormat.format(Date(item.createdAt))
        val metaText = if (authorText != null) "$authorText · $dateText" else dateText
        Text(
            text = metaText,
            color = c.textMuted,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun PriorityPill(priority: com.rork.porchivo.model.AnnouncementPriority) {
    val c = PorchivoTheme.colors
    val tint = when (priority) {
        com.rork.porchivo.model.AnnouncementPriority.URGENT -> c.danger
        com.rork.porchivo.model.AnnouncementPriority.HIGH -> c.warmOrange
        com.rork.porchivo.model.AnnouncementPriority.NORMAL -> c.accent
        com.rork.porchivo.model.AnnouncementPriority.LOW -> c.textMuted
    }
    Text(
        text = priority.label,
        color = tint,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .background(tint.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
            .padding(horizontal = 6.dp, vertical = 3.dp),
    )
}
