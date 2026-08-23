package com.yellow.worker.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelCatalogTest {
    @Test
    fun `catalog pins exact official model identities`() {
        assertEquals(2, ModelCatalog.candidates.size)
        assertEquals(
            PinnedModel(
                id = ModelCatalog.CODER_14B,
                displayName = "Qwen2.5 Coder 14B Q4_K_M",
                repository = "Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
                revision = "d0a692ef765eefbf2fabb130b3cb2e8917e3d225",
                fileName = "qwen2.5-coder-14b-instruct-q4_k_m.gguf",
                sizeBytes = 8_988_110_272L,
                sha256 = "c1e659736d89ac1065fb495330fb824d94001974a4bfa78e7270e43476a8d940",
            ),
            ModelCatalog.candidates[0],
        )
        assertEquals(
            PinnedModel(
                id = ModelCatalog.CODER_7B,
                displayName = "Qwen2.5 Coder 7B Q6_K",
                repository = "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
                revision = "13fb94bfda8c8cf22497dc57b78f391a9acb426a",
                fileName = "qwen2.5-coder-7b-instruct-q6_k.gguf",
                sizeBytes = 6_254_198_784L,
                sha256 = "46291ddea1bfb608fe63d9a1907eea6918bda87a7626593edc4bf97c5fd73f9d",
            ),
            ModelCatalog.candidates[1],
        )
        assertTrue(ModelCatalog.candidates.all { it.downloadUrl.startsWith("https://huggingface.co/") })
        assertTrue(ModelCatalog.candidates.all { "/resolve/${it.revision}/" in it.downloadUrl })
    }
}
