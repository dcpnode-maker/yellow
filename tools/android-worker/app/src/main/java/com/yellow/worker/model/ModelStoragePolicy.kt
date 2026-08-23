package com.yellow.worker.model

object ModelStoragePolicy {
    const val FREE_SPACE_RESERVE_BYTES = 8L * 1024L * 1024L * 1024L

    fun canFit(availableBytes: Long, remainingModelBytes: Long): Boolean =
        availableBytes >= remainingModelBytes.coerceAtLeast(0) + FREE_SPACE_RESERVE_BYTES
}
