package com.yellow.worker.model

import java.io.File

data class FailedModelCleanupResult(
    val reclaimedBytes: Long,
    val failedFileNames: List<String>,
) {
    val complete: Boolean
        get() = failedFileNames.isEmpty()
}

object FailedModelCleanup {
    fun delete(directory: File, model: PinnedModel): FailedModelCleanupResult {
        require(model.fileName == File(model.fileName).name) {
            "model filename must not contain a path"
        }

        var reclaimedBytes = 0L
        val failedFileNames = mutableListOf<String>()
        val targets = listOf(
            File(directory, model.fileName),
            File(directory, "${model.fileName}.part"),
        )
        targets.forEach { target ->
            if (!target.exists()) return@forEach
            val length = if (target.isFile) target.length() else 0L
            if (target.isFile && target.delete()) {
                reclaimedBytes += length
            } else {
                failedFileNames += target.name
            }
        }
        return FailedModelCleanupResult(
            reclaimedBytes = reclaimedBytes,
            failedFileNames = failedFileNames,
        )
    }
}
