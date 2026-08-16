package com.rork.porchivo.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.CheckCircle
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.ui.theme.PorchivoColors
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import kotlinx.coroutines.launch

private enum class SignupStep { DETAILS, PLAN, LAUNCHING, CONFIRMING, SUCCESS, CANCELLED }

private data class PlanInfo(val id: String, val name: String, val monthly: Int, val blurb: String)

private val ORG_TYPES = listOf(
    "hoa" to "HOA",
    "condo" to "Condo Association",
    "multifamily" to "Multifamily",
    "property_management" to "Property Management",
)

private val PLANS = listOf(
    PlanInfo("starter", "Starter", 79, "Up to 50 units"),
    PlanInfo("community", "Community", 199, "Up to 200 units"),
    PlanInfo("professional", "Professional", 399, "Up to 500 units"),
    PlanInfo("enterprise", "Enterprise", 599, "Up to 2,000 units"),
)

private const val SUCCESS_REDIRECT = "porchivo://org-signup/success"
private const val CANCEL_REDIRECT = "porchivo://org-signup/cancelled"

@Composable
fun OrgSignupScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val appViewModel: AppViewModel = viewModel()

    var step by remember { mutableStateOf(SignupStep.DETAILS) }
    var orgName by remember { mutableStateOf("") }
    var orgType by remember { mutableStateOf("hoa") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var stateField by remember { mutableStateOf("") }
    var zip by remember { mutableStateOf("") }
    var totalUnits by remember { mutableStateOf("") }
    var selectedPlan by remember { mutableStateOf("community") }
    var isAnnual by remember { mutableStateOf(true) }
    var isProcessing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var checkoutSessionId by remember { mutableStateOf<String?>(null) }
    var checkoutOrgId by remember { mutableStateOf<String?>(null) }
    var inviteCode by remember { mutableStateOf<String?>(null) }
    var createdOrgName by remember { mutableStateOf("") }

    // Observe deep link redirect from MainActivity
    val repo = AppRepositoryHolder.get()
    val redirectUrl by repo.orgSignupRedirectUrl.collectAsState()

    LaunchedEffect(redirectUrl) {
        val url = redirectUrl ?: return@LaunchedEffect
        // Clear the redirect so we don't re-process it
        repo.clearOrgSignupRedirect()
        if (url.startsWith(SUCCESS_REDIRECT)) {
            val parsed = parseRedirectUrl(url)
            val sid = parsed.first ?: checkoutSessionId
            val oid = parsed.second ?: checkoutOrgId
            if (sid != null && oid != null) {
                step = SignupStep.CONFIRMING
                scope.launch {
                    val result = appViewModel.confirmOrgSignup(sid, oid)
                    if (result.isSuccess) {
                        val response = result.getOrNull()
                        if (response?.success == true) {
                            inviteCode = response.org?.inviteCode
                            createdOrgName = response.org?.name ?: orgName
                            appViewModel.refreshOrgContext()
                            step = SignupStep.SUCCESS
                        } else {
                            errorMessage = response?.error ?: "Payment verification failed"
                            step = SignupStep.CANCELLED
                        }
                    } else {
                        errorMessage = result.exceptionOrNull()?.message ?: "Verification failed"
                        step = SignupStep.CANCELLED
                    }
                }
            }
        } else if (url.startsWith(CANCEL_REDIRECT)) {
            step = SignupStep.CANCELLED
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Step indicator
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            repeat(3) { i ->
                val stepIndex = when (step) {
                    SignupStep.DETAILS -> 0
                    SignupStep.PLAN -> 1
                    else -> 2
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .background(
                            if (i <= stepIndex) c.accent else c.elevated,
                            RoundedCornerShape(2.dp),
                        )
                )
            }
        }

        when (step) {
            SignupStep.DETAILS -> DetailsStep(
                c = c, orgName = orgName, onOrgNameChange = { orgName = it },
                orgType = orgType, onOrgTypeChange = { orgType = it },
                address = address, onAddressChange = { address = it },
                city = city, onCityChange = { city = it },
                stateField = stateField, onStateChange = { stateField = it.uppercase().take(2) },
                zip = zip, onZipChange = { zip = it.take(5) },
                totalUnits = totalUnits, onTotalUnitsChange = { totalUnits = it },
            ) {
                val canContinue = orgName.isNotBlank() && address.isNotBlank() &&
                    city.isNotBlank() && stateField.length == 2 && zip.length == 5
                Button(
                    onClick = { step = SignupStep.PLAN },
                    enabled = canContinue,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent),
                ) {
                    Text("Continue to Plan Selection", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.size(4.dp))
                    Icon(Icons.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                }
            }

            SignupStep.PLAN -> PlanStep(
                c = c, plans = PLANS, selectedPlan = selectedPlan,
                onPlanSelect = { selectedPlan = it },
                isAnnual = isAnnual, onBillingToggle = { isAnnual = it },
                isProcessing = isProcessing, errorMessage = errorMessage,
            ) {
                scope.launch {
                    isProcessing = true
                    errorMessage = null
                    step = SignupStep.LAUNCHING

                    val result = appViewModel.createOrgCheckout(
                        name = orgName.trim(),
                        type = orgType,
                        address = address.trim(),
                        city = city.trim(),
                        state = stateField.uppercase(),
                        zip = zip.trim(),
                        totalUnits = totalUnits.toIntOrNull(),
                        planTier = selectedPlan,
                        billingCycle = if (isAnnual) "annual" else "monthly",
                        returnUrl = SUCCESS_REDIRECT,
                    )

                    isProcessing = false

                    if (result.isSuccess) {
                        val response = result.getOrNull()!!
                        checkoutSessionId = response.sessionId
                        checkoutOrgId = response.orgId

                        // Open Stripe Checkout in the system browser
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(response.checkoutUrl))
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                        // The deep link redirect will be handled by the LaunchedEffect above
                    } else {
                        errorMessage = result.exceptionOrNull()?.message ?: "Failed to create checkout"
                        step = SignupStep.CANCELLED
                    }
                }
            }

            SignupStep.LAUNCHING -> CenterState(
                c = c,
                title = "Preparing checkout…",
                body = "Setting up your community and Stripe payment session.",
            )

            SignupStep.CONFIRMING -> CenterState(
                c = c,
                title = "Verifying payment…",
                body = "Confirming your subscription with Stripe. This usually takes a few seconds.",
            )

            SignupStep.SUCCESS -> SuccessStep(
                c = c,
                orgName = createdOrgName.ifBlank { orgName },
                inviteCode = inviteCode,
            ) {
                navController.popBackStack()
            }

            SignupStep.CANCELLED -> CancelledStep(
                c = c,
                errorMessage = errorMessage,
                checkoutSessionId = checkoutSessionId,
                checkoutOrgId = checkoutOrgId,
                onRetry = {
                    scope.launch {
                        val sid = checkoutSessionId
                        val oid = checkoutOrgId
                        if (sid != null && oid != null) {
                            step = SignupStep.CONFIRMING
                            val result = appViewModel.confirmOrgSignup(sid, oid)
                            if (result.isSuccess && result.getOrNull()?.success == true) {
                                inviteCode = result.getOrNull()?.org?.inviteCode
                                createdOrgName = result.getOrNull()?.org?.name ?: orgName
                                appViewModel.refreshOrgContext()
                                step = SignupStep.SUCCESS
                            } else {
                                errorMessage = result.getOrNull()?.error
                                    ?: result.exceptionOrNull()?.message
                                    ?: "Verification failed"
                                step = SignupStep.CANCELLED
                            }
                        }
                    }
                },
                onBack = {
                    step = SignupStep.PLAN
                    errorMessage = null
                },
            )
        }
    }
}

// ─── Step composables ─────────────────────────────────────────────────────

@Composable
private fun DetailsStep(
    c: PorchivoColors,
    orgName: String, onOrgNameChange: (String) -> Unit,
    orgType: String, onOrgTypeChange: (String) -> Unit,
    address: String, onAddressChange: (String) -> Unit,
    city: String, onCityChange: (String) -> Unit,
    stateField: String, onStateChange: (String) -> Unit,
    zip: String, onZipChange: (String) -> Unit,
    totalUnits: String, onTotalUnitsChange: (String) -> Unit,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Tell us about your community", color = c.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)

        LabeledField(c, "Organization Name") {
            OutlinedTextField(
                value = orgName, onValueChange = onOrgNameChange,
                placeholder = { Text("e.g. Maple Grove HOA") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
        }

        Text("Type", color = c.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        ORG_TYPES.forEach { (key, label) ->
            Card(
                onClick = { onOrgTypeChange(key) },
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
                    Text(label, color = c.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        LabeledField(c, "Street Address") {
            OutlinedTextField(
                value = address, onValueChange = onAddressChange,
                placeholder = { Text("123 Main St") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            LabeledField(c, "City", modifier = Modifier.weight(1f)) {
                OutlinedTextField(
                    value = city, onValueChange = onCityChange,
                    placeholder = { Text("Austin") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                )
            }
            LabeledField(c, "State", modifier = Modifier.width(64.dp)) {
                OutlinedTextField(
                    value = stateField, onValueChange = onStateChange,
                    placeholder = { Text("TX") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                )
            }
            LabeledField(c, "ZIP", modifier = Modifier.width(90.dp)) {
                OutlinedTextField(
                    value = zip, onValueChange = onZipChange,
                    placeholder = { Text("78701") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }
        }

        LabeledField(c, "Total Units (optional)") {
            OutlinedTextField(
                value = totalUnits, onValueChange = onTotalUnitsChange,
                placeholder = { Text("e.g. 50") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        }

        content()
    }
}

@Composable
private fun PlanStep(
    c: PorchivoColors,
    plans: List<PlanInfo>,
    selectedPlan: String,
    onPlanSelect: (String) -> Unit,
    isAnnual: Boolean,
    onBillingToggle: (Boolean) -> Unit,
    isProcessing: Boolean,
    errorMessage: String?,
    onCheckout: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Choose your plan", color = c.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)

        // Billing cycle toggle
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                modifier = Modifier
                    .background(if (!isAnnual) c.accent else c.elevated, RoundedCornerShape(999.dp))
                    .clickable { onBillingToggle(false) }
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text("Monthly", color = if (!isAnnual) c.onAccent else c.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            Box(
                modifier = Modifier
                    .background(if (isAnnual) c.accent else c.elevated, RoundedCornerShape(999.dp))
                    .clickable { onBillingToggle(true) }
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Annual", color = if (isAnnual) c.onAccent else c.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text("Save 20%", color = if (isAnnual) c.onAccent else c.success, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        plans.forEach { plan ->
            Card(
                onClick = { onPlanSelect(plan.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                border = if (selectedPlan == plan.id)
                    androidx.compose.foundation.BorderStroke(2.dp, c.accent)
                else null,
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = if (selectedPlan == plan.id) Icons.Filled.Check else Icons.Outlined.CreditCard,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(22.dp),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(plan.name, color = c.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(plan.blurb, color = c.textSecondary, fontSize = 11.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("$${plan.monthly}", color = c.textPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                        Text(if (isAnnual) "/mo billed yearly" else "/mo", color = c.textMuted, fontSize = 11.sp)
                    }
                }
            }
        }

        errorMessage?.let {
            Text(it, color = c.danger, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }

        Button(
            onClick = onCheckout,
            enabled = !isProcessing,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = c.accent),
        ) {
            if (isProcessing) {
                CircularProgressIndicator(
                    color = c.onAccent,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                Icon(Icons.Outlined.CreditCard, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.size(4.dp))
                Text("Continue to Payment", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CenterState(c: PorchivoColors, title: String, body: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        CircularProgressIndicator(color = c.accent)
        Text(title, color = c.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(body, color = c.textSecondary, fontSize = 14.sp)
    }
}

@Composable
private fun SuccessStep(
    c: PorchivoColors,
    orgName: String,
    inviteCode: String?,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(
            Icons.Filled.Check,
            contentDescription = null,
            tint = c.success,
            modifier = Modifier.size(48.dp),
        )
        Text("Community is live!", color = c.textPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(
            "$orgName is now on Porchivo. Your subscription is active and community features are unlocked.",
            color = c.textSecondary, fontSize = 14.sp,
        )

        inviteCode?.let { code ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("YOUR INVITE CODE", color = c.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(code, color = c.accent, fontSize = 32.sp, fontWeight = FontWeight.Black)
                    Text(
                        "Share this code with residents so they can join your community.",
                        color = c.textMuted, fontSize = 12.sp,
                    )
                }
            }
        }

        Button(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = c.accent),
        ) {
            Text("Go to Dashboard", fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.size(4.dp))
            Icon(Icons.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun CancelledStep(
    c: PorchivoColors,
    errorMessage: String?,
    checkoutSessionId: String?,
    checkoutOrgId: String?,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(
            Icons.Outlined.CreditCard,
            contentDescription = null,
            tint = c.textMuted,
            modifier = Modifier.size(36.dp),
        )
        Text("Payment not completed", color = c.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(
            "You closed the checkout before finishing. Your community has been saved but isn't active yet.",
            color = c.textSecondary, fontSize = 14.sp,
        )
        errorMessage?.let {
            Text(it, color = c.danger, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
        if (checkoutSessionId != null && checkoutOrgId != null) {
            Button(
                onClick = onRetry,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = c.accent),
            ) {
                Text("I Already Paid — Verify", fontWeight = FontWeight.Bold)
            }
        }
        Button(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = c.elevated),
        ) {
            Text("Back to plan selection", color = c.textSecondary, fontWeight = FontWeight.Medium)
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

@Composable
private fun LabeledField(
    c: PorchivoColors,
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = c.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        content()
    }
}

private fun parseRedirectUrl(url: String): Pair<String?, String?> {
    val uri = Uri.parse(url)
    val sessionId = uri.getQueryParameter("session_id")
    val orgId = uri.getQueryParameter("org_id")
    return sessionId to orgId
}
