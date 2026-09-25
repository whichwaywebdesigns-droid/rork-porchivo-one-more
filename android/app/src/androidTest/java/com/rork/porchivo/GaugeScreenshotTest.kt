package com.rork.porchivo

import android.Manifest
import android.graphics.Bitmap
import android.os.Build
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.captureToImage
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

    /** waitUntil that self-diagnoses on timeout: dumps visible text + uploads a screenshot. */
    private fun waitForOrDump(timeoutMs: Long, phase: String, condition: () -> Boolean) {
        try {
            compose.waitUntil(timeoutMs) { condition() }
        } catch (e: Throwable) {
            // ComposeTimeoutException extends AssertionError (an Error, not an
            // Exception) — must catch Throwable or the dump never runs.
            val texts = runCatching { visibleTexts() }.getOrElse { listOf("<semantics unavailable>") }
            val shot = runCatching { capture("failure_$phase") }.getOrNull()
            val url = shot?.let { runCatching { upload(it) }.getOrNull() }
            throw AssertionError(
                "[$phase] timed out after ${timeoutMs}ms. visible=${texts.take(50)}; shot=$shot; uploadUrl=$url",
                e,
            )
        }
    }

    private fun tap(label: String) {
        compose.onAllNodesWithText(label).onLast().performClick()
        compose.waitForIdle()
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

        // App settles into one of: login (no session), onboarding, or home.
        compose.waitUntil(30_000) {
            visible("Developer login") || visible("Hello,") || visible("Get started")
        }

        if (visible("Developer login")) {
            tap("Developer login")
            waitForOrDump(90_000, "login") {
                visible("Hello,") || visible("Get started") || visible("Start using Porchivo")
            }
        }

        // Walk onboarding when the QA account starts fresh.
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
        )
        repeat(12) {
            if (visible("Hello,")) return@repeat
            onboardingSteps.firstOrNull { visible(it) }?.let { tap(it) }
        }
        waitForOrDump(60_000, "home") { visible("Hello,") }
        compose.waitForIdle()

        // Home — make sure the safety card is composed (scroll if below the fold).
        if (!visible("TODAY'S SAFETY")) {
            compose.onAllNodes(hasScrollAction())[0]
                .performScrollToNode(hasText("TODAY'S SAFETY", substring = true))
        }
        compose.waitUntil(30_000) { visible("TODAY'S SAFETY") }
        compose.waitForIdle()
        capture("01_home_safety")

        // Safety screen — needle gauge hero shot.
        tap("TODAY'S SAFETY")
        compose.waitUntil(30_000) { visible("Higher is safer") || visible("SAFETY FACTORS") }
        compose.waitForIdle()
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
