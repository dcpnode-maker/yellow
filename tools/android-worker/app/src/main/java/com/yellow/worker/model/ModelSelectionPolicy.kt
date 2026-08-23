package com.yellow.worker.model

object ModelSelectionPolicy {
    fun candidateIndex(requestedIndex: Int, interruptedBenchmark: Boolean): Int? = when {
        requestedIndex !in ModelCatalog.candidates.indices -> null
        requestedIndex == 0 && interruptedBenchmark -> 1
        interruptedBenchmark -> null
        else -> requestedIndex
    }

    fun fallbackAfter(index: Int): Int? = if (index == 0) 1 else null
}
