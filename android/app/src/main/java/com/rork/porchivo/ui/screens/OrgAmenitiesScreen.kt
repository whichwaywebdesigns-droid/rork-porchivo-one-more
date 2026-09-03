package com.rork.porchivo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Pool
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.data.dto.DbOrgAmenityReservation
import com.rork.porchivo.data.dto.SlotTakenException
import com.rork.porchivo.ui.components.EmptyState
import com.rork.porchivo.ui.theme.PorchivoTheme
import com.rork.porchivo.ui.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

/** First bookable hour (8 AM) and last start hour (7 PM → ends 8 PM). */
private const val FIRST_HOUR = 8
private const val LAST_HOUR = 19

/** Keyword → emoji mapping, ported from the Expo amenity-reservations screen. */
internal fun amenityEmoji(name: String): String {
    val n = name.lowercase(Locale.US)
    return when {
        "pool" in n -> "🏊"
        "gym" in n || "fitness" in n -> "💪"
        "club" in n -> "🏛️"
        "tennis" in n || "court" in n || "pickle" in n -> "🎾"
        "bbq" in n || "grill" in n -> "🔥"
        "park" in n || "garden" in n -> "🌳"
        "lounge" in n || "library" in n -> "🛋️"
        "dog" in n || "pet" in n -> "🐕"
        else -> "🏷️"
    }
}

/**
 * Amenity Reservations — Community / Professional / Property Manager plans.
 * Members book hourly slots (8 AM–8 PM); staff manage the amenity list and can
 * cancel any booking. Double-booking is blocked by a DB-level GiST exclusion
 * constraint (surfaces as [SlotTakenException]). Mirrors the Expo
 * `app/amenity-reservations.tsx` screen against the same tables/RLS.
 */
@Composable
fun OrgAmenitiesScreen(
    navController: NavController,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel(),
) {
    val c = PorchivoTheme.colors
    val scope = rememberCoroutineScope()
    val amenities by appViewModel.orgAmenities.collectAsStateWithLifecycle()
    val amenitiesLoadState by appViewModel.orgAmenitiesLoadState.collectAsStateWithLifecycle()
    val reservations by appViewModel.orgReservations.collectAsStateWithLifecycle()
    val reservationsLoadState by appViewModel.orgReservationsLoadState.collectAsStateWithLifecycle()
    val planTier by appViewModel.orgPlanTier.collectAsStateWithLifecycle()
    val isStaff = appViewModel.isOrgStaff
    val isOrgMember = appViewModel.isOrgMember

    var addAmenityOpen by remember { mutableStateOf(false) }
    var pendingRemoveAmenity by remember { mutableStateOf<String?>(null) }
    var pendingRemoveAmenityName by remember { mutableStateOf("") }
    var reserveOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { appViewModel.loadOrgAmenitiesAndReservations() }

    val planAllowed = planTier == null ||
        planTier in setOf("community", "professional", "enterprise")

    val amenityNameById = remember(amenities) {
        amenities.associate { it.id to it.name }
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
                    text = "Amenity Reservations",
                    color = c.textPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        when {
            !isOrgMember -> item {
                EmptyState(
                    icon = Icons.Outlined.CalendarMonth,
                    title = "Join a community",
                    body = "Reserve the pool, clubhouse, and more once your HOA or property joins Porchivo.",
                )
            }
            !planAllowed -> item {
                EmptyState(
                    icon = Icons.Outlined.CalendarMonth,
                    title = "Community feature",
                    body = "Amenity reservations are available on the Community plan and up. Ask your board to upgrade your community's plan.",
                )
            }
            amenitiesLoadState is LoadState.Loading || reservationsLoadState is LoadState.Loading -> item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator(color = c.accent) }
            }
            else -> {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "Amenities",
                            color = c.textPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        if (amenities.isEmpty()) {
                            Text(
                                text = if (isStaff) {
                                    "Add the amenities residents can book — pool, clubhouse, tennis court…"
                                } else {
                                    "No amenities have been added yet."
                                },
                                color = c.textMuted,
                                fontSize = 13.sp,
                            )
                        } else {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(amenities, key = { it.id }) { amenity ->
                                    AmenityChip(
                                        label = amenity.name,
                                        onRemove = if (isStaff) {
                                            {
                                                pendingRemoveAmenity = amenity.id
                                                pendingRemoveAmenityName = amenity.name
                                            }
                                        } else null,
                                    )
                                }
                                if (isStaff) {
                                    item {
                                        AmenityChip(
                                            label = "Add",
                                            isAdd = true,
                                            onAdd = { addAmenityOpen = true },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    Text(
                        text = "Upcoming",
                        color = c.textPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                if (reservations.isEmpty()) {
                    item {
                        EmptyState(
                            icon = Icons.Outlined.CalendarMonth,
                            title = "No reservations yet",
                            body = "Book your first time slot below.",
                        )
                    }
                } else {
                    val userId = appViewModel.currentUserId
                    items(reservations, key = { it.id }) { reservation ->
                        val isMine = reservation.reservedBy == userId
                        ReservationCard(
                            reservation = reservation,
                            amenityName = amenityNameById[reservation.amenityId] ?: "Amenity",
                            isMine = isMine,
                            canCancel = isMine || isStaff,
                            onCancel = {
                                scope.launch { appViewModel.cancelOrgReservation(reservation.id) }
                            },
                        )
                    }
                    item {
                        val mineCount = reservations.count { it.reservedBy == userId }
                        if (mineCount > 0) {
                            Text(
                                text = "You have $mineCount upcoming ${if (mineCount == 1) "booking" else "bookings"}.",
                                color = c.textMuted,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }
    }

    if (amenities.isNotEmpty() && planAllowed && isOrgMember) {
        Box(modifier = Modifier.fillMaxSize()) {
            ExtendedFloatingActionButton(
                onClick = { reserveOpen = true },
                containerColor = c.accent,
                contentColor = androidx.compose.ui.graphics.Color.White,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(20.dp),
            ) {
                Icon(imageVector = Icons.Outlined.Pool, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Reserve")
            }
        }
    }

    // ── Add amenity (staff) ────────────────────────────────────────────
    if (addAmenityOpen) {
        var amenityName by remember { mutableStateOf("") }
        var addError by remember { mutableStateOf<String?>(null) }
        var adding by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!adding) addAmenityOpen = false },
            title = { Text("Add Amenity", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = amenityName,
                        onValueChange = { amenityName = it },
                        label = { Text("Name (e.g. Pool, Clubhouse)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    addError?.let { Text(text = it, color = c.danger, fontSize = 12.sp) }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        adding = true
                        scope.launch {
                            val result = appViewModel.addOrgAmenity(amenityName.trim())
                            adding = false
                            if (result.isSuccess) {
                                addAmenityOpen = false
                            } else {
                                val msg = result.exceptionOrNull()?.message ?: "Could not add amenity"
                                addError = if (msg.contains("duplicate", ignoreCase = true) ||
                                    msg.contains("unique", ignoreCase = true)
                                ) {
                                    "An amenity with that name already exists."
                                } else msg
                            }
                        }
                    },
                    enabled = amenityName.isNotBlank() && !adding,
                ) { Text(if (adding) "Adding…" else "Add", color = c.accent) }
            },
            dismissButton = {
                TextButton(onClick = { addAmenityOpen = false }, enabled = !adding) {
                    Text("Cancel", color = c.textSecondary)
                }
            },
            containerColor = c.surface,
        )
    }

    // ── Remove amenity (staff) ─────────────────────────────────────────
    pendingRemoveAmenity?.let { amenityId ->
        AlertDialog(
            onDismissRequest = { pendingRemoveAmenity = null },
            title = { Text("Remove amenity", color = c.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Remove $pendingRemoveAmenityName and its reservations?", color = c.textSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            appViewModel.removeOrgAmenity(amenityId)
                            pendingRemoveAmenity = null
                        }
                    },
                ) { Text("Remove", color = c.danger) }
            },
            dismissButton = {
                TextButton(onClick = { pendingRemoveAmenity = null }) {
                    Text("Cancel", color = c.textSecondary)
                }
            },
            containerColor = c.surface,
        )
    }

    // ── Booking sheet ──────────────────────────────────────────────────
    if (reserveOpen) {
        BookingSheet(
            amenities = amenities,
            reservations = reservations,
            onDismiss = { reserveOpen = false },
            onReserve = { amenityId, startIso, endIso, onDone ->
                scope.launch {
                    val result = appViewModel.reserveAmenity(amenityId, startIso, endIso)
                    if (result.isSuccess) {
                        reserveOpen = false
                    } else {
                        onDone(
                            if (result.exceptionOrNull() is SlotTakenException) {
                                "Just booked — someone grabbed that slot first. Pick another time."
                            } else {
                                result.exceptionOrNull()?.message ?: "Could not reserve"
                            },
                        )
                    }
                }
            },
            onCancelReservation = { reservationId ->
                scope.launch { appViewModel.cancelOrgReservation(reservationId) }
            },
        )
    }
}

@Composable
private fun AmenityChip(
    label: String,
    isAdd: Boolean = false,
    onRemove: (() -> Unit)? = null,
    onAdd: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    Row(
        modifier = modifier
            .background(
                if (isAdd) c.accentSoft else c.surface,
                RoundedCornerShape(999.dp),
            )
            .clickable { if (isAdd) onAdd?.invoke() }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (isAdd) {
            Icon(
                imageVector = Icons.Filled.Add,
                contentDescription = null,
                tint = c.accent,
                modifier = Modifier.size(13.dp),
            )
        } else {
            Text(text = amenityEmoji(label), fontSize = 13.sp)
        }
        Text(
            text = label,
            color = if (isAdd) c.accent else c.textPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        onRemove?.let {
            IconButton(onClick = it, modifier = Modifier.size(16.dp)) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Remove $label",
                    tint = c.textMuted,
                    modifier = Modifier.size(13.dp),
                )
            }
        }
    }
}

@Composable
private fun ReservationCard(
    reservation: DbOrgAmenityReservation,
    amenityName: String,
    isMine: Boolean,
    canCancel: Boolean,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = PorchivoTheme.colors
    val dayFormat = remember { SimpleDateFormat("EEE, MMM d", Locale.getDefault()) }
    val timeFormat = remember { SimpleDateFormat("h:mm a", Locale.getDefault()) }
    val start = remember(reservation.startsAt) { parseIsoDate(reservation.startsAt) }
    val end = remember(reservation.endsAt) { parseIsoDate(reservation.endsAt) }

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
                .background(c.accentSoft, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = amenityEmoji(amenityName), fontSize = 18.sp)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = amenityName + if (isMine) " · You" else "",
                color = c.textPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "${dayFormat.format(start)} · ${timeFormat.format(start)} – ${timeFormat.format(end)}",
                color = c.textMuted,
                fontSize = 12.sp,
            )
            val booker = reservation.member?.name
            if (!isMine && !booker.isNullOrBlank()) {
                Text(
                    text = "Reserved by $booker",
                    color = c.textMuted,
                    fontSize = 12.sp,
                    maxLines = 1,
                )
            }
        }
        if (canCancel) {
            IconButton(onClick = onCancel) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Cancel reservation",
                    tint = c.danger,
                )
            }
        }
    }
}

/**
 * Booking sheet — amenity chips × 14-day chips × 1-hour slot grid
 * (8 AM–8 PM starts, past/booked slots disabled). Tapping a free slot books it.
 */
@Composable
private fun BookingSheet(
    amenities: List<com.rork.porchivo.data.dto.DbOrgAmenity>,
    reservations: List<DbOrgAmenityReservation>,
    onDismiss: () -> Unit,
    onReserve: (amenityId: String, startIso: String, endIso: String, onDone: (String?) -> Unit) -> Unit,
    onCancelReservation: (String) -> Unit,
) {
    val c = PorchivoTheme.colors
    var pickedAmenity by remember { mutableStateOf(amenities.firstOrNull()?.id) }
    var pickedDay by remember { mutableIntStateOf(0) }
    var slotError by remember { mutableStateOf<String?>(null) }
    var booking by remember { mutableStateOf(false) }

    val days = remember {
        val calendar = Calendar.getInstance()
        (0 until 14).map { offset ->
            calendar.timeInMillis + offset.toLong() * 86_400_000L
        }
    }
    val dayFormat = remember { SimpleDateFormat("EEE", Locale.getDefault()) }
    val subFormat = remember { SimpleDateFormat("M/d", Locale.getDefault()) }

    AlertDialog(
        onDismissRequest = { if (!booking) onDismiss() },
        title = { Text("Reserve a Slot", color = c.textPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Amenity chips
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(amenities, key = { it.id }) { amenity ->
                        val selected = amenity.id == pickedAmenity
                        Text(
                            text = "${amenityEmoji(amenity.name)} ${amenity.name}",
                            color = if (selected) androidx.compose.ui.graphics.Color.White else c.textPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .background(
                                    if (selected) c.accent else c.surface,
                                    RoundedCornerShape(999.dp),
                                )
                                .clickable {
                                    pickedAmenity = amenity.id
                                    slotError = null
                                }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                        )
                    }
                }

                // Day chips (next 14 days)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    days.forEachIndexed { index, timeMs ->
                        val selected = index == pickedDay
                        val dayDate = Date(timeMs)
                        Text(
                            text = "${dayFormat.format(dayDate)}\n${subFormat.format(dayDate)}",
                            color = if (selected) androidx.compose.ui.graphics.Color.White else c.textSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            lineHeight = 14.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier
                                .background(
                                    if (selected) c.accent else c.surface,
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable {
                                    pickedDay = index
                                    slotError = null
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }

                // Hour slot grid
                val dayStartCal = remember(days, pickedDay) {
                    Calendar.getInstance().apply {
                        timeInMillis = days[pickedDay]
                        set(Calendar.HOUR_OF_DAY, 0)
                        set(Calendar.MINUTE, 0)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                }
                val nowCal = remember { Calendar.getInstance() }
                val bookedHours = remember(reservations, pickedAmenity, days, pickedDay) {
                    reservations.asSequence()
                        .filter { it.amenityId == pickedAmenity }
                        .mapNotNull { r ->
                            val cal = Calendar.getInstance().apply { timeInMillis = parseIsoDate(r.startsAt).time }
                            val dayStart = dayStartCal
                            val sameDay = cal.get(Calendar.YEAR) == dayStart.get(Calendar.YEAR) &&
                                cal.get(Calendar.DAY_OF_YEAR) == dayStart.get(Calendar.DAY_OF_YEAR)
                            if (sameDay) cal.get(Calendar.HOUR_OF_DAY) else null
                        }
                        .toSet()
                }

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    (FIRST_HOUR..LAST_HOUR).chunked(4).forEach { rowHours ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            rowHours.forEach { hour ->
                                val slotStart = Calendar.getInstance().apply {
                                    timeInMillis = dayStartCal.timeInMillis
                                    set(Calendar.HOUR_OF_DAY, hour)
                                }
                                val slotEnd = (slotStart.clone() as Calendar).apply { add(Calendar.HOUR_OF_DAY, 1) }
                                val isPast = slotStart.before(nowCal)
                                val isBooked = hour in bookedHours
                                val enabled = !isPast && !isBooked && !booking
                                val label = String.format(
                                    Locale.US,
                                    "%d %s",
                                    if (hour % 12 == 0) 12 else hour % 12,
                                    if (hour < 12) "AM" else "PM",
                                )
                                Text(
                                    text = label,
                                    color = when {
                                        !enabled -> c.textMuted
                                        else -> androidx.compose.ui.graphics.Color.White
                                    },
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier
                                        .background(
                                            when {
                                                isBooked -> c.surface
                                                isPast -> c.surface
                                                else -> c.accent
                                            },
                                            RoundedCornerShape(10.dp),
                                        )
                                        .clickable(enabled = enabled) {
                                            booking = true
                                            slotError = null
                                            onReserve(
                                                pickedAmenity ?: return@clickable,
                                                java.time.Instant.ofEpochMilli(slotStart.timeInMillis).toString(),
                                                java.time.Instant.ofEpochMilli(slotEnd.timeInMillis).toString(),
                                            ) { message ->
                                                booking = false
                                                slotError = message
                                            }
                                        }
                                        .padding(horizontal = 10.dp, vertical = 7.dp),
                                )
                            }
                        }
                    }
                }

                slotError?.let { Text(text = it, color = c.danger, fontSize = 12.sp) }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = { onDismiss() }, enabled = !booking) {
                Text("Close", color = c.textSecondary)
            }
        },
        containerColor = c.surface,
    )
}
