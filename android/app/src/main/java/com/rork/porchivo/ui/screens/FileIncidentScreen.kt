package com.rork.porchivo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.IncidentKind
import com.rork.porchivo.model.IncidentSeverity
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import kotlinx.coroutines.launch
import kotlin.math.round

/**
 * File a community incident — type grid, severity, details, and optional
 * estimated item value (feeds theft-report follow-ups).
 * Mirrors the Expo app's file-incident screen.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FileIncidentScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val scope = rememberCoroutineScope()

    var kind by remember { mutableStateOf<IncidentKind?>(null) }
    var severity by remember { mutableStateOf(IncidentSeverity.MEDIUM) }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var unitNumber by remember { mutableStateOf("") }
    var valueText by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var showSuccess by remember { mutableStateOf(false) }
    var showError by remember { mutableStateOf(false) }

    val showValueField = kind?.isCarrierAction == true
    val canSubmit = kind != null && title.isNotBlank() && !isSubmitting

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.accent,
        unfocusedBorderColor = c.border,
        focusedContainerColor = c.surface,
        unfocusedContainerColor = c.surface,
        focusedTextColor = c.textPrimary,
        unfocusedTextColor = c.textPrimary,
        cursorColor = c.accent,
    )

    if (showSuccess) {
        AlertDialog(
            onDismissRequest = { showSuccess = false },
            title = { Text("Incident Filed", fontWeight = FontWeight.Bold) },
            text = { Text("Your report is in the queue. Community staff will review it shortly.") },
            confirmButton = {
                TextButton(onClick = {
                    showSuccess = false
                    navController.popBackStack()
                }) {
                    Text("Done", color = c.accent, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = c.surface,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
        )
    }

    if (showError) {
        AlertDialog(
            onDismissRequest = { showError = false },
            title = { Text("Error", fontWeight = FontWeight.Bold) },
            text = { Text("Could not file incident. Please check your connection and try again.") },
            confirmButton = {
                TextButton(onClick = { showError = false }) {
                    Text("OK", color = c.accent, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = c.surface,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
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
                text = "File Incident",
                color = c.textPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        IncidentSectionLabel("What happened?", required = true)
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            maxItemsInEachRow = 3,
        ) {
            IncidentKind.entries.forEach { option ->
                val selected = kind == option
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (selected) c.accentSoft else c.surface)
                        .border(
                            width = 1.dp,
                            color = if (selected) c.accent else c.border,
                            shape = RoundedCornerShape(14.dp),
                        )
                        .clickable {
                            kind = option
                            if (title.isBlank()) title = option.defaultTitle
                        }
                        .padding(vertical = 12.dp, horizontal = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(text = option.emoji, fontSize = 22.sp)
                    Text(
                        text = option.label,
                        color = if (selected) c.accent else c.textSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        lineHeight = 14.sp,
                    )
                }
            }
        }

        if (kind?.isCarrierAction == true) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp)
                    .background(c.accentSoft, RoundedCornerShape(12.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.LocalShipping,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(20.dp),
                )
                Column {
                    Text(
                        text = "Contact the carrier first",
                        color = c.textPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "For a missing, lost, or damaged package, contact the carrier handling your shipment (Amazon, UPS, USPS, FedEx, etc.) — they hold your package and are responsible for resolving delivery issues, refunds, and claims. Porchivo provides tracking only; we have no relationship with any carrier and aren't responsible for your package.",
                        color = c.textSecondary,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                }
            }
        }

        IncidentSectionLabel("How serious is this?")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IncidentSeverity.entries.forEach { option ->
                val selected = severity == option
                val tint = when (option) {
                    IncidentSeverity.LOW -> c.success
                    IncidentSeverity.MEDIUM -> c.warmOrange
                    IncidentSeverity.HIGH, IncidentSeverity.CRITICAL -> c.danger
                }
                Text(
                    text = option.label,
                    color = if (selected) tint else c.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (selected) tint.copy(alpha = 0.12f) else c.surface)
                        .border(
                            width = 1.dp,
                            color = if (selected) tint.copy(alpha = 0.5f) else c.border,
                            shape = RoundedCornerShape(12.dp),
                        )
                        .clickable { severity = option }
                        .padding(vertical = 12.dp),
                )
            }
        }

        IncidentSectionLabel("Incident title", required = true)
        OutlinedTextField(
            value = title,
            onValueChange = { title = it.take(140) },
            placeholder = { Text("Describe the incident in one line…", color = c.textMuted) },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )

        IncidentSectionLabel("More details")
        OutlinedTextField(
            value = description,
            onValueChange = { description = it.take(1000) },
            placeholder = {
                Text(
                    "What did you observe? When? Where? Who was involved? Any delivery proof or tracking info?",
                    color = c.textMuted,
                )
            },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            minLines = 4,
            modifier = Modifier.fillMaxWidth(),
        )

        if (showValueField) {
            IncidentSectionLabel("Estimated item value (USD)")
            OutlinedTextField(
                value = valueText,
                onValueChange = { valueText = sanitizeIncidentValue(it) },
                placeholder = { Text("e.g. 129.99", color = c.textMuted) },
                leadingIcon = { Text("$", color = c.textSecondary, fontWeight = FontWeight.Bold) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "Included in theft-report follow-ups. Optional.",
                color = c.textMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        IncidentSectionLabel("Your unit / address")
        OutlinedTextField(
            value = unitNumber,
            onValueChange = { unitNumber = it.take(20).uppercase() },
            placeholder = { Text("e.g. 204, 4B, or leave blank", color = c.textMuted) },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Text(
            text = "Your report is visible to community staff and HOA management. Residents only see updates addressed to them.",
            color = c.textMuted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 20.dp)
                .background(c.surface, RoundedCornerShape(12.dp))
                .padding(14.dp),
        )

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = {
                val selected = kind ?: return@Button
                val parsed = valueText.toDoubleOrNull()?.takeIf { it > 0.0 }
                val declared = parsed?.let { round(it * 100.0) / 100.0 }?.coerceAtMost(99_999_999.99)
                scope.launch {
                    isSubmitting = true
                    val ok = appViewModel.fileOrgIncident(
                        type = selected.value,
                        severity = severity.value,
                        title = title.trim(),
                        description = description.trim().ifBlank { null },
                        unitNumber = unitNumber.trim().ifBlank { null },
                        estimatedValue = declared,
                    )
                    isSubmitting = false
                    if (ok) showSuccess = true else showError = true
                }
            },
            enabled = canSubmit,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.danger,
                disabledContainerColor = c.elevated,
            ),
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(
                    color = c.onAccent,
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.dp,
                )
            } else {
                Text(
                    text = "Submit Incident",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (canSubmit) c.onAccent else c.textMuted,
                )
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun IncidentSectionLabel(text: String, modifier: Modifier = Modifier, required: Boolean = false) {
    val c = PorchivoTheme.colors
    Text(
        text = if (required) "$text *" else text,
        color = c.textPrimary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier.padding(top = 20.dp, bottom = 8.dp),
    )
}

/** Digits + a single decimal point only; keeps the decimal input honest. */
private fun sanitizeIncidentValue(text: String): String {
    val cleaned = text.filter { it.isDigit() || it == '.' }
    val firstDot = cleaned.indexOf('.')
    val result = if (firstDot == -1) {
        cleaned
    } else {
        cleaned.substring(0, firstDot + 1) + cleaned.substring(firstDot + 1).filter { it != '.' }
    }
    return result.take(11)
}
