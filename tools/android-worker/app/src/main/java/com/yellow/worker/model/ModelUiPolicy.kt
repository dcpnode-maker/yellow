package com.yellow.worker.model

object ModelUiPolicy {
    fun isUpgradeInProgress(preparingModelId: String?, activeModelId: String?): Boolean =
        preparingModelId != null && activeModelId != null && preparingModelId != activeModelId

    fun shouldShowProgress(preparingModelId: String?, activeModelId: String?): Boolean =
        preparingModelId != null && preparingModelId != activeModelId
}
