package com.yellow.worker.model

import java.io.File
import java.io.IOException

data class RepairedEnginePromotionResult(
    val applied: Boolean,
    val compact7BMarkerCleared: Boolean,
)

object RepairedEnginePromotion {
    const val PROMOTION_SENTINEL = ".repaired-engine-7b-q4-promotion-v1"

    fun isAvailable(directory: File, activeModelId: String?): Boolean =
        activeModelId == ModelCatalog.CODER_1_5B &&
            File(directory, NativeBackendRepair.REPAIR_SENTINEL).isFile &&
            compact7BMarker(directory).isFile &&
            !File(directory, PROMOTION_SENTINEL).exists()

    fun hasInterruptedAttempt(directory: File): Boolean =
        File(directory, PROMOTION_SENTINEL).isFile && compact7BMarker(directory).exists()

    fun rearmCompact7BOnce(
        directory: File,
        activeModelId: String?,
    ): RepairedEnginePromotionResult {
        if (activeModelId != ModelCatalog.CODER_1_5B) return notApplied()
        if (!directory.isDirectory) {
            throw IOException("Model directory is unavailable for repaired-engine promotion")
        }
        val repairSentinel = File(directory, NativeBackendRepair.REPAIR_SENTINEL)
        if (!repairSentinel.isFile) {
            throw IOException("Repaired native engine evidence is unavailable")
        }

        val sentinel = File(directory, PROMOTION_SENTINEL)
        if (sentinel.exists()) {
            if (!sentinel.isFile) {
                throw IOException("Repaired-engine promotion sentinel is not a file")
            }
            return notApplied()
        }

        val marker = compact7BMarker(directory)
        if (!marker.exists()) return notApplied()
        if (!marker.isFile) {
            throw IOException("7B Q4 attempt marker is not a file")
        }
        if (!sentinel.createNewFile()) {
            throw IOException("Could not persist repaired-engine promotion sentinel")
        }
        if (!marker.delete()) {
            val sentinelRolledBack = sentinel.delete()
            val detail = if (sentinelRolledBack) {
                ""
            } else {
                "; could not roll back the promotion sentinel"
            }
            throw IOException("Could not rearm repaired 7B Q4 promotion$detail")
        }
        return RepairedEnginePromotionResult(
            applied = true,
            compact7BMarkerCleared = true,
        )
    }

    private fun compact7BMarker(directory: File) = File(
        directory,
        "${ModelCatalog.CODER_7B_COMPACT}.benchmark-inflight",
    )

    private fun notApplied() = RepairedEnginePromotionResult(
        applied = false,
        compact7BMarkerCleared = false,
    )
}
