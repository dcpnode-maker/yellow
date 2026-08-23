package com.yellow.worker.work

import android.content.Context
import android.os.BatteryManager
import android.os.PowerManager
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import com.arm.aichat.isModelLoaded
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.domain.BlockReason
import com.yellow.worker.domain.GateDecision
import com.yellow.worker.domain.GateSnapshot
import com.yellow.worker.domain.RunGate
import com.yellow.worker.domain.ThermalLevel
import java.io.File
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
            val model = File(File(applicationContext.filesDir, MODEL_DIRECTORY), ACTIVE_MODEL_NAME)
            if (!model.isFile) {
                report(preferences, WorkerStatus.WAITING_FOR_MODEL)
                return Result.success()
            }

            // Order 028 proves native readiness only. Order 029 must validate and benchmark
            // a model before any model load or inference is permitted.
            report(preferences, WorkerStatus.MODEL_PRESENT_NOT_ENABLED)
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
            engine?.let { inferenceEngine ->
                if (inferenceEngine.state.value.isModelLoaded) {
                    runCatching { inferenceEngine.cleanUp() }
                }
            }
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
        val powerManager = applicationContext.getSystemService(PowerManager::class.java)
        val batteryManager = applicationContext.getSystemService(BatteryManager::class.java)
        return GateSnapshot(
            manuallyPaused = manuallyPaused,
            deviceInteractive = powerManager?.isInteractive ?: true,
            charging = batteryManager?.isCharging ?: false,
            thermalLevel = powerManager?.currentThermalStatus.toThermalLevel(),
        )
    }

    private fun Int?.toThermalLevel(): ThermalLevel = when (this) {
        PowerManager.THERMAL_STATUS_NONE -> ThermalLevel.NONE
        PowerManager.THERMAL_STATUS_LIGHT -> ThermalLevel.LIGHT
        PowerManager.THERMAL_STATUS_MODERATE -> ThermalLevel.MODERATE
        PowerManager.THERMAL_STATUS_SEVERE -> ThermalLevel.SEVERE
        PowerManager.THERMAL_STATUS_CRITICAL -> ThermalLevel.CRITICAL
        PowerManager.THERMAL_STATUS_EMERGENCY -> ThermalLevel.EMERGENCY
        PowerManager.THERMAL_STATUS_SHUTDOWN -> ThermalLevel.SHUTDOWN
        else -> ThermalLevel.UNKNOWN
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
        private const val MODEL_DIRECTORY = "models"
        private const val ACTIVE_MODEL_NAME = "active.gguf"
    }
}
