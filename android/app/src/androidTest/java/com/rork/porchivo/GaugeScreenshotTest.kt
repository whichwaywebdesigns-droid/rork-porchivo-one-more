package com.rork.porchivo

import android.Manifest
import android.graphics.Bitmap
import android.os.Build
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicReference

/**
 * Screenshot capture harness for the needle-gauge rollout (versionCode 1788441601).
 *
 * Signs in through the app's built-in developer login (QA account via the
 * dev-confirm-user edge function; local demo seed when Supabase is not
 * configured), walks onboarding when shown, then captures:
 *  1. Home with the "TODAY'S SAFETY" card
 *  2. The Safety screen with the needle gauge
 *
 * PNGs land in app-specific external storage and are also uploaded to a
 * short-lived file host so they can be retrieved without adb access.
 */
@RunWith(AndroidJUnit4::class)
class GaugeScreenshotTest {

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private fun visible(label: String): Boolean =
        compose.onAllNodesWithText(label, substring = true).fetchSemanticsNodes().isNotEmpty()

    /** All text currently in the semantics tree — the failure dump. */
    private fun visibleTexts(): List<String> {
        val out = mutableListOf<String>()
        fun walk(node: SemanticsNode) {
            node.config.getOrNull(SemanticsProperties.Text)?.forEach { out += it.toString() }
            node.config.getOrNull(SemanticsProperties.EditableText)?.forEach { out += it.toString() }
            node.children.forEach { walk(it) }
        }
        walk(compose.onRoot().fetchSemanticsNode())
        return out.distinct()
    }

    /**
     * Polls [cond] until true or [timeoutMs] elapses. Plain wall-clock polling:
     * the app renders in real time and waitForIdle stalls on screens with
     * infinite animations, so we never ask the test clock for idleness.
     */
    private fun pumpUntil(timeoutMs: Long, cond: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (cond()) return true
            Thread.sleep(100)
        }
        return cond()
    }

    /** Gives the app real frames to settle without waiting for global idleness. */
    private fun pumpFrames() {
        Thread.sleep(400)
    }

    /** Polls with manual clock pumping; dumps visible text + a screenshot on timeout. */
    private fun waitForOrDump(timeoutMs: Long, phase: String, extra: String = "", condition: () -> Boolean) {
        if (pumpUntil(timeoutMs, condition)) return
        val texts = runCatching { visibleTexts() }.getOrElse { listOf("<semantics unavailable>") }
        val shot = runCatching { capture("failure_$phase") }.getOrNull()
        val url = shot?.let { runCatching { upload(it) }.getOrNull() }
        throw AssertionError(
            "[$phase] timed out after ${timeoutMs}ms. visible=${texts.take(50)}; shot=$shot; uploadUrl=$url$extra",
        )
    }

    private fun tap(label: String) {
        val matches = compose.onAllNodesWithText(label)
        if (matches.fetchSemanticsNodes().isEmpty()) return // raced a transition — next round re-checks
        matches.onLast().performClick()
        pumpFrames()
    }

    /**
     * Clicks the last node matching [label] that actually has a click action,
     * falling back to any text match. Returns a diagnostic for the walk log:
     * how many nodes matched — >1 means the tree holds duplicates/stale content.
     */
    private fun tapClickable(label: String): String {
        val clickable = compose.onAllNodes(hasText(label, substring = true).and(hasClickAction()))
        var count = clickable.fetchSemanticsNodes().size
        val target = if (count > 0) clickable else {
            val any = compose.onAllNodesWithText(label, substring = true)
            count = any.fetchSemanticsNodes().size
            any
        }
        if (target.fetchSemanticsNodes().isEmpty()) return "[$label:nomatch]"
        target.onLast().performClick()
        pumpFrames()
        return "[$label:x$count]"
    }

    private fun shotsDir(): File {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        return File(ctx.getExternalFilesDir(null), "shots").apply { mkdirs() }
    }

    private fun capture(name: String): File {
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(shotsDir(), "$name.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("PORCHIVO_SHOT ${file.absolutePath}")
        return file
    }

    private fun grantPostNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                val ctx = InstrumentationRegistry.getInstrumentation().targetContext
                InstrumentationRegistry.getInstrumentation().uiAutomation
                    .grantRuntimePermission(ctx.packageName, Manifest.permission.POST_NOTIFICATIONS)
            } catch (_: Exception) {
                // Non-fatal — onboarding has a "Not now" path.
            }
        }
    }

    /**
     * Uploads to tmpfiles.org (files auto-expire) and returns the share URL, or null.
     */
    private fun upload(file: File): String? = try {
        val boundary = "----PorchivoBoundary" + System.currentTimeMillis()
        val conn = URL("https://tmpfiles.org/api/v1/upload").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.connectTimeout = 15_000
        conn.readTimeout = 45_000
        conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        conn.outputStream.use { out ->
            out.write("--$boundary\r\n".toByteArray())
            out.write("Content-Disposition: form-data; name=\"file\"; filename=\"${file.name}\"\r\n".toByteArray())
            out.write("Content-Type: image/png\r\n\r\n".toByteArray())
            out.write(file.readBytes())
            out.write("\r\n--$boundary--\r\n".toByteArray())
        }
        val body = conn.inputStream.bufferedReader().readText()
        Regex("\"url\":\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1)
    } catch (_: Exception) {
        null
    }

    @Test
    fun captureGaugeScreens() {
        grantPostNotifications()
        // The QA account is marked is_onboarded server-side, so after login the
        // app lands straight on Home — the onboarding walk below is only a
        // fallback for a fresh account.

        // App settles into one of: login (no session), onboarding, or home.
        pumpUntil(30_000) {
            visible("Developer login") || visible("Hello,") || visible("Get started")
        }

        if (visible("Developer login")) {
            tap("Developer login")
            waitForOrDump(90_000, "login") {
                visible("Hello,") || visible("Get started") || visible("Start using Porchivo")
            }
        }

        // Walk onboarding when the QA account starts fresh. The app can bounce
        // back to an earlier page mid-walk (auth/onboarding state re-emission),
        // so keep tapping whatever step is visible for many rounds and log the
        // story so the failure message explains exactly what happened.
        val onboardingSteps = listOf(
            "Get started",
            "Track my package",
            "This is useful — continue",
            "Alerts on — Continue",
            "Enable delivery alerts",
            "Not now",
            "Join my neighborhood",
            "Maybe later",
            "Start using Porchivo",
            "Developer login", // self-heal: bounced to login screen → sign in again
        )
        val walkLog = mutableListOf<String>()
        var lastStep: String? = null
        var stuckRounds = 0
        repeat(40) {
            if (visible("Hello,")) return@repeat
            val step = onboardingSteps.firstOrNull { visible(it) }
            if (step == null) {
                walkLog += "idle"
                Thread.sleep(700)
                return@repeat
            }
            stuckRounds = if (step == lastStep) stuckRounds + 1 else 0
            lastStep = step
            walkLog += tapClickable(step)
            if (stuckRounds == 3 || stuckRounds == 7 || stuckRounds == 15) {
                walkLog += "STUCK@'$step':${runCatching { visibleTexts().take(12) }.getOrElse { listOf("?") }}"
            }
            Thread.sleep(250)
        }
        waitForOrDump(60_000, "home", "; walk=${walkLog.takeLast(30)}") { visible("Hello,") }
        pumpFrames()

        // Home — make sure the safety card is composed (scroll if below the fold).
        if (!visible("TODAY'S SAFETY")) {
            compose.onAllNodes(hasScrollAction())[0]
                .performScrollToNode(hasText("TODAY'S SAFETY", substring = true))
        }
        pumpUntil(30_000) { visible("TODAY'S SAFETY") }
        pumpFrames()
        capture("01_home_safety")

        // Safety screen — needle gauge hero shot.
        tap("TODAY'S SAFETY")
        pumpUntil(30_000) { visible("Higher is safer") || visible("SAFETY FACTORS") }
        pumpFrames()
        capture("02_safety_gauge")

        // Publish artifacts: paths to stdout + short-lived upload URLs.
        val files = shotsDir().listFiles()?.sortedBy { it.name }.orEmpty()
        val report = AtomicReference("")
        val uploader = Thread {
            report.set(files.joinToString("\n") { f ->
                val url = upload(f)
                val direct = url?.replace("tmpfiles.org/", "tmpfiles.org/dl/")
                "PORCHIVO_SHOT ${f.absolutePath}\nPORCHIVO_SHOT_URL ${f.name} url=$url direct=$direct"
            })
        }
        uploader.start()
        uploader.join(60_000)
        println(report.get())

        assertTrue("expected 2 captures, got ${files.size}", files.size >= 2)
        assertTrue(
            "gauge screen not reached",
            visible("SAFETY FACTORS") || visible("Higher is safer"),
        )
    }
}
