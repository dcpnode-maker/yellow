package com.yellow.worker.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ModelLoadDiagnosticTest {
    @Test
    fun `native failure reports measured inputs without claiming a root cause`() {
        val model = ModelCatalog.candidates[2]

        assertEquals(
            "Native model load failed: 4.36 GiB weights, 3.50 GiB RAM available before load " +
                "(the engine reports a generic architecture exception)",
            ModelLoadDiagnostic.nativeFailure(
                model = model,
                availableRamBytes = 3_758_096_384L,
            ),
        )
    }
}
