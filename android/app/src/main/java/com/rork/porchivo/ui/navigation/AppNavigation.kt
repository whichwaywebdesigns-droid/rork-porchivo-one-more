package com.rork.porchivo.ui.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.draw.alpha
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Handshake
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.rork.porchivo.ui.screens.HomeScreen
import com.rork.porchivo.ui.screens.AddPackageScreen
import com.rork.porchivo.ui.screens.CreateScreen
import com.rork.porchivo.ui.screens.PackageDetailScreen
import com.rork.porchivo.ui.screens.PackagesScreen
import com.rork.porchivo.ui.screens.PorchPartnerScreen
import com.rork.porchivo.ui.screens.PaymentsScreen
import com.rork.porchivo.ui.screens.ProfileScreen
import com.rork.porchivo.ui.screens.MoreScreen
import com.rork.porchivo.ui.screens.AnnouncementsScreen
import com.rork.porchivo.ui.screens.OrgDocumentsScreen
import com.rork.porchivo.ui.screens.OrgAmenitiesScreen
import com.rork.porchivo.ui.screens.OrgLedgerScreen
import com.rork.porchivo.ui.screens.OrgSignupScreen
import com.rork.porchivo.ui.screens.RequestsScreen
import com.rork.porchivo.ui.screens.SafetyScreen
import com.rork.porchivo.ui.screens.FileIncidentScreen
import com.rork.porchivo.ui.screens.ShipmentDetailScreen
import com.rork.porchivo.ui.screens.UpgradeScreen
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel

object Routes {
    const val HOME = "home"
    const val PACKAGES = "packages"
    const val CREATE = "create"
    const val PORCH_PARTNER = "porch-partner"
    const val PAYMENTS = "payments"
    const val REQUESTS = "requests"
    const val MORE = "more"
    const val PROFILE = "profile"
    const val ACTIVITY = "activity"
    const val ADD_PACKAGE = "add-package"
    const val ORG_SIGNUP = "org-signup"
    const val UPGRADE = "upgrade"
    const val SAFETY = "safety"
    const val FILE_INCIDENT = "file-incident"
    const val ANNOUNCEMENTS = "announcements"
    const val ORG_DOCUMENTS = "org-documents"
    const val ORG_AMENITIES = "org-amenities"
    const val ORG_LEDGER = "org-ledger"
    const val PACKAGE_DETAIL = "package-detail/{id}"
    const val SHIPMENT_DETAIL = "shipment-detail/{id}"

    fun packageDetail(id: String) = "package-detail/$id"
    fun shipmentDetail(id: String) = "shipment-detail/$id"
}

private data class TabItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val appViewModel: AppViewModel = viewModel()
    val orgMembership by appViewModel.orgMembership.collectAsStateWithLifecycle()
    val languageTransitioning by appViewModel.languageTransitioning.collectAsStateWithLifecycle()
    val c = PorchivoTheme.colors
    val isOrgMember = orgMembership?.isActive == true

    // Smooth alpha fade when switching languages.
    val contentAlpha by animateFloatAsState(
        targetValue = if (languageTransitioning) 0f else 1f,
        animationSpec = tween(durationMillis = 200),
        label = "languageFade",
    )

    val tabs = if (isOrgMember) {
        listOf(
            TabItem(Routes.HOME, "Home", Icons.Outlined.Home, Icons.Filled.Home),
            TabItem(Routes.PAYMENTS, "Payments", Icons.Outlined.CreditCard, Icons.Filled.CreditCard),
            TabItem(Routes.REQUESTS, "Requests", Icons.Outlined.Build, Icons.Filled.Build),
            TabItem(Routes.MORE, "More", Icons.Outlined.MoreHoriz, Icons.Filled.MoreHoriz),
        )
    } else {
        listOf(
            TabItem(Routes.HOME, "Deliveries", Icons.Outlined.Inventory2, Icons.Filled.Inventory2),
            TabItem(Routes.PORCH_PARTNER, "Porch Partner", Icons.Outlined.Handshake, Icons.Filled.Handshake),
            TabItem(Routes.PROFILE, "Account", Icons.Outlined.Person, Icons.Filled.Person),
        )
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showBottomBar = tabs.any { it.route == currentRoute }

    Scaffold(
        containerColor = c.background,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(containerColor = c.surface) {
                    tabs.forEach { tab ->
                        val selected = currentRoute == tab.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector = if (selected) tab.selectedIcon else tab.icon,
                                    contentDescription = tab.label,
                                )
                            },
                            label = {
                                Text(
                                    text = tab.label,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    letterSpacing = 0.3.sp,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = c.accent,
                                selectedTextColor = c.accent,
                                unselectedIconColor = c.textMuted,
                                unselectedTextColor = c.textMuted,
                                indicatorColor = c.accentSoft,
                            ),
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            modifier = Modifier
                .padding(innerPadding)
                .alpha(contentAlpha),
        ) {
            composable(Routes.HOME) { HomeScreen(navController) }
            composable(Routes.PACKAGES) { PackagesScreen(navController) }
            composable(Routes.CREATE) { CreateScreen(navController) }
            composable(Routes.PORCH_PARTNER) { PorchPartnerScreen(navController) }
            composable(Routes.PAYMENTS) { PaymentsScreen(navController) }
            composable(Routes.REQUESTS) { RequestsScreen(navController) }
            composable(Routes.MORE) { MoreScreen(navController) }
            composable(Routes.PROFILE) { ProfileScreen(navController) }
            composable(Routes.ADD_PACKAGE) { AddPackageScreen(navController) }
            composable(Routes.ORG_SIGNUP) { OrgSignupScreen(navController) }
            composable(Routes.UPGRADE) { UpgradeScreen(navController) }
            composable(Routes.SAFETY) { SafetyScreen(navController) }
            composable(Routes.FILE_INCIDENT) { FileIncidentScreen(navController) }
            composable(Routes.ANNOUNCEMENTS) { AnnouncementsScreen(navController) }
            composable(Routes.ORG_DOCUMENTS) { OrgDocumentsScreen(navController) }
            composable(Routes.ORG_AMENITIES) { OrgAmenitiesScreen(navController) }
            composable(Routes.ORG_LEDGER) { OrgLedgerScreen(navController) }
            composable(
                route = Routes.PACKAGE_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { entry ->
                PackageDetailScreen(navController, entry.arguments?.getString("id").orEmpty())
            }
            composable(
                route = Routes.SHIPMENT_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { entry ->
                ShipmentDetailScreen(navController, entry.arguments?.getString("id").orEmpty())
            }
        }
    }
}
