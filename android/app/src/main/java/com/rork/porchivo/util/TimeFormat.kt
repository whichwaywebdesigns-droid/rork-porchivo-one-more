package com.rork.porchivo.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** Time helpers mirroring the Expo app's date formatting (min SDK 24 safe). */
object TimeFormat {

    private val timeFormat = SimpleDateFormat("h:mm a", Locale.US)
    private val dayFormat = SimpleDateFormat("EEE, MMM d", Locale.US)
    private val fullFormat = SimpleDateFormat("MMM d, h:mm a", Locale.US)

    fun window(startMillis: Long, endMillis: Long): String {
        return "${timeFormat.format(Date(startMillis))} – ${timeFormat.format(Date(endMillis))}"
    }

    /** "Today" / "Tomorrow" / "Wed, Mar 4" — mirrors formatDeliveryDate in packages tab. */
    fun expectedDay(millis: Long): String {
        val target = Calendar.getInstance().apply { timeInMillis = millis }
        val now = Calendar.getInstance()
        val tomorrow = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1) }
        return when {
            sameDay(target, now) -> "Today"
            sameDay(target, tomorrow) -> "Tomorrow"
            else -> dayFormat.format(Date(millis))
        }
    }

    /** "Just now" / "12m ago" / "3h ago" / "Mar 4, 2:15 PM" — mirrors formatNotifTime. */
    fun timeAgo(millis: Long): String {
        val diffMins = (System.currentTimeMillis() - millis) / 60_000L
        return when {
            diffMins < 1 -> "Just now"
            diffMins < 60 -> "${diffMins}m ago"
            diffMins < 60 * 24 -> "${diffMins / 60}h ago"
            else -> fullFormat.format(Date(millis))
        }
    }

    private fun sameDay(a: Calendar, b: Calendar): Boolean {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR) &&
            a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)
    }
}
