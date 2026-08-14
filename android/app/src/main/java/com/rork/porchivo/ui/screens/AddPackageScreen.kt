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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
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
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.model.AddressNickname
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.PackageStatusEvent
import com.rork.porchivo.model.PackageTrackingStatus
import com.rork.porchivo.model.SubscriptionTier
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import com.rork.porchivo.ui.viewmodel.PackagesViewModel
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPackageScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
    packagesViewModel: PackagesViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val tier by appViewModel.tier.collectAsStateWithLifecycle()
    val packages by packagesViewModel.packages.collectAsStateWithLifecycle()

    val atFreeLimit = false // HOA-provisioned model — no free tier limit

    var name by remember { mutableStateOf("") }
    var carrier by remember { mutableStateOf<Carrier?>(null) }
    var carrierMenuOpen by remember { mutableStateOf(false) }
    var trackingNumber by remember { mutableStateOf("") }
    var expectedDay by remember { mutableStateOf(0) } // 0=today 1=tomorrow 3=in 3 days
    var addressNickname by remember { mutableStateOf(AddressNickname.HOME) }
    var notes by remember { mutableStateOf("") }

    val isValid = name.isNotBlank() && carrier != null && trackingNumber.isNotBlank()

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.accent,
        unfocusedBorderColor = c.border,
        focusedContainerColor = c.surface,
        unfocusedContainerColor = c.surface,
        focusedTextColor = c.textPrimary,
        unfocusedTextColor = c.textPrimary,
        cursorColor = c.accent,
    )

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
                text = "Add Package",
                color = c.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        if (atFreeLimit) {
            // Hard paywall — free tier tracks 1 package (mirrors FREE_LIMITS.maxPackages)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(c.surface, RoundedCornerShape(20.dp))
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        imageVector = Icons.Filled.WorkspacePremium,
                        contentDescription = null,
                        tint = c.gold,
                        modifier = Modifier.size(40.dp),
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "You've reached the free limit",
                        color = c.textPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Free accounts track ${AppConfig.FreeLimits.MAX_PACKAGES} package at a time. " +
                            "Upgrade to Premium for unlimited packages, Theft Shield, and 90-second refresh.",
                        color = c.textSecondary,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Button(
                        onClick = { navController.navigate(Routes.UPGRADE) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent),
                    ) {
                        Text(
                            text = "Upgrade to Premium",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            return
        }

        Column(modifier = Modifier.padding(16.dp)) {
            FieldLabel("Package Name")
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                placeholder = { Text("e.g., Running Shoes", color = c.textMuted) },
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            )

            FieldLabel("Carrier")
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

            FieldLabel("Tracking Number")
            OutlinedTextField(
                value = trackingNumber,
                onValueChange = { trackingNumber = it.uppercase() },
                placeholder = { Text("e.g., 1Z999AA10123456784", color = c.textMuted) },
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            )

            FieldLabel("Expected Delivery")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0 to "Today", 1 to "Tomorrow", 3 to "In 3 days").forEach { (days, label) ->
                    FilterChip(
                        selected = expectedDay == days,
                        onClick = { expectedDay = days },
                        label = { Text(label, fontWeight = FontWeight.SemiBold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = c.accentSoft,
                            selectedLabelColor = c.accent,
                            containerColor = c.surface,
                            labelColor = c.textSecondary,
                        ),
                    )
                }
            }

            FieldLabel("Deliver To")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AddressNickname.entries.forEach { option ->
                    FilterChip(
                        selected = addressNickname == option,
                        onClick = { addressNickname = option },
                        label = { Text(option.label, fontWeight = FontWeight.SemiBold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = c.accentSoft,
                            selectedLabelColor = c.accent,
                            containerColor = c.surface,
                            labelColor = c.textSecondary,
                        ),
                    )
                }
            }

            FieldLabel("Notes for Partner (Optional)")
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                placeholder = { Text("e.g., Leave behind the planter", color = c.textMuted) },
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = {
                    val selected = carrier ?: return@Button
                    val now = System.currentTimeMillis()
                    packagesViewModel.addPackage(
                        TrackedPackage(
                            id = UUID.randomUUID().toString(),
                            name = name.trim(),
                            carrier = selected,
                            trackingNumber = trackingNumber.trim(),
                            expectedDeliveryDate = now + expectedDay * 24L * 3_600_000L,
                            currentStatus = PackageTrackingStatus.ORDERED,
                            addressNickname = addressNickname,
                            notesForPartner = notes.trim(),
                            statusHistory = listOf(
                                PackageStatusEvent(PackageTrackingStatus.ORDERED, now, true),
                                PackageStatusEvent(PackageTrackingStatus.SHIPPED, null, false),
                                PackageStatusEvent(PackageTrackingStatus.OUT_FOR_DELIVERY, null, false),
                                PackageStatusEvent(PackageTrackingStatus.DELIVERED, null, false),
                            ),
                            createdAt = now,
                        ),
                    )
                    navController.popBackStack()
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
                    text = "Start Tracking",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isValid) c.onAccent else c.textMuted,
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Text(
        text = text,
        color = c.textPrimary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier.padding(top = 18.dp, bottom = 8.dp),
    )
}
