package com.rork.porchivo.ui.screens

import android.content.Intent
import androidx.core.net.toUri
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material.icons.outlined.Handshake
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.clickable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.data.AppLanguage
import com.rork.porchivo.model.UserRole
import com.rork.porchivo.ui.navigation.Routes
import com.rork.porchivo.ui.theme.PorchivoTheme
import kotlinx.coroutines.launch
import com.rork.porchivo.ui.viewmodel.AppViewModel

@Composable
fun ProfileScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val user by appViewModel.user.collectAsStateWithLifecycle()
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()
    val darkOverride by appViewModel.darkThemeOverride.collectAsStateWithLifecycle()
    val currentLanguage by appViewModel.language.collectAsStateWithLifecycle()

    val isDark = darkOverride ?: androidx.compose.foundation.isSystemInDarkTheme()

    var showDeleteDialog by remember { mutableStateOf(false) }
    var deleteConfirmText by remember { mutableStateOf("") }
    var isDeleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }
    var deleteSuccess by remember { mutableStateOf(false) }

    fun openUrl(url: String) {
        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Profile",
            color = c.textPrimary,
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
        )

        // Avatar section
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(c.accent, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = user?.name?.take(1) ?: "?",
                        color = c.onAccent,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = user?.name ?: "Loading...",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .background(c.accentSoft, RoundedCornerShape(999.dp))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Shield,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(12.dp),
                    )
                    Text(
                        text = user?.role?.label ?: "Homeowner",
                        color = c.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }

        // Join Your Community / Org membership
        if (orgMembership?.isActive == true) {
            SectionTitle("YOUR COMMUNITY")
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Apartment,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(18.dp),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = orgMembership?.orgName ?: "Your Community",
                            color = c.textPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = "Connected · ${orgMembership?.role?.replaceFirstChar { it.uppercase() } ?: "Resident"}",
                            color = c.textSecondary,
                            fontSize = 12.sp,
                        )
                    }
                    Text(
                        text = "Community",
                        color = c.success,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .background(c.successSoft, RoundedCornerShape(999.dp))
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                    )
                }
            }
        } else {
            SectionTitle("JOIN YOUR COMMUNITY")
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = c.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "Your community may already be on Porchivo. If your HOA, condo association, or property manager uses Porchivo, ask them to send you an invitation.",
                        color = c.textSecondary,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                    )
                    Text(
                        text = "I Manage a Community — Sign Up Here",
                        color = c.onAccent,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(c.accent, RoundedCornerShape(12.dp))
                            .clickable { navController.navigate(Routes.ORG_SIGNUP) }
                            .padding(vertical = 12.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Text(
                        text = "Request an Invitation",
                        color = c.textSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                context.startActivity(Intent(Intent.ACTION_VIEW, "mailto:support@porchivo.com?subject=Request%20Community%20Invitation".toUri()))
                            }
                            .padding(vertical = 10.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        }

        // Role
        SectionTitle("YOUR ROLE")
        RoleCard(
            icon = Icons.Outlined.Home,
            title = "Homeowner",
            description = "Track packages, get theft alerts, and set a safe drop-off preference.",
            selected = user?.role == UserRole.HOMEOWNER,
            onClick = { appViewModel.updateRole(UserRole.HOMEOWNER) },
        )
        RoleCard(
            icon = Icons.Outlined.Handshake,
            title = "Porch Partner",
            description = "Hold packages for neighbors and earn on your own schedule.",
            selected = user?.role == UserRole.PARTNER,
            onClick = { appViewModel.updateRole(UserRole.PARTNER) },
        )
        RoleCard(
            icon = Icons.Outlined.Shield,
            title = "Both",
            description = "Protect your own deliveries and help neighbors too.",
            selected = user?.role == UserRole.BOTH,
            onClick = { appViewModel.updateRole(UserRole.BOTH) },
        )

        // Settings
        SectionTitle("SETTINGS")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.LocationOn,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "Location sharing",
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = user?.hasLocationConsent ?: false,
                        onCheckedChange = { appViewModel.setLocationConsent(it) },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = c.success,
                            checkedThumbColor = c.onAccent,
                        ),
                    )
                }
                HorizontalDivider(color = c.border)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.DarkMode,
                        contentDescription = null,
                        tint = c.accent,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "Dark mode",
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = isDark,
                        onCheckedChange = { appViewModel.setDarkTheme(it) },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = c.accent,
                            checkedThumbColor = c.onAccent,
                        ),
                    )
                }
            }
        }

        // Language picker
        SectionTitle("LANGUAGE")
        LanguageCard(appViewModel = appViewModel, currentLanguage = currentLanguage)

        // Contact info
        SectionTitle("CONTACT INFO")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column {
                InfoRow(icon = Icons.Outlined.Home, label = user?.address ?: "")
                HorizontalDivider(color = c.border)
                InfoRow(icon = Icons.Outlined.Email, label = user?.email ?: "")
                HorizontalDivider(color = c.border)
                InfoRow(icon = Icons.Outlined.Phone, label = user?.phone ?: "")
            }
        }

        // Invite friends
        SectionTitle("SPREAD THE WORD")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            val inviteText = remember(user?.name) {
                val firstName = user?.name?.split(" ")?.firstOrNull() ?: ""
                val url = "https://porchivo.com/download"
                if (firstName.isBlank()) {
                    "Check out Porchivo — it tracks your packages, warns you about porch theft risk, and connects you with neighbors who can hold deliveries. Free on iOS and Android: $url"
                } else {
                    "$firstName invited you to join Porchivo — a neighborhood network that protects packages from porch pirates. When neighbors team up, thieves lose. Get Porchivo free: $url"
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, inviteText)
                            putExtra(Intent.EXTRA_TITLE, "Invite friends to Porchivo")
                        }
                        context.startActivity(Intent.createChooser(sendIntent, "Invite Friends"))
                    }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Share,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(18.dp),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Invite Friends",
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Share Porchivo with your neighbors",
                        color = c.textSecondary,
                        fontSize = 12.sp,
                    )
                }
                Icon(
                    imageVector = Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = c.textMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        // Legal
        SectionTitle("LEGAL & SUPPORT")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column {
                SettingRow(
                    icon = Icons.Outlined.Description,
                    iconTint = c.textSecondary,
                    label = "Privacy Policy",
                    onClick = { openUrl(AppConfig.Support.PRIVACY_POLICY_URL) },
                )
                HorizontalDivider(color = c.border)
                SettingRow(
                    icon = Icons.Outlined.Description,
                    iconTint = c.textSecondary,
                    label = "Terms of Service",
                    onClick = { openUrl(AppConfig.Support.TERMS_URL) },
                )
                HorizontalDivider(color = c.border)
                SettingRow(
                    icon = Icons.Outlined.Email,
                    iconTint = c.textSecondary,
                    label = AppConfig.Support.EMAIL,
                    onClick = { openUrl("mailto:${AppConfig.Support.EMAIL}") },
                )
            }
        }

        // Sign out
        SectionTitle("ACCOUNT")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = c.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column {
                SettingRow(
                    icon = Icons.Outlined.ExitToApp,
                    iconTint = c.danger,
                    label = "Sign Out",
                    onClick = { appViewModel.signOut() },
                )
                HorizontalDivider(color = c.border)
                SettingRow(
                    icon = Icons.Outlined.Delete,
                    iconTint = c.danger,
                    label = "Delete account",
                    onClick = { showDeleteDialog = true },
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
    }

    if (showDeleteDialog) {
        if (deleteSuccess) {
            AlertDialog(
                onDismissRequest = { appViewModel.signOut() },
                title = { Text("Account Deletion Requested") },
                text = {
                    Text("We've received your request. Your Porchivo account has been deactivated. Your personal data will be permanently deleted within 30 days. You can contact support@porchivo.com within 30 days to restore your account.")
                },
                confirmButton = {
                    TextButton(onClick = { appViewModel.signOut() }) {
                        Text("Done", color = c.accent)
                    }
                },
            )
        } else {
            AlertDialog(
                onDismissRequest = {
                    showDeleteDialog = false
                    deleteConfirmText = ""
                    deleteError = null
                },
                title = { Text("Delete Your Account?") },
                text = {
                    Column {
                        Text(
                            "Your account will be deactivated immediately. Your personal data will be permanently deleted within 30 days. Contact support@porchivo.com within 30 days to restore.",
                            fontSize = 14.sp,
                            color = c.textSecondary,
                        )
                        if (user?.email != null) {
                            Text(
                                "Account: ${user!!.email}",
                                fontSize = 13.sp,
                                color = c.textMuted,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                        Text(
                            "Type DELETE to confirm:",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = c.textPrimary,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                        OutlinedTextField(
                            value = deleteConfirmText,
                            onValueChange = { deleteConfirmText = it.uppercase() },
                            placeholder = { Text("DELETE") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                        )
                        deleteError?.let { err ->
                            Text(
                                text = err,
                                fontSize = 12.sp,
                                color = c.danger,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                },
                confirmButton = {
                    if (isDeleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = c.danger,
                        )
                    } else {
                        TextButton(
                            onClick = {
                                isDeleting = true
                                deleteError = null
                                scope.launch {
                                    val result = appViewModel.requestAccountDeletion()
                                    isDeleting = false
                                    if (result.isSuccess) {
                                        deleteSuccess = true
                                    } else {
                                        deleteError = result.exceptionOrNull()?.message ?: "Deletion failed"
                                    }
                                }
                            },
                            enabled = deleteConfirmText == "DELETE",
                        ) {
                            Text("Delete", color = if (deleteConfirmText == "DELETE") c.danger else c.textMuted)
                        }
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showDeleteDialog = false
                            deleteConfirmText = ""
                            deleteError = null
                        },
                        enabled = !isDeleting,
                    ) {
                        Text("Cancel", color = c.accent)
                    }
                },
            )
        }
    }
}

@Composable
private fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Text(
        text = text,
        color = c.textMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.4.sp,
        modifier = modifier.padding(top = 8.dp),
    )
}

@Composable
private fun SettingRow(
    icon: ImageVector,
    iconTint: androidx.compose.ui.graphics.Color,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = label,
            color = c.textPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = c.textMuted,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun LanguageCard(
    appViewModel: AppViewModel,
    currentLanguage: AppLanguage,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Language,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(18.dp),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = currentLanguage.nativeName,
                        color = c.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = currentLanguage.englishName,
                        color = c.textSecondary,
                        fontSize = 12.sp,
                    )
                }
                Text(
                    text = currentLanguage.flag,
                    fontSize = 20.sp,
                )
                ExposedDropdownMenuDefaults.TrailingIcon(
                    expanded = expanded,
                )
            }
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier.background(c.surface),
            ) {
                AppLanguage.entries.forEach { lang ->
                    val isActive = lang == currentLanguage
                    DropdownMenuItem(
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(text = lang.flag, fontSize = 18.sp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = lang.nativeName,
                                        color = if (isActive) c.accent else c.textPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                                    )
                                    Text(
                                        text = lang.englishName + if (lang.rtl) " · RTL" else "",
                                        color = c.textSecondary,
                                        fontSize = 11.sp,
                                    )
                                    Text(
                                        text = "\u201C${lang.hello}\u201D",
                                        color = c.textMuted,
                                        fontSize = 11.sp,
                                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                    )
                                }
                                if (isActive) {
                                    Icon(
                                        imageVector = Icons.Filled.CheckCircle,
                                        contentDescription = "Selected",
                                        tint = c.accent,
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                            }
                        },
                        onClick = {
                            appViewModel.setLanguage(lang)
                            expanded = false
                        },
                        modifier = if (isActive) Modifier.background(c.accent.copy(alpha = 0.08f)) else Modifier,
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, label: String, modifier: Modifier = Modifier) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = c.accent,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = label,
            color = c.textPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun RoleCard(
    icon: ImageVector,
    title: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = c.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = if (selected) androidx.compose.foundation.BorderStroke(2.dp, c.accent) else null,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(c.skyBlue, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(20.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = c.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = description,
                    color = c.textSecondary,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                )
            }
            if (selected) {
                Icon(
                    imageVector = Icons.Filled.CheckCircle,
                    contentDescription = "Selected",
                    tint = c.accent,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}
