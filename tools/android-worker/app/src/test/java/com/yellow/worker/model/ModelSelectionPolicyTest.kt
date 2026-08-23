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
    fun `interrupted 14B benchmark moves to 7B`() {
        assertEquals(1, ModelSelectionPolicy.candidateIndex(0, interruptedBenchmark = true))
        assertEquals(1, ModelSelectionPolicy.fallbackAfter(0))
    }

    @Test
    fun `there is no candidate after 7B`() {
        assertNull(ModelSelectionPolicy.fallbackAfter(1))
        assertNull(ModelSelectionPolicy.candidateIndex(2, interruptedBenchmark = false))
        assertNull(ModelSelectionPolicy.candidateIndex(1, interruptedBenchmark = true))
    }
}
