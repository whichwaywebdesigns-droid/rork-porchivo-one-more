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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import com.rork.porchivo.ui.viewmodel.ShipmentsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
    shipmentsViewModel: ShipmentsViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val user by appViewModel.user.collectAsStateWithLifecycle()

    var carrier by remember { mutableStateOf<Carrier?>(null) }
    var carrierMenuOpen by remember { mutableStateOf(false) }
    var packagesExpected by remember { mutableStateOf("") }
    var trackingNumber by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var returnTime by remember { mutableStateOf("") }
    var approxOnly by remember { mutableStateOf(true) }
    var showSuccessDialog by remember { mutableStateOf(false) }

    val isValid = carrier != null && packagesExpected.isNotBlank()

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.accent,
        unfocusedBorderColor = c.border,
        focusedContainerColor = c.surface,
        unfocusedContainerColor = c.surface,
        focusedTextColor = c.textPrimary,
        unfocusedTextColor = c.textPrimary,
        cursorColor = c.accent,
    )

    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = { showSuccessDialog = false },
            title = { Text("Shipment Posted!", fontWeight = FontWeight.Bold) },
            text = { Text("Your neighbors will be notified. A Porch Partner will accept soon.") },
            confirmButton = {
                TextButton(onClick = {
                    showSuccessDialog = false
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.HOME) { inclusive = true }
                    }
                }) {
                    Text("Great!", color = c.accent, fontWeight = FontWeight.Bold)
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
            .padding(16.dp),
    ) {
        Text(
            text = "New Shipment",
            color = c.textPrimary,
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
        )
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(c.skyBlue, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(
                imageVector = Icons.Outlined.Inventory2,
                contentDescription = null,
                tint = c.accent,
                modifier = Modifier.size(24.dp),
            )
            Text(
                text = "Post a shipment for a neighbor to protect",
                color = c.textPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        SectionLabel("Carrier")
        ExposedDropdownMenuBox(
            expanded = carrierMenuOpen,
            onExpandedChange = { carrierMenuOpen = it },
        ) {
            OutlinedTextField(
                value = carrier?.label ?: "",
                onValueChange = {},
                readOnly = true,
                placeholder = { Text("Select carrier", color = c.textMuted) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = carrierMenuOpen) },
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable),
            )
            ExposedDropdownMenu(
                expanded = carrierMenuOpen,
                onDismissRequest = { carrierMenuOpen = false },
            ) {
                Carrier.entries.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.label) },
                        trailingIcon = {
                            if (carrier == option) {
                                Icon(Icons.Filled.Check, contentDescription = null, tint = c.accent)
                            }
                        },
                        onClick = {
                            carrier = option
                            carrierMenuOpen = false
                        },
                    )
                }
            }
        }

        SectionLabel("Packages Expected")
        OutlinedTextField(
            value = packagesExpected,
            onValueChange = { packagesExpected = it },
            placeholder = { Text("e.g., 2 boxes, one medium, one small", color = c.textMuted) },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )

        SectionLabel("Tracking Number (Optional)")
        OutlinedTextField(
            value = trackingNumber,
            onValueChange = { trackingNumber = it.uppercase() },
            placeholder = { Text("Enter tracking number if available", color = c.textMuted) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Outlined.LocalShipping,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(18.dp),
                )
            },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            text = "You can add this later from shipment details. You'll be notified when your package is delivered.",
            color = c.textMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 6.dp),
        )

        SectionLabel("Address")
        Text(
            text = user?.address?.ifBlank { "Set your address in profile" } ?: "Set your address in profile",
            color = c.textPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier
                .fillMaxWidth()
                .background(c.surface, RoundedCornerShape(12.dp))
                .padding(14.dp),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Show only approximate location until a partner is selected",
                color = c.textSecondary,
                fontSize = 13.sp,
                modifier = Modifier.weight(1f),
            )
            Switch(
                checked = approxOnly,
                onCheckedChange = { approxOnly = it },
                colors = SwitchDefaults.colors(
                    checkedTrackColor = c.accent,
                    checkedThumbColor = c.onAccent,
                ),
            )
        }

        SectionLabel("Preferred Return Time")
        OutlinedTextField(
            value = returnTime,
            onValueChange = { returnTime = it },
            placeholder = { Text("e.g., After 6 PM", color = c.textMuted) },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )

        SectionLabel("Notes for Partner")
        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            placeholder = { Text("e.g., Please leave behind the planter", color = c.textMuted) },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = {
                val selected = carrier ?: return@Button
                shipmentsViewModel.addShipment(
                    carrier = selected,
                    packagesExpected = packagesExpected.trim(),
                    trackingNumber = trackingNumber.trim().ifBlank { null },
                    notes = notes.trim(),
                    preferredReturnTime = returnTime.trim(),
                    homeLocationVisibleToPartner = !approxOnly,
                )
                showSuccessDialog = true
            },
            enabled = isValid,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.accent,
                disabledContainerColor = c.elevated,
            ),
        ) {
            Text(
                text = "Post Shipment",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = if (isValid) c.onAccent else c.textMuted,
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Text(
        text = text,
        color = c.textPrimary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier.padding(top = 20.dp, bottom = 8.dp),
    )
}
