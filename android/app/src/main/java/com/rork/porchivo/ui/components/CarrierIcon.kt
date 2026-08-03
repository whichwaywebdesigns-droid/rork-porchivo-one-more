package com.rork.porchivo.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.porchivo.model.Carrier

/** Rounded carrier badge — mirrors the Expo app's CarrierIcon component. */
@Composable
fun CarrierIcon(
    carrier: Carrier,
    modifier: Modifier = Modifier,
    size: Dp = 42.dp,
) {
    val (bg, fg, label) = when (carrier) {
        Carrier.AMAZON -> Triple(Color(0xFFFFF3E0), Color(0xFFFF9900), "a")
        Carrier.UPS -> Triple(Color(0xFFF3EDE7), Color(0xFF644117), "UPS")
        Carrier.USPS -> Triple(Color(0xFFE8F0FA), Color(0xFF004B87), "USPS")
        Carrier.FEDEX -> Triple(Color(0xFFF0EAF8), Color(0xFF4D148C), "Fed")
        Carrier.OTHER -> Triple(Color(0xFFEDF0F5), Color(0xFF6B7F99), "📦")
    }

    Box(
        modifier = modifier
            .size(size)
            .background(bg, RoundedCornerShape(size / 3)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = fg,
            fontSize = (size.value / 3.4).sp,
            fontWeight = FontWeight.ExtraBold,
        )
    }
}
