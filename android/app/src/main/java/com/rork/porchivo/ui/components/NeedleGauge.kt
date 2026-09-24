package com.rork.porchivo.ui.components

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.ui.theme.PorchivoTheme
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private val gaugeTrack = Color(0xFF1B3A6B)
private val gaugeRing = Color(0xFFE8611A)
private val gaugeZones = listOf(Color(0xFFEF4444), Color(0xFFE8611A), Color(0xFF4ADE80))
private const val gaugeStart = 150f
private const val gaugeSweep = 240f

/**
 * Animated needle gauge for safety scores (higher = safer).
 *
 * 240° arc; zones run red → orange → green left to right, so a safe score
 * always lands the needle in the green zone on the right. Soft glow is faked
 * with layered strokes. Sweeps for 1.4s with an eased count-up; honours the
 * system "remove animations" setting by jumping straight to the final value.
 */
@Composable
fun NeedleGauge(
    score: Int,
    riskLabel: String,
    scoreColor: Color,
    modifier: Modifier = Modifier,
    size: Dp = 230.dp,
) {
    val c = PorchivoTheme.colors
    val context = LocalContext.current
    val reduceMotion = remember {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    }
    val clamped = score.coerceIn(0, 100)
    val anim = remember { Animatable(0f) }
    LaunchedEffect(clamped, reduceMotion) {
        if (reduceMotion) {
            anim.snapTo(clamped.toFloat())
        } else {
            anim.snapTo(0f)
            anim.animateTo(clamped.toFloat(), tween(durationMillis = 1400, easing = EaseOutCubic))
        }
    }
    val display = anim.value.roundToInt()

    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(size)
                .semantics { contentDescription = "Safety score $clamped out of 100, $riskLabel" },
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawGauge(animatedScore = anim.value)
            }
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = size * 0.10f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "$display",
                    color = scoreColor,
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    text = "out of 100",
                    color = c.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        Box {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(50))
                    .background(scoreColor.copy(alpha = 0.18f)),
            )
            Text(
                text = riskLabel.uppercase(),
                color = scoreColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.2.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(c.surface)
                    .border(1.5.dp, scoreColor, RoundedCornerShape(50))
                    .padding(horizontal = 16.dp, vertical = 7.dp),
            )
        }
    }
}

private fun DrawScope.drawGauge(animatedScore: Float) {
    val stroke = 14.dp.toPx()
    val radius = min(size.width, size.height) / 2f - 26.dp.toPx()
    val center = Offset(size.width / 2f, size.height / 2f)
    val arcTopLeft = Offset(center.x - radius, center.y - radius)
    val arcSize = Size(radius * 2f, radius * 2f)

    // Track
    drawArc(
        color = gaugeTrack.copy(alpha = 0.4f),
        startAngle = gaugeStart,
        sweepAngle = gaugeSweep,
        useCenter = false,
        topLeft = arcTopLeft,
        size = arcSize,
        style = Stroke(width = stroke, cap = StrokeCap.Round),
    )

    // Layered glow behind the zones
    listOf(22.dp.toPx() to 0.15f, 30.dp.toPx() to 0.06f).forEach { (glowWidth, glowAlpha) ->
        gaugeZones.forEachIndexed { index, zoneColor ->
            drawArc(
                color = zoneColor.copy(alpha = glowAlpha),
                startAngle = gaugeStart + index * 80f,
                sweepAngle = 80f,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = glowWidth, cap = StrokeCap.Butt),
            )
        }
    }

    // Zones (red left → green right)
    gaugeZones.forEachIndexed { index, zoneColor ->
        drawArc(
            color = zoneColor,
            startAngle = gaugeStart + index * 80f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = arcTopLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Butt),
        )
    }

    // Ticks — longer at 0 / 50 / 100
    for (i in 0..10) {
        val major = i % 5 == 0
        val radians = Math.toRadians((gaugeStart + i * gaugeSweep / 10f).toDouble())
        val inner = radius + (if (major) 9.dp.toPx() else 11.dp.toPx())
        val outer = radius + (if (major) 21.dp.toPx() else 17.dp.toPx())
        drawLine(
            color = gaugeTrack.copy(alpha = if (major) 0.5f else 0.28f),
            start = Offset(center.x + cos(radians).toFloat() * inner, center.y + sin(radians).toFloat() * inner),
            end = Offset(center.x + cos(radians).toFloat() * outer, center.y + sin(radians).toFloat() * outer),
            strokeWidth = if (major) 2.5.dp.toPx() else 1.5.dp.toPx(),
            cap = StrokeCap.Round,
        )
    }

    // Needle (drawn pointing up, rotated around the hub) + layered glow
    val needleLength = radius - 18.dp.toPx()
    rotate(degrees = -120f + animatedScore * gaugeSweep / 100f, pivot = center) {
        listOf(9.dp.toPx() to 0.15f, 17.dp.toPx() to 0.06f).forEach { (glowWidth, glowAlpha) ->
            drawLine(
                color = Color.White.copy(alpha = glowAlpha),
                start = Offset(center.x, center.y + 4.dp.toPx()),
                end = Offset(center.x, center.y - needleLength + 4.dp.toPx()),
                strokeWidth = glowWidth,
                cap = StrokeCap.Round,
            )
        }
        val needle = Path().apply {
            moveTo(center.x, center.y - needleLength)
            lineTo(center.x - 3.dp.toPx(), center.y + 6.dp.toPx())
            lineTo(center.x, center.y + 12.dp.toPx())
            lineTo(center.x + 3.dp.toPx(), center.y + 6.dp.toPx())
            close()
        }
        drawPath(needle, Color.White)
        drawPath(needle, gaugeTrack, style = Stroke(width = 1.2.dp.toPx()))
    }

    // Hub: navy dot with thin orange ring (drawn above the needle)
    drawCircle(color = gaugeTrack, radius = 10.dp.toPx(), center = center)
    drawCircle(
        color = gaugeRing,
        radius = 13.dp.toPx(),
        center = center,
        style = Stroke(width = 2.dp.toPx()),
    )
}
