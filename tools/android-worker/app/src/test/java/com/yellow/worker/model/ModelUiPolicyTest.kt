package com.yellow.worker.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelUiPolicyTest {
    @Test
    fun `promotion progress stays visible while fallback is active`() {
        assertTrue(
            ModelUiPolicy.isUpgradeInProgress(
                ModelCatalog.CODER_7B_COMPACT,
                ModelCatalog.CODER_1_5B,
            ),
        )
        assertTrue(
            ModelUiPolicy.shouldShowProgress(
                ModelCatalog.CODER_7B_COMPACT,
                ModelCatalog.CODER_1_5B,
            ),
        )
    }

    @Test
    fun `ordinary preparation shows progress but a ready model does not`() {
        assertFalse(ModelUiPolicy.isUpgradeInProgress(ModelCatalog.CODER_1_5B, null))
        assertTrue(ModelUiPolicy.shouldShowProgress(ModelCatalog.CODER_1_5B, null))
        assertFalse(
            ModelUiPolicy.shouldShowProgress(
                ModelCatalog.CODER_1_5B,
                ModelCatalog.CODER_1_5B,
            ),
        )
        assertFalse(ModelUiPolicy.shouldShowProgress(null, ModelCatalog.CODER_1_5B))
    }
}
