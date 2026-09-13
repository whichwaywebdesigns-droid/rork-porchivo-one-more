package com.rork.porchivo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.rork.porchivo.data.dto.DbPendingMember
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.components.rememberPressHaptic
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * Pending Members — admin tool to review and approve/deny resident join
 * requests. Backed by the security-definer RPCs `get_pending_members`,
 * `approve_org_membership`, and `deny_org_membership` (admin/staff enforced
 * server-side). Mirrors the iOS PendingMembersScreen.
 */
@Composable
fun PendingMembersScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val scope = rememberCoroutineScope()
    val haptic = rememberPressHaptic()
    val isOrgAdmin = appViewModel.isOrgAdmin
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()
    val orgId = orgMembership?.orgId

    var members by remember { mutableStateOf<List<DbPendingMember>?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var processingId by remember { mutableStateOf<String?>(null) }
    var memberToDeny by remember { mutableStateOf<DbPendingMember?>(null) }
    var memberToApprove by remember { mutableStateOf<DbPendingMember?>(null) }
    var actionError by remember { mutableStateOf<String?>(null) }

    fun load() {
        val id = orgId
        if (id == null) {
            loadError = "You're not part of a community yet."
            members = emptyList()
            return
        }
        loadError = null
        members = null
        scope.launch {
            appViewModel.fetchPendingMembers(id)
                .onSuccess { members = it }
                .onFailure { err ->
                    loadError = err.message?.takeIf { it.isNotBlank() }
                        ?: "Something went wrong. Please try again."
                    members = emptyList()
                }
        }
    }

    fun decide(member: DbPendingMember, approve: Boolean) {
        val id = orgId ?: return
        processingId = member.membershipId
        scope.launch {
            val result = if (approve) {
                appViewModel.approvePendingMember(member.membershipId, id)
            } else {
                appViewModel.denyPendingMember(member.membershipId, id)
            }
            if (result.isSuccess) {
                members = members?.filterNot { it.membershipId == member.membershipId }
                if (approve) haptic()
            } else {
                actionError = result.exceptionOrNull()?.message?.takeIf { it.isNotBlank() }
                    ?: "Something went wrong. Please try again."
            }
            processingId = null
        }
    }

    LaunchedEffect(orgId) {
        if (orgId != null) {
            load()
        } else if (isOrgAdmin) {
            loadError = "You're not part of a community yet."
            members = emptyList()
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
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
                    text = "Pending Members",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        when {
            !isOrgAdmin -> item {
                EmptyState(
                    icon = Icons.Outlined.Lock,
                    title = "Admins only",
                    body = "Member approvals are available to community admins and staff.",
                )
            }
            members == null && loadError == null -> item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = c.accent)
                }
            }
            loadError != null -> item {
                EmptyState(
                    icon = Icons.Outlined.WifiOff,
                    title = "Couldn't load requests",
                    body = loadError.orEmpty(),
                    ctaLabel = "Try again",
                    onCta = { load() },
                )
            }
            members.orEmpty().isEmpty() -> item {
                EmptyState(
                    icon = Icons.Outlined.People,
                    title = "No pending requests",
                    body = "When residents join with your invite code they appear here for approval.",
                )
            }
            else -> {
                item {
                    Text(
                        text = "${members.orEmpty().size} waiting for approval",
                        color = c.textMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                items(members.orEmpty(), key = { it.membershipId }) { member ->
                    PendingMemberCard(
                        member = member,
                        isProcessing = processingId == member.membershipId,
                        busy = processingId != null,
                        onDeny = { memberToDeny = member },
                        onApprove = { memberToApprove = member },
                    )
                }
            }
        }
    }

    memberToDeny?.let { target ->
        AlertDialog(
            onDismissRequest = { memberToDeny = null },
            containerColor = c.surface,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
            title = { Text("Deny request?") },
            text = { Text("Deny ${target.displayName}'s request to join your community?") },
            confirmButton = {
                TextButton(onClick = {
                    memberToDeny = null
                    decide(target, approve = false)
                }) {
                    Text("Deny", color = c.danger, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { memberToDeny = null }) {
                    Text("Cancel")
                }
            },
        )
    }

    memberToApprove?.let { target ->
        AlertDialog(
            onDismissRequest = { memberToApprove = null },
            containerColor = c.surface,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
            title = { Text("Approve request?") },
            text = { Text("Approve ${target.displayName}'s request to join your community?") },
            confirmButton = {
                TextButton(onClick = {
                    memberToApprove = null
                    decide(target, approve = true)
                }) {
                    Text("Approve", color = c.success, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { memberToApprove = null }) {
                    Text("Cancel")
                }
            },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { actionError = null },
            containerColor = c.surface,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { actionError = null }) {
                    Text("OK", color = c.accent)
                }
            },
        )
    }
}

@Composable
private fun PendingMemberCard(
    member: DbPendingMember,
    isProcessing: Boolean,
    busy: Boolean,
    onDeny: () -> Unit,
    onApprove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(c.accentSoft, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initialsOf(member.displayName),
                        color = c.accent,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = member.displayName,
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        member.unitNumber?.takeIf { it.isNotBlank() }?.let {
                            Text(
                                text = "Unit $it",
                                color = c.textSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        pendingDateLabel(member.createdAt)?.let {
                            Text(text = it, color = c.textMuted, fontSize = 11.sp)
                        }
                    }
                }
            }
            member.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                Text(
                    text = notes,
                    color = c.textSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
            Row(
                modifier = Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Button(
                    onClick = onDeny,
                    enabled = !busy,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = c.dangerSoft,
                        contentColor = c.danger,
                    ),
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Deny", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = onApprove,
                    enabled = !busy,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = c.success,
                        contentColor = c.onAccent,
                    ),
                    modifier = Modifier.weight(1f),
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            color = c.onAccent,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp),
                        )
                    } else {
                        Text("Approve", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

private fun initialsOf(name: String): String =
    name.split(" ")
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .joinToString("")
        .ifEmpty { "?" }

private fun pendingDateLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return runCatching {
        // SimpleDateFormat stops at the fractional/zone suffix, so trimming is enough.
        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .parse(iso.substringBefore('.').trimEnd('Z'))
        parsed?.let { SimpleDateFormat("MMM d", Locale.US).format(it) }
    }.getOrNull()
}
