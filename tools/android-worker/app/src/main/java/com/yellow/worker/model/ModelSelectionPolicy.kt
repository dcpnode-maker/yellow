package com.yellow.worker.model

object ModelSelectionPolicy {
    fun candidateIndex(requestedIndex: Int, interruptedBenchmark: Boolean): Int? {
        if (requestedIndex !in ModelCatalog.candidates.indices) return null
        return if (interruptedBenchmark) fallbackAfter(requestedIndex) else requestedIndex
    }

    fun fallbackAfter(index: Int): Int? = when {
        index !in ModelCatalog.candidates.indices -> null
        index == ModelCatalog.candidates.lastIndex -> null
        else -> index + 1
    }
}
