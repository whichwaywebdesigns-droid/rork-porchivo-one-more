package com.rork.porchivo.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.data.dto.DbOrgDocument
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * Document Library — org-scoped (every community plan, Starter and up).
 * All active members browse; staff add external links or upload photos to the
 * private `org-documents` bucket and remove entries. Mirrors the Expo
 * `app/org-documents.tsx` screen against the same tables/RLS/storage bucket.
 */
@Composable
fun OrgDocumentsScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val documents by appViewModel.orgDocuments.collectAsStateWithLifecycle()
    val loadState by appViewModel.orgDocumentsLoadState.collectAsStateWithLifecycle()
    val isStaff = appViewModel.isOrgStaff
    val isOrgMember = appViewModel.isOrgMember

    var addOpen by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<DbOrgDocument?>(null) }
    var openError by remember { mutableStateOf<String?>(null) }
    var uploading by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { appViewModel.loadOrgDocuments() }

    // Photo picker → read bytes → upload to the org's bucket folder.
    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploading = true
            try {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                if (bytes == null) {
                    openError = "Could not read the selected file."
                    return@launch
                }
                if (bytes.size > 25 * 1024 * 1024) {
                    openError = "File is too large — the limit is 25 MB."
                    return@launch
                }
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                val ext = when (mime) {
                    "image/png" -> "png"
                    "image/webp" -> "webp"
                    "image/heic" -> "heic"
                    "application/pdf" -> "pdf"
                    "text/plain" -> "txt"
                    "text/csv" -> "csv"
                    else -> "jpg"
                }
                val name = "Photo ${SimpleDateFormat("MMM d", Locale.US).format(Date())}"
                val result = appViewModel.uploadOrgDocument(name, bytes, ext, mime, bytes.size.toLong())
                if (result.isFailure) {
                    openError = result.exceptionOrNull()?.message ?: "Upload failed — try again."
                }
            } finally {
                uploading = false
            }
        }
    }

    fun openDocument(doc: DbOrgDocument) {
        val external = doc.externalUrl
        if (!external.isNullOrBlank()) {
            runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(external)))
            }
            return
        }
        val path = doc.filePath ?: return
        scope.launch {
            val result = appViewModel.openOrgDocument(path)
            result.onSuccess { url ->
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            }.onFailure { openError = "The link expired — try again." }
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(10.dp),
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
                    text = "Document Library",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                if (isStaff) {
                    IconButton(onClick = { addOpen = true }) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "Add document",
                            tint = c.accent,
                        )
                    }
                }
            }
        }

        when {
            !isOrgMember -> item {
                EmptyState(
                    icon = Icons.Outlined.FolderOpen,
                    title = "Join a community",
                    body = "The document library holds your HOA's bylaws, budgets, and notices. Ask your board for an invite to unlock it.",
                )
            }
            loadState is LoadState.Loading -> item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator(color = c.accent) }
            }
            documents.isEmpty() -> item {
                EmptyState(
                    icon = Icons.Outlined.FolderOpen,
                    title = "No documents yet",
                    body = if (isStaff) {
                        "Add your bylaws, budgets, meeting minutes, and community notices."
                    } else {
                        "Your board will post bylaws, budgets, and notices here."
                    },
                )
            }
            else -> items(documents, key = { it.id }) { doc ->
                DocumentCard(
                    doc = doc,
                    isStaff = isStaff,
                    onOpen = { openDocument(doc) },
                    onDelete = { pendingDelete = doc },
                )
            }
        }
    }

    // ── Add document sheet (staff) ─────────────────────────────────────
    if (addOpen) {
        var name by remember { mutableStateOf("") }
        var url by remember { mutableStateOf("") }
        var addError by remember { mutableStateOf<String?>(null) }
        var adding by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!adding) addOpen = false },
            title = { Text("Add Document", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Document name (e.g. 2026 Budget)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = url,
                        onValueChange = { url = it },
                        label = { Text("Link (https://…)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    TextButton(
                        onClick = { photoPicker.launch("image/*") },
                        enabled = !uploading,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Image,
                            contentDescription = null,
                            tint = c.accent,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(modifier = Modifier.size(6.dp))
                        Text(
                            text = if (uploading) "Uploading…" else "Upload a photo instead",
                            color = c.accent,
                        )
                    }
                    addError?.let {
                        Text(text = it, color = c.danger, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val trimmedUrl = url.trim()
                        if (!trimmedUrl.startsWith("http://", ignoreCase = true) &&
                            !trimmedUrl.startsWith("https://", ignoreCase = true)
                        ) {
                            addError = "Link must start with http:// or https://"
                            return@TextButton
                        }
                        adding = true
                        scope.launch {
                            val result = appViewModel.addOrgDocumentLink(name.trim(), trimmedUrl)
                            adding = false
                            if (result.isSuccess) {
                                addOpen = false
                            } else {
                                addError = result.exceptionOrNull()?.message ?: "Could not add document"
                            }
                        }
                    },
                    enabled = name.isNotBlank() && url.isNotBlank() && !adding,
                ) { Text(if (adding) "Adding…" else "Add Link", color = c.accent) }
            },
            dismissButton = {
                TextButton(onClick = { addOpen = false }, enabled = !adding) {
                    Text("Cancel", color = c.textSecondary)
                }
            },
            containerColor = c.surface,
        )
    }

    // ── Delete confirmation (staff) ────────────────────────────────────
    pendingDelete?.let { doc ->
        var removing by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!removing) pendingDelete = null },
            title = { Text("Remove document", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Remove \"${doc.name}\" from the library?", color = c.textSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        removing = true
                        scope.launch {
                            appViewModel.removeOrgDocument(doc.id, doc.filePath)
                            removing = false
                            pendingDelete = null
                        }
                    },
                ) { Text("Remove", color = c.danger) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }, enabled = !removing) {
                    Text("Cancel", color = c.textSecondary)
                }
            },
            containerColor = c.surface,
        )
    }

    // ── Open/upload error ──────────────────────────────────────────────
    openError?.let { message ->
        AlertDialog(
            onDismissRequest = { openError = null },
            title = { Text("Could not open document", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text(message, color = c.textSecondary) },
            confirmButton = {
                TextButton(onClick = { openError = null }) { Text("OK", color = c.accent) }
            },
            containerColor = c.surface,
        )
    }
}

@Composable
private fun DocumentCard(
    doc: DbOrgDocument,
    isStaff: Boolean,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()) }
    val icon: ImageVector = if (doc.externalUrl != null) Icons.Outlined.Link else Icons.Outlined.Description

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(c.surface, RoundedCornerShape(14.dp))
            .clickable(onClick = onOpen)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .background(c.successSoft, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = c.success, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = doc.name,
                color = c.textPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
            val meta = buildString {
                append(if (doc.externalUrl != null) "External link" else "File")
                doc.createdAt?.let {
                    append(" · ")
                    append(dateFormat.format(parseIsoDate(it)))
                }
            }
            Text(text = meta, color = c.textMuted, fontSize = 12.sp)
        }
        if (isStaff) {
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Outlined.Delete,
                    contentDescription = "Remove",
                    tint = c.danger,
                )
            }
        } else {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                contentDescription = null,
                tint = c.textMuted,
                modifier = Modifier.size(15.dp),
            )
        }
    }
}

/** Parses PostgREST timestamps ("2026-09-03T10:00:00+00:00") on any API level. */
internal fun parseIsoDate(value: String): Date {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    val parsed = format.parse(value, java.text.ParsePosition(0))
    return parsed ?: Date()
}
