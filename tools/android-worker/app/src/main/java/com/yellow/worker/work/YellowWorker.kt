package com.yellow.worker.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.domain.BlockReason
import com.yellow.worker.domain.DeviceSafety
import com.yellow.worker.domain.GateDecision
import com.yellow.worker.domain.GateSnapshot
import com.yellow.worker.domain.RunGate
import com.yellow.worker.model.ModelCatalog
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout

class YellowWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : CoroutineWorker(appContext, workerParameters) {

    override suspend fun doWork(): Result {
        val preferences = WorkerPreferences(applicationContext)
        val savedState = preferences.current()
        if (savedState.manuallyPaused) {
            preferences.setStatus(WorkerStatus.PAUSED)
            return Result.success()
        }

        report(preferences, WorkerStatus.CHECKING_SAFETY)
        when (val decision = RunGate.evaluate(readGateSnapshot(savedState.manuallyPaused))) {
            GateDecision.Allowed -> Unit
            is GateDecision.Blocked -> {
                val status = decision.reason.toWorkerStatus()
                preferences.setStatus(status)
                return if (decision.reason == BlockReason.MANUAL_PAUSE) {
                    Result.success()
                } else {
                    Result.retry()
                }
            }
        }

        var engine: InferenceEngine? = null
        try {
            engine = AiChat.getInferenceEngine(applicationContext)
            val nativeState = withTimeout(NATIVE_INIT_TIMEOUT_MS) {
                engine.state.first { state ->
                    state is InferenceEngine.State.Initialized ||
                        state is InferenceEngine.State.Error
                }
            }
            if (nativeState is InferenceEngine.State.Error) {
                preferences.setStatus(WorkerStatus.ERROR)
                return Result.failure()
            }

            report(preferences, WorkerStatus.NATIVE_ENGINE_READY)
            val activeModel = ModelCatalog.byId(preferences.current().activeModelId)
            if (activeModel == null) {
                report(preferences, WorkerStatus.WAITING_FOR_MODEL)
                return Result.success()
            }

            // Order 030 prepares and benchmarks the model. Signed, bounded jobs remain
            // disabled until Order 031, so ordinary work stops at ready state.
            report(preferences, WorkerStatus.MODEL_READY)
            return Result.success()
        } catch (timeout: TimeoutCancellationException) {
            preferences.setStatus(WorkerStatus.ERROR)
            return Result.failure()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            preferences.setStatus(WorkerStatus.ERROR)
            return Result.failure()
        } finally {
            engine?.let { inferenceEngine -> runCatching { inferenceEngine.cleanUp() } }
        }
    }

    private suspend fun report(
        preferences: WorkerPreferences,
        status: WorkerStatus,
    ) {
        preferences.setStatus(status)
        setForeground(WorkerNotification.foregroundInfo(applicationContext, status.displayText))
    }

    private fun readGateSnapshot(manuallyPaused: Boolean): GateSnapshot {
        return DeviceSafety.snapshot(applicationContext, manuallyPaused)
    }

    private fun BlockReason.toWorkerStatus(): WorkerStatus = when (this) {
        BlockReason.MANUAL_PAUSE -> WorkerStatus.PAUSED
        BlockReason.DEVICE_IN_USE -> WorkerStatus.BLOCKED_PHONE_IN_USE
        BlockReason.NOT_CHARGING -> WorkerStatus.BLOCKED_NOT_CHARGING
        BlockReason.THERMAL_LIMIT -> WorkerStatus.COOLING_DOWN
        BlockReason.UNKNOWN_THERMAL_STATE -> WorkerStatus.BLOCKED_UNKNOWN_THERMAL
    }

    companion object {
        private const val NATIVE_INIT_TIMEOUT_MS = 60_000L
    }
}
