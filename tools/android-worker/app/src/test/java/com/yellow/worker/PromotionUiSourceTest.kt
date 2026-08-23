package com.yellow.worker

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class PromotionUiSourceTest {
    @Test
    fun `activity wires visible promotion progress fallback and pause controls`() {
        val source = readMainActivity()

        assertTrue(source.contains("R.string.test_stronger_model"))
        assertTrue(source.contains("ModelUiPolicy.shouldShowProgress"))
        assertTrue(source.contains("Fallback ready:"))
        assertTrue(source.contains("R.id.pause_button"))
    }

    private fun readMainActivity(): String {
        val source = listOf(
            File("app/src/main/java/com/yellow/worker/MainActivity.kt"),
            File("src/main/java/com/yellow/worker/MainActivity.kt"),
        ).firstOrNull { it.isFile }
        checkNotNull(source) { "Could not locate MainActivity from ${File(".").absolutePath}" }
        return source.readText()
    }
}
