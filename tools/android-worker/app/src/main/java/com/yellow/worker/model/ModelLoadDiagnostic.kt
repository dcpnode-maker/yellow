package com.yellow.worker.model

import java.util.Locale

object ModelLoadDiagnostic {
    fun nativeFailure(model: PinnedModel, availableRamBytes: Long): String = String.format(
        Locale.US,
        "Native model load failed: %.2f GiB weights, %.2f GiB RAM available before load " +
            "(the engine reports a generic architecture exception)",
        model.sizeBytes.toDouble() / GIB.toDouble(),
        availableRamBytes.coerceAtLeast(0L).toDouble() / GIB.toDouble(),
    )

    private const val GIB = 1024L * 1024L * 1024L
}
