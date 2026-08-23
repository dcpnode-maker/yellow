package com.yellow.worker.model

data class PinnedModel(
    val id: String,
    val displayName: String,
    val repository: String,
    val revision: String,
    val fileName: String,
    val sizeBytes: Long,
    val sha256: String,
) {
    val downloadUrl: String
        get() = "https://huggingface.co/$repository/resolve/$revision/$fileName?download=true"
}

object ModelCatalog {
    const val CODER_14B = "qwen2.5-coder-14b-q4-k-m"
    const val CODER_7B = "qwen2.5-coder-7b-q6-k"
    const val CODER_7B_COMPACT = "qwen2.5-coder-7b-q4-k-m"
    const val CODER_1_5B = "qwen2.5-coder-1.5b-q8-0"

    val candidates: List<PinnedModel> = listOf(
        PinnedModel(
            id = CODER_14B,
            displayName = "Qwen2.5 Coder 14B Q4_K_M",
            repository = "Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
            revision = "d0a692ef765eefbf2fabb130b3cb2e8917e3d225",
            fileName = "qwen2.5-coder-14b-instruct-q4_k_m.gguf",
            sizeBytes = 8_988_110_272L,
            sha256 = "c1e659736d89ac1065fb495330fb824d94001974a4bfa78e7270e43476a8d940",
        ),
        PinnedModel(
            id = CODER_7B,
            displayName = "Qwen2.5 Coder 7B Q6_K",
            repository = "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
            revision = "13fb94bfda8c8cf22497dc57b78f391a9acb426a",
            fileName = "qwen2.5-coder-7b-instruct-q6_k.gguf",
            sizeBytes = 6_254_198_784L,
            sha256 = "46291ddea1bfb608fe63d9a1907eea6918bda87a7626593edc4bf97c5fd73f9d",
        ),
        PinnedModel(
            id = CODER_7B_COMPACT,
            displayName = "Qwen2.5 Coder 7B Q4_K_M",
            repository = "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
            revision = "13fb94bfda8c8cf22497dc57b78f391a9acb426a",
            fileName = "qwen2.5-coder-7b-instruct-q4_k_m.gguf",
            sizeBytes = 4_683_073_536L,
            sha256 = "509287f78cb4d4cf6b3843734733b914b2c158e43e22a7f4bf5e963800894d3c",
        ),
        PinnedModel(
            id = CODER_1_5B,
            displayName = "Qwen2.5 Coder 1.5B Q8_0",
            repository = "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
            revision = "2ab9f8f42af02fc212effaef7c4850c885e965f4",
            fileName = "qwen2.5-coder-1.5b-instruct-q8_0.gguf",
            sizeBytes = 1_894_532_160L,
            sha256 = "507de59046601282ba768a9789900e6ccf60ed93ddf346730b7c68eb0715bc47",
        ),
    )

    fun at(index: Int): PinnedModel? = candidates.getOrNull(index)

    fun byId(id: String?): PinnedModel? = candidates.firstOrNull { it.id == id }
}
