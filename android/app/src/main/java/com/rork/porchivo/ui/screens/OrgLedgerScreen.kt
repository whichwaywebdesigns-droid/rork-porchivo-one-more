package com.rork.porchivo.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.data.dto.DbOrgPayment
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Payments Ledger — Community plan and up, staff only.
 * Lists every org payment (dues, assessments) with collected totals and a
 * one-tap CSV export (system save dialog). Mirrors the Expo `app/org-ledger.tsx`
 * screen against the same `org_payments` table + RLS; the export is built
 * client-side — no schema or edge function needed.
 */
@Composable
fun OrgLedgerScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val payments by appViewModel.orgPayments.collectAsStateWithLifecycle()
    val loadState by appViewModel.orgPaymentsLoadState.collectAsStateWithLifecycle()
    val planTier by appViewModel.orgPlanTier.collectAsStateWithLifecycle()
    val isStaff = appViewModel.isOrgStaff
    val isOrgMember = appViewModel.isOrgMember
    // Plan gate fails open on an unknown tier — RLS still protects the data.
    val planAllowed = planTier == null ||
        planTier in listOf("community", "professional", "enterprise")

    LaunchedEffect(Unit) { appViewModel.loadOrgLedger() }

    // ── Derived stats + CSV (recomputed only when payments change) ─────
    val stats = remember(payments) { ledgerStats(payments) }
    val csvLines = remember(payments) { ledgerCsvLines(payments) }
    var exportError by remember { mutableStateOf<String?>(null) }

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv"),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val ok = runCatching {
            context.contentResolver.openOutputStream(uri)?.use { out ->
                out.write(csvLines.joinToString("\n").toByteArray(Charsets.UTF_8))
            } ?: error("No output stream")
        }.isSuccess
        if (ok) {
            android.widget.Toast.makeText(
                context,
                "Ledger exported — ${payments.size} payments",
                android.widget.Toast.LENGTH_SHORT,
            ).show()
        } else {
            exportError = "Could not save the file — try again."
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(c.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp,
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
                    text = "Payments Ledger",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        when {
            !isOrgMember -> item {
                EmptyState(
                    icon = Icons.Outlined.Receipt,
                    title = "Join a community",
                    body = "The payments ledger tracks your HOA's dues and assessments. Ask your board for an invite to unlock it.",
                )
            }
            !planAllowed -> item {
                EmptyState(
                    icon = Icons.Outlined.Receipt,
                    title = "Community feature",
                    body = "The payments ledger is available on the Community plan and up. Upgrade your community's plan to unlock it.",
                )
            }
            !isStaff -> item {
                EmptyState(
                    icon = Icons.Outlined.Lock,
                    title = "Staff only",
                    body = "The payments ledger is managed by your board and property staff. Your own payment history lives on the Payments tab.",
                )
            }
            loadState is LoadState.Loading -> item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator(color = c.accent) }
            }
            else -> {
                item {
                    // Summary: all-time / this month / paid count
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(c.accent.copy(alpha = 0.06f), RoundedCornerShape(16.dp))
                            .padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatBlock("${money(stats.first)}", "Collected all-time", Modifier.weight(1f))
                        StatDivider()
                        StatBlock("${money(stats.second)}", "This month", Modifier.weight(1f))
                        StatDivider()
                        StatBlock("${stats.third}", "Paid payments", Modifier.weight(1f))
                    }
                }
                item {
                    Button(
                        onClick = {
                            val stamp = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                            exportLauncher.launch("porchivo-ledger-$stamp.csv")
                        },
                        enabled = payments.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(13.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.FileDownload,
                            contentDescription = null,
                            modifier = Modifier.size(17.dp),
                        )
                        Text(
                            text = "Export CSV",
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
                when {
                    loadState is LoadState.Error -> item {
                        EmptyState(
                            icon = Icons.Outlined.Receipt,
                            title = "Could not load",
                            body = (loadState as LoadState.Error).message,
                        )
                    }
                    payments.isEmpty() -> item {
                        EmptyState(
                            icon = Icons.Outlined.Receipt,
                            title = "No payments yet",
                            body = "Dues and assessments will appear here as residents pay.",
                        )
                    }
                    else -> items(payments, key = { it.id }) { payment ->
                        PaymentRow(payment)
                    }
                }
            }
        }
    }

    exportError?.let { message ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { exportError = null },
            title = { Text("Export failed", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text(message, color = c.textSecondary) },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { exportError = null }) {
                    Text("OK", color = c.accent)
                }
            },
            containerColor = c.surface,
        )
    }
}

@Composable
private fun StatBlock(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            color = PorchivoTheme.colors.textPrimary,
            fontSize = 17.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Text(
            text = label,
            color = PorchivoTheme.colors.textMuted,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun StatDivider() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .height(34.dp)
            .background(PorchivoTheme.colors.border),
    )
}

@Composable
private fun PaymentRow(payment: DbOrgPayment, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()) }
    val tone = when (payment.status) {
        "paid" -> c.success
        "pending" -> c.gold
        else -> c.danger
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(c.surface, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .background(tone.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.Receipt,
                contentDescription = null,
                tint = tone,
                modifier = Modifier.size(18.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = payment.member?.name ?: "Unknown resident",
                color = c.textPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = dateFormat.format(parseIsoDate(payment.paidAt ?: payment.createdAt ?: "")),
                color = c.textMuted,
                fontSize = 12.sp,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = money(payment.amountCents),
                color = c.textPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Box(
                modifier = Modifier
                    .background(tone.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(
                    text = payment.status.replaceFirstChar { it.uppercase() },
                    color = tone,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** (all-time paid cents, this-month paid cents, paid count). */
private fun ledgerStats(payments: List<DbOrgPayment>): Triple<Long, Long, Int> {
    val paid = payments.filter { it.status == "paid" }
    val cal = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val monthStart = cal.timeInMillis
    val monthTotal = paid.filter { p ->
        (p.paidAt ?: p.createdAt)?.let { parseIsoDate(it).time >= monthStart } == true
    }.sumOf { it.amountCents }
    return Triple(paid.sumOf { it.amountCents }, monthTotal, paid.size)
}

/** CSV rows — same Date,Member,Amount,Status shape as Expo and the web portal. */
private fun ledgerCsvLines(payments: List<DbOrgPayment>): List<String> {
    val lines = mutableListOf("Date,Member,Amount,Status")
    for (p in payments) {
        lines.add(
            listOf(
                csvField(p.paidAt ?: p.createdAt ?: ""),
                csvField(p.member?.name ?: "Unknown"),
                csvField(money(p.amountCents)),
                csvField(p.status),
            ).joinToString(","),
        )
    }
    return lines
}

/** CSV-escape a field: wrap in quotes, double any inner quotes. */
private fun csvField(value: String): String = "\"${value.replace("\"", "\"\"")}\""

private fun money(cents: Long): String = String.format(Locale.US, "$%.2f", cents / 100.0)
