package com.yellow.worker.model

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RepairedEnginePromotionTest {
    @Test
    fun `promotion rearms only compact 7B once and preserves fallback`() {
        val directory = Files.createTempDirectory("yellow-repaired-promotion").toFile()
        val markers = ModelCatalog.candidates.associateWith { model ->
            File(directory, "${model.id}.benchmark-inflight").apply { writeText("") }
        }
        val fallback = checkNotNull(ModelCatalog.byId(ModelCatalog.CODER_1_5B))
        val fallbackWeight = File(directory, fallback.fileName).apply { writeText("verified") }
        val unrelated = File(directory, "keep-me.txt").apply { writeText("safe") }
        File(directory, NativeBackendRepair.REPAIR_SENTINEL).writeText("")

        try {
            assertTrue(
                RepairedEnginePromotion.isAvailable(directory, ModelCatalog.CODER_1_5B),
            )

            val first = RepairedEnginePromotion.rearmCompact7BOnce(
                directory,
                ModelCatalog.CODER_1_5B,
            )

            assertTrue(first.applied)
            assertTrue(first.compact7BMarkerCleared)
            val compactMarker = checkNotNull(
                markers[checkNotNull(ModelCatalog.byId(ModelCatalog.CODER_7B_COMPACT))],
            )
            assertFalse(compactMarker.exists())
            ModelCatalog.candidates
                .filterNot { it.id == ModelCatalog.CODER_7B_COMPACT }
                .forEach { model -> assertTrue(checkNotNull(markers[model]).exists()) }
            assertTrue(fallbackWeight.exists())
            assertTrue(unrelated.exists())
            assertTrue(File(directory, RepairedEnginePromotion.PROMOTION_SENTINEL).isFile)

            compactMarker.writeText("")
            assertTrue(RepairedEnginePromotion.hasInterruptedAttempt(directory))
            val second = RepairedEnginePromotion.rearmCompact7BOnce(
                directory,
                ModelCatalog.CODER_1_5B,
            )

            assertFalse(second.applied)
            assertFalse(second.compact7BMarkerCleared)
            assertTrue(compactMarker.exists())
        } finally {
            directory.deleteRecursively()
        }
    }

    @Test
    fun `promotion rejects an inactive fallback without changing files`() {
        val directory = Files.createTempDirectory("yellow-repaired-promotion-inactive").toFile()
        val compactMarker = File(
            directory,
            "${ModelCatalog.CODER_7B_COMPACT}.benchmark-inflight",
        ).apply { writeText("") }
        File(directory, NativeBackendRepair.REPAIR_SENTINEL).writeText("")

        try {
            assertFalse(RepairedEnginePromotion.isAvailable(directory, ModelCatalog.CODER_7B))
            val result = RepairedEnginePromotion.rearmCompact7BOnce(
                directory,
                ModelCatalog.CODER_7B,
            )

            assertFalse(result.applied)
            assertFalse(result.compact7BMarkerCleared)
            assertTrue(compactMarker.exists())
            assertFalse(File(directory, RepairedEnginePromotion.PROMOTION_SENTINEL).exists())
        } finally {
            directory.deleteRecursively()
        }
    }
}
