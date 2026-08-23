package com.yellow.worker.work

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.model.ModelCatalog
import com.yellow.worker.model.ModelUiPolicy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class WorkerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_PAUSE && intent.action != ACTION_RESUME) return

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val preferences = WorkerPreferences(context)
                when (intent.action) {
                    ACTION_PAUSE -> {
                        preferences.pause()
                        WorkerScheduler.cancelAll(context)
                    }
                    ACTION_RESUME -> {
                        val state = preferences.current()
                        preferences.arm()
                        if (state.activeModelId == null && state.preparingModelId != null) {
                            val index = ModelCatalog.candidates
                                .indexOfFirst { it.id == state.preparingModelId }
                                .takeIf { it >= 0 } ?: 0
                            WorkerScheduler.prepareModel(context, index)
                        } else if (
                            ModelUiPolicy.isUpgradeInProgress(
                                state.preparingModelId,
                                state.activeModelId,
                            )
                        ) {
                            val index = ModelCatalog.candidates.indexOfFirst {
                                it.id == ModelCatalog.CODER_7B_COMPACT
                            }.takeIf { it >= 0 } ?: 0
                            WorkerScheduler.prepareModel(
                                context,
                                candidateIndex = index,
                                repairedEnginePromotion = true,
                            )
                        }
                        WorkerScheduler.enqueue(context)
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val ACTION_PAUSE = "com.yellow.worker.action.PAUSE"
        const val ACTION_RESUME = "com.yellow.worker.action.RESUME"
    }
}
