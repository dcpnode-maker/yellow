package com.yellow.worker.model

import java.io.File
import java.io.IOException

data class NativeBackendRepairResult(
    val applied: Boolean,
    val diagnosticMarkerCleared: Boolean,
)

object NativeBackendRepair {
    const val REPAIR_SENTINEL = ".native-backend-extraction-v1"

    fun rearmDiagnosticOnce(directory: File): NativeBackendRepairResult {
        if (!directory.isDirectory && !directory.mkdirs()) {
            throw IOException("Could not create model directory for native backend repair")
        }

        val sentinel = File(directory, REPAIR_SENTINEL)
        if (sentinel.exists()) {
            if (!sentinel.isFile) {
                throw IOException("Native backend repair sentinel is not a file")
            }
            return NativeBackendRepairResult(
                applied = false,
                diagnosticMarkerCleared = false,
            )
        }

        val diagnosticMarker = File(
            directory,
            "${ModelCatalog.CODER_1_5B}.benchmark-inflight",
        )
        val markerCleared = diagnosticMarker.exists()
        if (markerCleared && (!diagnosticMarker.isFile || !diagnosticMarker.delete())) {
            throw IOException("Could not rearm repaired 1.5B diagnostic")
        }
        if (!sentinel.createNewFile()) {
            throw IOException("Could not persist native backend repair sentinel")
        }

        return NativeBackendRepairResult(
            applied = true,
            diagnosticMarkerCleared = markerCleared,
        )
    }
}
