package com.yellow.worker.work

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.os.StatFs
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import com.arm.aichat.UnsupportedArchitectureException
import com.arm.aichat.isModelLoaded
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.domain.BlockReason
import com.yellow.worker.domain.DeviceSafety
import com.yellow.worker.domain.GateDecision
import com.yellow.worker.domain.GateProfile
import com.yellow.worker.domain.RunGate
import com.yellow.worker.domain.SafetyDiagnostic
import com.yellow.worker.model.BenchmarkAssessment
import com.yellow.worker.model.BenchmarkGate
import com.yellow.worker.model.FailedModelCleanup
import com.yellow.worker.model.ModelCatalog
import com.yellow.worker.model.ModelDownloadProgress
import com.yellow.worker.model.ModelDownloadStage
import com.yellow.worker.model.ModelLoadDiagnostic
import com.yellow.worker.model.ModelSelectionPolicy
import com.yellow.worker.model.ModelStoragePolicy
import com.yellow.worker.model.NativeBackendRepair
import com.yellow.worker.model.PinnedModel
import com.yellow.worker.model.ResumableModelDownloader
import java.io.File
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout

class PrepareModelWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : CoroutineWorker(appContext, workerParameters) {
    private val preferences = WorkerPreferences(applicationContext)
    private val modelDirectory = File(applicationContext.filesDir, MODEL_DIRECTORY)
    private val gateProfile = if (inputData.getBoolean(INPUT_MANUAL_TEST_MODE, false)) {
        GateProfile.MANUAL_MODEL_TEST
    } else {
        GateProfile.IDLE_WORK
    }

    override suspend fun doWork(): Result {
        val savedState = preferences.current()
        if (savedState.manuallyPaused) {
            preferences.setStatus(WorkerStatus.PAUSED)
            return Result.success()
        }

        val requestedIndex = inputData.getInt(INPUT_CANDIDATE_INDEX, 0)
        val candidateIndex = try {
            NativeBackendRepair.rearmDiagnosticOnce(modelDirectory)
            resolveCandidate(requestedIndex)
        } catch (error: IOException) {
            preferences.recordModelFailure(
                savedState.preparingModelId ?: ModelCatalog.CODER_14B,
                error.message ?: "Could not remove failed model files",
                WorkerStatus.ERROR,
            )
            return Result.retry()
        }
        if (candidateIndex == null) {
            preferences.setStatus(WorkerStatus.MODEL_FAILED)
            return Result.failure()
        }
        val candidate = checkNotNull(ModelCatalog.at(candidateIndex))
        val marker = benchmarkMarker(candidate)

        val blocked = checkSafety()
        if (blocked != null) return blocked

        preferences.beginModel(candidate.id, candidate.preparingStatus())
        report(candidate.preparingStatus())

        val finalModel = File(modelDirectory, candidate.fileName)
        val partial = File(modelDirectory, "${candidate.fileName}.part")
        val remainingBytes = if (finalModel.length() == candidate.sizeBytes) {
            0
        } else {
            (candidate.sizeBytes - partial.length()).coerceAtLeast(0)
        }
        if (!hasStorageFor(remainingBytes)) {
            markAttempted(marker)
            val result = handleCandidateFailure(
                candidateIndex,
                candidate,
                "Requires the remaining model bytes plus an 8 GiB safety reserve",
                terminalStatus = WorkerStatus.MODEL_STORAGE_LOW,
            )
            return finishFailedModelCleanup(candidate, result)
        }

        var engine: InferenceEngine? = null
        var ramBeforeLoad = RamSnapshot(totalBytes = 0L, availableBytes = 0L)
        var deleteFailedModelOnExit = false
        val result = try {
            val modelFile = ResumableModelDownloader().download(
                model = candidate,
                directory = modelDirectory,
                onProgress = ::onDownloadProgress,
            )

            checkSafety()?.let { return it }
            markAttempted(marker)
            val preparationStartedAt = SystemClock.elapsedRealtime()
            val startThermal = DeviceSafety.thermalLevel(applicationContext)
            report(WorkerStatus.LOADING_MODEL)
            val inferenceEngine = initializeEngine()
            engine = inferenceEngine
            ramBeforeLoad = readRamSnapshot()
            withTimeout(MODEL_LOAD_TIMEOUT_MS) {
                inferenceEngine.loadModel(modelFile.absolutePath)
            }

            checkSafety()?.let { return it }
            report(WorkerStatus.BENCHMARKING_MODEL)
            val benchmark = withTimeout(BENCHMARK_TIMEOUT_MS) {
                inferenceEngine.bench(
                    pp = BENCHMARK_PROMPT_TOKENS,
                    tg = BENCHMARK_GENERATION_TOKENS,
                    pl = 1,
                    nr = 1,
                )
            }
            val endSafety = readSafetySnapshot()
            when (
                val assessment = BenchmarkGate.assess(
                    benchmark,
                    endSafety,
                    gateProfile,
                )
            ) {
                is BenchmarkAssessment.Failed -> throw IOException(assessment.reason)
                is BenchmarkAssessment.Passed -> {
                    val evidence = buildEvidence(
                        model = candidate,
                        benchmark = benchmark,
                        startThermal = startThermal.name,
                        endThermal = endSafety.thermalLevel.name,
                        elapsedMillis = SystemClock.elapsedRealtime() - preparationStartedAt,
                        ram = ramBeforeLoad,
                    )
                    check(marker.delete() || !marker.exists()) { "could not clear benchmark marker" }
                    preferences.activateModel(candidate.id, evidence)
                    report(WorkerStatus.MODEL_READY)
                    WorkerScheduler.enqueue(applicationContext)
                    Result.success()
                }
            }
        } catch (timeout: TimeoutCancellationException) {
            deleteFailedModelOnExit = marker.exists()
            handleCandidateFailure(candidateIndex, candidate, "model preparation timed out")
        } catch (error: UnsupportedArchitectureException) {
            deleteFailedModelOnExit = marker.exists()
            val availableBytes = ramBeforeLoad.availableBytes.takeIf { it > 0L }
                ?: readRamSnapshot().availableBytes
            handleCandidateFailure(
                candidateIndex,
                candidate,
                ModelLoadDiagnostic.nativeFailure(candidate, availableBytes),
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            deleteFailedModelOnExit = marker.exists()
            handleCandidateFailure(
                candidateIndex,
                candidate,
                error.message ?: error.javaClass.simpleName,
            )
        } finally {
            engine?.let { inferenceEngine ->
                if (
                    inferenceEngine.state.value.isModelLoaded ||
                    inferenceEngine.state.value is InferenceEngine.State.Error
                ) {
                    runCatching { inferenceEngine.cleanUp() }
                }
            }
        }
        return if (deleteFailedModelOnExit) {
            finishFailedModelCleanup(candidate, result)
        } else {
            result
        }
    }

    private fun resolveCandidate(requestedIndex: Int): Int? {
        var current = requestedIndex
        repeat(ModelCatalog.candidates.size + 1) {
            val model = ModelCatalog.at(current) ?: return null
            if (benchmarkMarker(model).exists()) {
                val cleanup = FailedModelCleanup.delete(modelDirectory, model)
                if (!cleanup.complete) {
                    throw IOException(
                        "Could not remove failed model files: " +
                            cleanup.failedFileNames.joinToString(),
                    )
                }
            }
            val selected = ModelSelectionPolicy.candidateIndex(
                requestedIndex = current,
                interruptedBenchmark = benchmarkMarker(model).exists(),
            ) ?: return null
            if (selected == current) return selected
            current = selected
        }
        return null
    }

    private suspend fun finishFailedModelCleanup(candidate: PinnedModel, result: Result): Result {
        val cleanup = FailedModelCleanup.delete(modelDirectory, candidate)
        if (cleanup.complete) return result
        preferences.recordModelFailure(
            candidate.id,
            "Could not remove failed model files: ${cleanup.failedFileNames.joinToString()}",
            WorkerStatus.ERROR,
        )
        return Result.retry()
    }

    private suspend fun initializeEngine(): InferenceEngine {
        val engine = AiChat.getInferenceEngine(applicationContext)
        var state = withTimeout(NATIVE_INIT_TIMEOUT_MS) {
            engine.state.first { current ->
                current is InferenceEngine.State.Initialized ||
                    current is InferenceEngine.State.Error
            }
        }
        if (state is InferenceEngine.State.Error) {
            engine.cleanUp()
            state = engine.state.value
        }
        check(state is InferenceEngine.State.Initialized) { "native engine did not initialize" }
        return engine
    }

    private suspend fun onDownloadProgress(progress: ModelDownloadProgress) {
        when (progress.stage) {
            ModelDownloadStage.DOWNLOADING -> {
                val percent = if (progress.totalBytes == 0L) {
                    0
                } else {
                    ((progress.completedBytes * 100L) / progress.totalBytes).toInt()
                }
                preferences.setModelProgress(percent)
                setProgress(workDataOf(PROGRESS_PERCENT to percent))
                setForeground(
                    WorkerNotification.foregroundInfo(
                        applicationContext,
                        "Downloading approved model — $percent%",
                    ),
                )
            }
            ModelDownloadStage.VERIFYING -> report(WorkerStatus.VERIFYING_MODEL)
            ModelDownloadStage.COMPLETE -> preferences.setModelProgress(100)
        }
    }

    private suspend fun checkSafety(): Result? {
        val state = preferences.current()
        val snapshot = DeviceSafety.snapshot(applicationContext, state.manuallyPaused)
        preferences.recordSafetySummary(SafetyDiagnostic.summary(snapshot, gateProfile))
        return when (
            val decision = RunGate.evaluate(
                snapshot,
                gateProfile,
            )
        ) {
            GateDecision.Allowed -> null
            is GateDecision.Blocked -> {
                preferences.setStatus(decision.reason.toWorkerStatus())
                if (decision.reason == BlockReason.MANUAL_PAUSE) Result.success() else Result.retry()
            }
        }
    }

    private suspend fun readSafetySnapshot() = DeviceSafety.snapshot(
        applicationContext,
        preferences.current().manuallyPaused,
    ).also { snapshot ->
        preferences.recordSafetySummary(SafetyDiagnostic.summary(snapshot, gateProfile))
    }

    private suspend fun handleCandidateFailure(
        candidateIndex: Int,
        candidate: PinnedModel,
        reason: String,
        terminalStatus: WorkerStatus = WorkerStatus.MODEL_FAILED,
    ): Result {
        val fallback = ModelSelectionPolicy.fallbackAfter(candidateIndex)
        return if (benchmarkMarker(candidate).exists() && fallback != null) {
            val nextCandidate = checkNotNull(ModelCatalog.at(fallback))
            preferences.recordModelFailure(candidate.id, reason, nextCandidate.fallbackStatus())
            Result.retry()
        } else {
            val status = if (benchmarkMarker(candidate).exists()) {
                terminalStatus
            } else {
                candidate.preparingStatus()
            }
            preferences.recordModelFailure(candidate.id, reason, status)
            if (benchmarkMarker(candidate).exists()) Result.failure() else Result.retry()
        }
    }

    private fun hasStorageFor(remainingBytes: Long): Boolean {
        val available = StatFs(applicationContext.filesDir.absolutePath).availableBytes
        return ModelStoragePolicy.canFit(available, remainingBytes)
    }

    private fun markAttempted(marker: File) {
        check(modelDirectory.isDirectory || modelDirectory.mkdirs()) { "could not create model directory" }
        if (!marker.exists()) check(marker.createNewFile()) { "could not create benchmark marker" }
    }

    private fun benchmarkMarker(model: PinnedModel): File =
        File(modelDirectory, "${model.id}.benchmark-inflight")

    private fun buildEvidence(
        model: PinnedModel,
        benchmark: String,
        startThermal: String,
        endThermal: String,
        elapsedMillis: Long,
        ram: RamSnapshot,
    ): String {
        return buildString {
            append("device=")
            append(Build.MANUFACTURER)
            append(' ')
            append(Build.MODEL)
            append("; physicalRamGiB=")
            append("%.2f".format(ram.totalBytes.toDouble() / GIB.toDouble()))
            append("; availableRamBeforeLoadGiB=")
            append("%.2f".format(ram.availableBytes.toDouble() / GIB.toDouble()))
            append("; thermal=")
            append(startThermal)
            append("→")
            append(endThermal)
            append("; elapsedMs=")
            append(elapsedMillis)
            append("; model=")
            append(model.id)
            append('\n')
            append(benchmark)
        }
    }

    private fun readRamSnapshot(): RamSnapshot {
        val memoryInfo = ActivityManager.MemoryInfo()
        applicationContext.getSystemService(ActivityManager::class.java)?.getMemoryInfo(memoryInfo)
        return RamSnapshot(
            totalBytes = memoryInfo.totalMem,
            availableBytes = memoryInfo.availMem,
        )
    }

    private suspend fun report(status: WorkerStatus) {
        preferences.setStatus(status)
        setForeground(WorkerNotification.foregroundInfo(applicationContext, status.displayText))
    }

    private fun PinnedModel.preparingStatus(): WorkerStatus = when (id) {
        ModelCatalog.CODER_14B -> WorkerStatus.PREPARING_14B
        ModelCatalog.CODER_7B -> WorkerStatus.PREPARING_7B
        ModelCatalog.CODER_7B_COMPACT -> WorkerStatus.PREPARING_7B_COMPACT
        ModelCatalog.CODER_1_5B -> WorkerStatus.PREPARING_1_5B
        else -> WorkerStatus.MODEL_FAILED
    }

    private fun PinnedModel.fallbackStatus(): WorkerStatus = when (id) {
        ModelCatalog.CODER_7B -> WorkerStatus.FALLING_BACK_7B
        ModelCatalog.CODER_7B_COMPACT -> WorkerStatus.FALLING_BACK_7B_COMPACT
        ModelCatalog.CODER_1_5B -> WorkerStatus.FALLING_BACK_1_5B
        else -> WorkerStatus.MODEL_FAILED
    }

    private fun BlockReason.toWorkerStatus(): WorkerStatus = when (this) {
        BlockReason.MANUAL_PAUSE -> WorkerStatus.PAUSED
        BlockReason.DEVICE_IN_USE -> WorkerStatus.BLOCKED_PHONE_IN_USE
        BlockReason.NOT_CHARGING -> WorkerStatus.BLOCKED_NOT_CHARGING
        BlockReason.THERMAL_LIMIT -> WorkerStatus.COOLING_DOWN
        BlockReason.UNKNOWN_THERMAL_STATE -> WorkerStatus.BLOCKED_UNKNOWN_THERMAL
        BlockReason.BATTERY_TEMPERATURE_LIMIT -> WorkerStatus.COOLING_DOWN
        BlockReason.BATTERY_TEMPERATURE_UNAVAILABLE -> WorkerStatus.BLOCKED_UNKNOWN_THERMAL
    }

    companion object {
        const val INPUT_CANDIDATE_INDEX = "candidate_index"
        const val INPUT_MANUAL_TEST_MODE = "manual_test_mode"
        const val PROGRESS_PERCENT = "progress_percent"
        private const val MODEL_DIRECTORY = "models"
        private const val GIB = 1024L * 1024L * 1024L
        private const val NATIVE_INIT_TIMEOUT_MS = 60_000L
        private const val MODEL_LOAD_TIMEOUT_MS = 12L * 60L * 1000L
        private const val BENCHMARK_TIMEOUT_MS = 8L * 60L * 1000L
        private const val BENCHMARK_PROMPT_TOKENS = 64
        private const val BENCHMARK_GENERATION_TOKENS = 16
    }

    private data class RamSnapshot(
        val totalBytes: Long,
        val availableBytes: Long,
    )
}
