package com.yellow.worker.model

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FailedModelCleanupTest {
    @Test
    fun `cleanup removes only selected final and partial weights`() {
        val directory = Files.createTempDirectory("yellow-model-cleanup").toFile()
        val model = ModelCatalog.candidates.first()
        val finalFile = File(directory, model.fileName).apply { writeText("yellow") }
        val partialFile = File(directory, "${model.fileName}.part").apply { writeText("worker") }
        val marker = File(directory, "${model.id}.benchmark-inflight").apply { writeText("") }
        val unrelated = File(directory, "keep-me.gguf").apply { writeText("safe") }

        try {
            val result = FailedModelCleanup.delete(directory, model)

            assertTrue(result.complete)
            assertEquals(12L, result.reclaimedBytes)
            assertFalse(finalFile.exists())
            assertFalse(partialFile.exists())
            assertTrue(marker.exists())
            assertTrue(unrelated.exists())
        } finally {
            marker.delete()
            unrelated.delete()
            directory.delete()
        }
    }

    @Test
    fun `cleanup rejects a filename containing a path`() {
        val directory = Files.createTempDirectory("yellow-model-cleanup-path").toFile()
        var rejected = false
        try {
            try {
                FailedModelCleanup.delete(
                    directory,
                    ModelCatalog.candidates.first().copy(fileName = "../outside.gguf"),
                )
            } catch (_: IllegalArgumentException) {
                rejected = true
            }
            assertTrue(rejected)
        } finally {
            directory.delete()
        }
    }
}
