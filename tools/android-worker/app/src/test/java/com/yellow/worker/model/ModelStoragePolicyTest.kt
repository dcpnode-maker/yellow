package com.yellow.worker.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelStoragePolicyTest {
    @Test
    fun `model requires its remaining bytes plus eight GiB`() {
        val remaining = 9_000_000_000L
        val required = remaining + ModelStoragePolicy.FREE_SPACE_RESERVE_BYTES

        assertFalse(ModelStoragePolicy.canFit(required - 1, remaining))
        assertTrue(ModelStoragePolicy.canFit(required, remaining))
    }
}
