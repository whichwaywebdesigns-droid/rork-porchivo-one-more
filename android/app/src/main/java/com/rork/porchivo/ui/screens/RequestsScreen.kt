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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.MaintenanceCategory
import com.rork.porchivo.model.MaintenancePriority
import com.rork.porchivo.model.MaintenanceRequest
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestsScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val requests by appViewModel.maintenanceRequests.collectAsStateWithLifecycle()
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()
    var showNewRequest by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

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
                text = "Requests",
                color = c.textPrimary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
            )
        }
        item {
            Card(
                onClick = { showNewRequest = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(c.accentSoft, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Add,
                            contentDescription = null,
                            tint = c.accent,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Submit a Request",
                            color = c.textPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Maintenance, repairs, or general issues",
                            color = c.textSecondary,
                            fontSize = 12.sp,
                        )
                    }
                    Icon(
                        imageVector = Icons.Outlined.ChevronRight,
                        contentDescription = null,
                        tint = c.textMuted,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
        item {
            Text(
                text = "My Requests",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (requests.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Build,
                    title = "No active requests",
                    body = "Submit a maintenance or service request to your community management.",
                )
            }
        } else {
            items(requests, key = { it.id }) { req ->
                MaintenanceRequestCard(request = req)
            }
        }
    }

    if (showNewRequest) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        var title by remember { mutableStateOf("") }
        var description by remember { mutableStateOf("") }
        var location by remember { mutableStateOf("") }
        var category by remember { mutableStateOf(MaintenanceCategory.OTHER) }
        var priority by remember { mutableStateOf(MaintenancePriority.NORMAL) }

        ModalBottomSheet(
            onDismissRequest = { showNewRequest = false },
            sheetState = sheetState,
            containerColor = c.surface,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    text = "New Request",
                    color = c.textPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    placeholder = { Text("Brief description of the issue") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Location (optional)") },
                    placeholder = { Text("e.g. Kitchen, Unit 2B") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                )
                Text(
                    text = "Category",
                    color = c.textSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                CategoryGrid(
                    selected = category,
                    onSelect = { category = it },
                )
                Text(
                    text = "Priority",
                    color = c.textSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    MaintenancePriority.entries.forEachIndexed { index, p ->
                        SegmentedButton(
                            selected = p == priority,
                            onClick = { priority = p },
                            shape = SegmentedButtonDefaults.itemShape(index, MaintenancePriority.entries.size),
                        ) {
                            Text(p.label, fontSize = 12.sp)
                        }
                    }
                }
                submitError?.let { err ->
                    Text(err, color = c.danger, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = { showNewRequest = false }) {
                        Text("Cancel")
                    }
                    TextButton(
                        onClick = {
                            if (title.isBlank()) return@TextButton
                            scope.launch {
                                isSubmitting = true
                                submitError = null
                                val success = appViewModel.submitMaintenanceRequest(
                                    category = category.name.lowercase(),
                                    priority = priority.name.lowercase(),
                                    title = title.trim(),
                                    description = description.ifBlank { null },
                                    location = location.ifBlank { null },
                                )
                                isSubmitting = false
                                if (success) {
                                    showNewRequest = false
                                } else {
                                    submitError = "Failed to submit request. Please try again."
                                }
                            }
                        },
                        enabled = title.isNotBlank() && !isSubmitting,
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = c.accent,
                            )
                        } else {
                            Text("Submit", fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun CategoryGrid(
    selected: MaintenanceCategory,
    onSelect: (MaintenanceCategory) -> Unit,
) {
    val c = PorchivoTheme.colors
    val categories = MaintenanceCategory.entries
    val half = (categories.size + 1) / 2

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            categories.take(half).forEach { cat ->
                CategoryChip(cat = cat, isSelected = cat == selected, onClick = { onSelect(cat) }, modifier = Modifier.weight(1f))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            categories.drop(half).forEach { cat ->
                CategoryChip(cat = cat, isSelected = cat == selected, onClick = { onSelect(cat) }, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun CategoryChip(
    cat: MaintenanceCategory,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) c.accent else c.elevated,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Text(
            text = cat.label,
            color = if (isSelected) c.onAccent else c.textSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp, horizontal = 6.dp),
        )
    }
}

@Composable
private fun MaintenanceRequestCard(request: MaintenanceRequest, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val dateFormat = remember { SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()) }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(c.accentSoft, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Build,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(16.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = request.title,
                        color = c.textPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                    )
                    Text(
                        text = request.category.label,
                        color = c.textSecondary,
                        fontSize = 12.sp,
                    )
                }
                StatusPill(status = request.status)
            }

            request.description?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, color = c.textSecondary, fontSize = 12.sp, maxLines = 2)
            }

            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(dateFormat.format(Date(request.createdAt)), color = c.textMuted, fontSize = 11.sp)
                if (request.commentCount > 0) {
                    Text("·", color = c.textMuted, fontSize = 11.sp)
                    Text("${request.commentCount} comments", color = c.textMuted, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusPill(status: com.rork.porchivo.model.MaintenanceStatus) {
    val c = PorchivoTheme.colors
    val tint = when (status) {
        com.rork.porchivo.model.MaintenanceStatus.COMPLETED -> c.success
        com.rork.porchivo.model.MaintenanceStatus.CANCELLED -> c.danger
        com.rork.porchivo.model.MaintenanceStatus.IN_PROGRESS -> c.warmOrange
        else -> c.accent
    }
    Text(
        text = status.label,
        color = tint,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .background(tint.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
            .padding(horizontal = 6.dp, vertical = 3.dp),
    )
}
