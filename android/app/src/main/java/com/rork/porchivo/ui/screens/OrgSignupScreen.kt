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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
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
import androidx.navigation.NavController
import com.rork.porchivo.ui.theme.PorchivoTheme

@Composable
fun OrgSignupScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    var step by remember { mutableStateOf(0) }
    var orgName by remember { mutableStateOf("") }
    var orgType by remember { mutableStateOf("hoa") }
    var address by remember { mutableStateOf("") }
    var units by remember { mutableStateOf("") }
    var selectedPlan by remember { mutableStateOf("community") }
    var isAnnual by remember { mutableStateOf(true) }
    var isProcessing by remember { mutableStateOf(false) }

    val orgTypes = listOf(
        "hoa" to "HOA",
        "condo" to "Condo Association",
        "apartment" to "Apartment Complex",
        "property_mgmt" to "Property Management",
    )
    val plans = listOf(
        Triple("starter", "Starter", 49),
        Triple("community", "Community", 99),
        Triple("professional", "Professional", 179),
        Triple("enterprise", "Enterprise", 299),
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            repeat(3) { i ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .background(
                            if (i <= step) c.accent else c.elevated,
                            RoundedCornerShape(2.dp),
                        )
                )
            }
        }
        when (step) {
            0 -> {
                Text(
                    text = "Tell us about your community",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                )
                OutlinedTextField(
                    value = orgName,
                    onValueChange = { orgName = it },
                    label = { Text("Organization Name") },
                    placeholder = { Text("e.g. Maple Grove HOA") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = "Type",
                    color = c.textSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                orgTypes.forEach { (key, label) ->
                    Card(
                        onClick = { orgType = key },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = c.surface),
                        border = if (orgType == key)
                            androidx.compose.foundation.BorderStroke(2.dp, c.accent)
                        else null,
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(
                                imageVector = if (orgType == key) Icons.Filled.Check else Icons.Outlined.Apartment,
                                contentDescription = null,
                                tint = if (orgType == key) c.accent else c.textMuted,
                                modifier = Modifier.size(20.dp),
                            )
                            Text(
                                text = label,
                                color = c.textPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Address") },
                    placeholder = { Text("Street address") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = units,
                    onValueChange = { units = it },
                    label = { Text("Number of Units") },
                    placeholder = { Text("e.g. 50") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = { step = 1 },
                    enabled = orgName.isNotBlank() && address.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent),
                ) {
                    Text("Continue", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.size(4.dp))
                    Icon(Icons.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                }
            }
            1 -> {
                Text(
                    text = "Choose your plan",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .background(if (!isAnnual) c.accent else c.elevated, RoundedCornerShape(999.dp))
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            "Monthly",
                            color = if (!isAnnual) c.onAccent else c.textSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .background(if (isAnnual) c.accent else c.elevated, RoundedCornerShape(999.dp))
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            "Annual (Save 15%)",
                            color = if (isAnnual) c.onAccent else c.textSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                plans.forEach { (id, name, monthly) ->
                    Card(
                        onClick = { selectedPlan = id },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = c.surface),
                        border = if (selectedPlan == id)
                            androidx.compose.foundation.BorderStroke(2.dp, c.accent)
                        else null,
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(
                                imageVector = if (selectedPlan == id) Icons.Filled.Check else Icons.Outlined.CreditCard,
                                contentDescription = null,
                                tint = c.accent,
                                modifier = Modifier.size(22.dp),
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = name,
                                    color = c.textPrimary,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "$$monthly",
                                    color = c.textPrimary,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Black,
                                )
                                Text(
                                    text = if (isAnnual) "/mo billed yearly" else "/mo",
                                    color = c.textMuted,
                                    fontSize = 11.sp,
                                )
                            }
                        }
                    }
                }
                Button(
                    onClick = {
                        isProcessing = true
                        step = 2
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent),
                ) {
                    Icon(Icons.Outlined.CreditCard, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.size(4.dp))
                    Text("Continue to Payment", fontWeight = FontWeight.Bold)
                }
            }
            else -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = null,
                            tint = c.success,
                            modifier = Modifier.size(48.dp),
                        )
                        Text(
                            text = "All set!",
                            color = c.textPrimary,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                        )
                        Text(
                            text = "Redirecting to secure checkout...",
                            color = c.textSecondary,
                            fontSize = 14.sp,
                        )
                        CircularProgressIndicator(color = c.accent)
                    }
                }
            }
        }
    }
}
