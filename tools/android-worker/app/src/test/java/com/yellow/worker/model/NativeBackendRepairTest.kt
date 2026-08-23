package com.yellow.worker.model

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeBackendRepairTest {
    @Test
    fun `repair rearms only the final diagnostic exactly once`() {
        val directory = Files.createTempDirectory("yellow-native-backend-repair").toFile()
        val markers = ModelCatalog.candidates.associateWith { model ->
            File(directory, "${model.id}.benchmark-inflight").apply { writeText("") }
        }
        val unrelated = File(directory, "keep-me.txt").apply { writeText("safe") }

        try {
            val first = NativeBackendRepair.rearmDiagnosticOnce(directory)

            assertTrue(first.applied)
            assertTrue(first.diagnosticMarkerCleared)
            ModelCatalog.candidates.dropLast(1).forEach { model ->
                assertTrue(checkNotNull(markers[model]).exists())
            }
            val diagnosticMarker = checkNotNull(markers[ModelCatalog.candidates.last()])
            assertFalse(diagnosticMarker.exists())
            assertTrue(unrelated.exists())
            assertTrue(File(directory, NativeBackendRepair.REPAIR_SENTINEL).isFile)

            diagnosticMarker.writeText("")
            val second = NativeBackendRepair.rearmDiagnosticOnce(directory)

            assertFalse(second.applied)
            assertFalse(second.diagnosticMarkerCleared)
            assertTrue(diagnosticMarker.exists())
        } finally {
            directory.listFiles()?.forEach { it.delete() }
            directory.delete()
        }
    }

    @Test
    fun `fresh install is marked repaired without changing future failures`() {
        val directory = Files.createTempDirectory("yellow-native-backend-fresh").toFile()
        val diagnosticMarker = File(
            directory,
            "${ModelCatalog.CODER_1_5B}.benchmark-inflight",
        )

        try {
            val first = NativeBackendRepair.rearmDiagnosticOnce(directory)
            assertTrue(first.applied)
            assertFalse(first.diagnosticMarkerCleared)

            diagnosticMarker.writeText("")
            NativeBackendRepair.rearmDiagnosticOnce(directory)
            assertTrue(diagnosticMarker.exists())
        } finally {
            directory.listFiles()?.forEach { it.delete() }
            directory.delete()
        }
    }
}
