package com.yellow.worker.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ModelSelectionPolicyTest {
    @Test
    fun `first preparation tries 14B`() {
        assertEquals(0, ModelSelectionPolicy.candidateIndex(0, interruptedBenchmark = false))
    }

    @Test
    fun `each interrupted candidate advances exactly once`() {
        for (index in 0 until ModelCatalog.candidates.lastIndex) {
            assertEquals(
                index + 1,
                ModelSelectionPolicy.candidateIndex(index, interruptedBenchmark = true),
            )
            assertEquals(index + 1, ModelSelectionPolicy.fallbackAfter(index))
        }
    }

    @Test
    fun `persisted attempts walk the full ladder without looping`() {
        var selected: Int? = 0
        repeat(ModelCatalog.candidates.lastIndex) {
            selected = ModelSelectionPolicy.candidateIndex(
                requestedIndex = checkNotNull(selected),
                interruptedBenchmark = true,
            )
        }

        assertEquals(ModelCatalog.candidates.lastIndex, selected)
        assertNull(
            ModelSelectionPolicy.candidateIndex(
                requestedIndex = checkNotNull(selected),
                interruptedBenchmark = true,
            ),
        )
    }

    @Test
    fun `there is no candidate after final fallback`() {
        val finalIndex = ModelCatalog.candidates.lastIndex
        assertNull(ModelSelectionPolicy.fallbackAfter(finalIndex))
        assertNull(ModelSelectionPolicy.candidateIndex(finalIndex, interruptedBenchmark = true))
        assertNull(
            ModelSelectionPolicy.candidateIndex(
                ModelCatalog.candidates.size,
                interruptedBenchmark = false,
            ),
        )
        assertNull(ModelSelectionPolicy.fallbackAfter(-1))
    }

    @Test
    fun `repaired promotion starts at compact 7B and falls forward once`() {
        val compact7BIndex = ModelCatalog.candidates.indexOfFirst {
            it.id == ModelCatalog.CODER_7B_COMPACT
        }

        assertEquals(2, compact7BIndex)
        assertEquals(
            compact7BIndex,
            ModelSelectionPolicy.candidateIndex(
                requestedIndex = compact7BIndex,
                interruptedBenchmark = false,
            ),
        )
        val retainedFallbackIndex = ModelSelectionPolicy.candidateIndex(
            requestedIndex = compact7BIndex,
            interruptedBenchmark = true,
        )
        assertEquals(ModelCatalog.candidates.lastIndex, retainedFallbackIndex)
        assertNull(
            ModelSelectionPolicy.candidateIndex(
                requestedIndex = checkNotNull(retainedFallbackIndex),
                interruptedBenchmark = true,
            ),
        )
    }
}
