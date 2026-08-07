package com.rork.porchivo.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.ui.theme.PorchivoTheme
import kotlinx.coroutines.delay
import java.util.Calendar

private enum class CountdownTone { NEUTRAL, AMBER, DANGER }

private data class CountdownState(
    val text: String,
    val tone: CountdownTone,
    val pulse: Boolean,
    val overdue: Boolean,
)

private fun computeCountdown(target: Long, now: Long): CountdownState {
    val diff = target - now
    if (diff <= 0) {
        return CountdownState("Overdue", CountdownTone.DANGER, pulse = true, overdue = true)
    }
    val totalSec = (diff / 1000).toInt()
    val days = totalSec / 86400
    val hours = (totalSec % 86400) / 3600
    val minutes = (totalSec % 3600) / 60
    val seconds = totalSec % 60

    return when {
        days > 0 -> CountdownState("${days}d ${hours}h", CountdownTone.NEUTRAL, pulse = false, overdue = false)
        hours > 0 -> CountdownState("${hours}h ${minutes}m", CountdownTone.AMBER, pulse = false, overdue = false)
        minutes > 0 -> CountdownState("${minutes}m ${seconds}s", CountdownTone.DANGER, pulse = true, overdue = false)
        else -> CountdownState("${seconds}s", CountdownTone.DANGER, pulse = true, overdue = false)
    }
}

/**
 * Live-ticking countdown pill for active package cards.
 *
 * Colour shifts from accent blue (>24h) → warm orange (<24h) → danger red (<1h or overdue).
 * Pulses (scale 1→1.12) when under 1 hour or overdue.
 * Renders nothing when [isDelivered] is true.
 *
 * @param expectedDeliveryDate Epoch millis for the expected delivery date.
 * @param isDelivered True when the package status is delivered / picked up / returned.
 */
@Composable
fun DeliveryCountdown(
    expectedDeliveryDate: Long,
    isDelivered: Boolean,
    modifier: Modifier = Modifier,
) {
    if (isDelivered) return

    val c = PorchivoTheme.colors

    val target = remember(expectedDeliveryDate) {
        val cal = Calendar.getInstance().apply {
            timeInMillis = expectedDeliveryDate
            set(Calendar.HOUR_OF_DAY, 23)
            set(Calendar.MINUTE, 59)
            set(Calendar.SECOND, 59)
            set(Calendar.MILLISECOND, 999)
        }
        cal.timeInMillis
    }

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000L)
        }
    }

    val state = computeCountdown(target, now)

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.12f,
        animationSpec = infiniteRepeatable(
            animation = tween(700),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseScale",
    )

    val scale = if (state.pulse) pulseScale else 1f

    val toneColor = when (state.tone) {
        CountdownTone.NEUTRAL -> c.accent
        CountdownTone.AMBER -> c.warmOrange
        CountdownTone.DANGER -> c.danger
    }

    val bgColor = when (state.tone) {
        CountdownTone.NEUTRAL -> c.accentSoft
        CountdownTone.AMBER -> c.warmOrangeSoft
        CountdownTone.DANGER -> c.dangerSoft
    }

    Row(
        modifier = modifier
            .scale(scale)
            .background(bgColor, RoundedCornerShape(100))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            imageVector = if (state.overdue) Icons.Outlined.Warning else Icons.Outlined.Timer,
            contentDescription = null,
            tint = toneColor,
            modifier = Modifier.size(11.dp),
        )
        Text(
            text = state.text,
            color = toneColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
        )
    }
}
