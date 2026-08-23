package com.yellow.worker.privacy

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ManifestPrivacyTest {
    @Test
    fun `source manifest contains only approved active permissions`() {
        val manifest = readManifest()
        val declarations = Regex("<uses-permission\\b[^>]*/>").findAll(manifest).map { it.value }
        val activePermissions = declarations
            .filterNot { it.contains("tools:node=\"remove\"") }
            .mapNotNull { declaration ->
                Regex("android:name=\"([^\"]+)\"").find(declaration)?.groupValues?.get(1)
            }
            .toSet()

        assertTrue(
            "Unexpected active permissions: ${activePermissions - ALLOWED_SOURCE_PERMISSIONS}",
            activePermissions.all { it in ALLOWED_SOURCE_PERMISSIONS },
        )
        assertTrue(manifest.contains("android.permission.RECEIVE_BOOT_COMPLETED"))
        assertTrue(manifest.contains("tools:node=\"remove\""))

        FORBIDDEN_PERSONAL_PERMISSION_MARKERS.forEach { marker ->
            assertFalse("Forbidden permission marker found: $marker", activePermissions.any { marker in it })
        }
    }

    @Test
    fun `pause receiver is explicitly non-exported`() {
        val manifest = readManifest()
        val receiver = Regex(
            "<receiver[^>]*WorkerActionReceiver[^>]*/>",
            setOf(RegexOption.DOT_MATCHES_ALL),
        ).find(manifest)

        assertNotNull("WorkerActionReceiver declaration missing", receiver)
        assertTrue(receiver!!.value.contains("android:exported=\"false\""))
    }

    @Test
    fun `native CPU backends are extracted for llama dynamic discovery`() {
        val manifest = readManifest()
        val application = Regex(
            "<application\\b[^>]*>",
            setOf(RegexOption.DOT_MATCHES_ALL),
        ).find(manifest)

        assertNotNull("Application declaration missing", application)
        assertTrue(application!!.value.contains("android:extractNativeLibs=\"true\""))
    }

    private fun readManifest(): String {
        val manifest = listOf(
            File("app/src/main/AndroidManifest.xml"),
            File("src/main/AndroidManifest.xml"),
        ).firstOrNull { it.isFile }
        checkNotNull(manifest) { "Could not locate app source manifest from ${File(".").absolutePath}" }
        return manifest.readText()
    }

    companion object {
        private val ALLOWED_SOURCE_PERMISSIONS = setOf(
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
        )

        private val FORBIDDEN_PERSONAL_PERMISSION_MARKERS = setOf(
            "READ_EXTERNAL_STORAGE",
            "WRITE_EXTERNAL_STORAGE",
            "MANAGE_EXTERNAL_STORAGE",
            "READ_MEDIA",
            "CONTACTS",
            "SMS",
            "CALL_LOG",
            "READ_PHONE_STATE",
            "RECORD_AUDIO",
            "CAMERA",
            "LOCATION",
            "BIND_ACCESSIBILITY_SERVICE",
            "BIND_NOTIFICATION_LISTENER_SERVICE",
            "PACKAGE_USAGE_STATS",
            "SYSTEM_ALERT_WINDOW",
            "BIND_DEVICE_ADMIN",
        )
    }
}
