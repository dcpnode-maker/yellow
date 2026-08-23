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
import com.arm.aichat.isModelLoaded
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.domain.BlockReason
import com.yellow.worker.domain.DeviceSafety
import com.yellow.worker.domain.GateDecision
import com.yellow.worker.domain.RunGate
import com.yellow.worker.model.BenchmarkAssessment
import com.yellow.worker.model.BenchmarkGate
import com.yellow.worker.model.ModelCatalog
import com.yellow.worker.model.ModelDownloadProgress
import com.yellow.worker.model.ModelDownloadStage
import com.yellow.worker.model.ModelSelectionPolicy
import com.yellow.worker.model.ModelStoragePolicy
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

    override suspend fun doWork(): Result {
        val savedState = preferences.current()
        if (savedState.manuallyPaused) {
            preferences.setStatus(WorkerStatus.PAUSED)
            return Result.success()
        }

        val requestedIndex = inputData.getInt(INPUT_CANDIDATE_INDEX, 0)
        val candidateIndex = resolveCandidate(requestedIndex)
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

        val partial = File(modelDirectory, "${candidate.fileName}.part")
        val remainingBytes = (candidate.sizeBytes - partial.length()).coerceAtLeast(0)
        if (!hasStorageFor(remainingBytes)) {
            preferences.recordModelFailure(
                candidate.id,
                "Requires the remaining model bytes plus an 8 GiB safety reserve",
                WorkerStatus.MODEL_STORAGE_LOW,
            )
            return if (candidateIndex == 0) {
                markAttempted(marker)
                Result.retry()
            } else {
                Result.failure()
            }
        }

        var engine: InferenceEngine? = null
        return try {
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
            val endThermal = DeviceSafety.thermalLevel(applicationContext)
            when (
                val assessment = BenchmarkGate.assess(
                    benchmark,
                    endThermal,
                )
            ) {
                is BenchmarkAssessment.Failed -> throw IOException(assessment.reason)
                is BenchmarkAssessment.Passed -> {
                    val evidence = buildEvidence(
                        model = candidate,
                        benchmark = benchmark,
                        startThermal = startThermal.name,
                        endThermal = endThermal.name,
                        elapsedMillis = SystemClock.elapsedRealtime() - preparationStartedAt,
                    )
                    preferences.activateModel(candidate.id, evidence)
                    check(marker.delete() || !marker.exists()) { "could not clear benchmark marker" }
                    report(WorkerStatus.MODEL_READY)
                    WorkerScheduler.enqueue(applicationContext)
                    Result.success()
                }
            }
        } catch (timeout: TimeoutCancellationException) {
            handleCandidateFailure(candidateIndex, candidate, "model preparation timed out")
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
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
    }

    private fun resolveCandidate(requestedIndex: Int): Int? {
        var current = requestedIndex
        repeat(ModelCatalog.candidates.size + 1) {
            val model = ModelCatalog.at(current) ?: return null
            val selected = ModelSelectionPolicy.candidateIndex(
                requestedIndex = current,
                interruptedBenchmark = benchmarkMarker(model).exists(),
            ) ?: return null
            if (selected == current) return selected
            current = selected
        }
        return null
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
        return when (val decision = RunGate.evaluate(DeviceSafety.snapshot(applicationContext, state.manuallyPaused))) {
            GateDecision.Allowed -> null
            is GateDecision.Blocked -> {
                preferences.setStatus(decision.reason.toWorkerStatus())
                if (decision.reason == BlockReason.MANUAL_PAUSE) Result.success() else Result.retry()
            }
        }
    }

    private suspend fun handleCandidateFailure(
        candidateIndex: Int,
        candidate: PinnedModel,
        reason: String,
    ): Result {
        val fallback = ModelSelectionPolicy.fallbackAfter(candidateIndex)
        return if (benchmarkMarker(candidate).exists() && fallback != null) {
            preferences.recordModelFailure(candidate.id, reason, WorkerStatus.FALLING_BACK_7B)
            Result.retry()
        } else {
            val status = if (benchmarkMarker(candidate).exists()) {
                WorkerStatus.MODEL_FAILED
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
    ): String {
        val memoryInfo = ActivityManager.MemoryInfo()
        applicationContext.getSystemService(ActivityManager::class.java)?.getMemoryInfo(memoryInfo)
        val physicalMemoryGiB = memoryInfo.totalMem.toDouble() / GIB.toDouble()
        return buildString {
            append("device=")
            append(Build.MANUFACTURER)
            append(' ')
            append(Build.MODEL)
            append("; physicalRamGiB=")
            append("%.2f".format(physicalMemoryGiB))
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

    private suspend fun report(status: WorkerStatus) {
        preferences.setStatus(status)
        setForeground(WorkerNotification.foregroundInfo(applicationContext, status.displayText))
    }

    private fun PinnedModel.preparingStatus(): WorkerStatus = when (id) {
        ModelCatalog.CODER_14B -> WorkerStatus.PREPARING_14B
        else -> WorkerStatus.PREPARING_7B
    }

    private fun BlockReason.toWorkerStatus(): WorkerStatus = when (this) {
        BlockReason.MANUAL_PAUSE -> WorkerStatus.PAUSED
        BlockReason.DEVICE_IN_USE -> WorkerStatus.BLOCKED_PHONE_IN_USE
        BlockReason.NOT_CHARGING -> WorkerStatus.BLOCKED_NOT_CHARGING
        BlockReason.THERMAL_LIMIT -> WorkerStatus.COOLING_DOWN
        BlockReason.UNKNOWN_THERMAL_STATE -> WorkerStatus.BLOCKED_UNKNOWN_THERMAL
    }

    companion object {
        const val INPUT_CANDIDATE_INDEX = "candidate_index"
        const val PROGRESS_PERCENT = "progress_percent"
        private const val MODEL_DIRECTORY = "models"
        private const val GIB = 1024L * 1024L * 1024L
        private const val NATIVE_INIT_TIMEOUT_MS = 60_000L
        private const val MODEL_LOAD_TIMEOUT_MS = 12L * 60L * 1000L
        private const val BENCHMARK_TIMEOUT_MS = 8L * 60L * 1000L
        private const val BENCHMARK_PROMPT_TOKENS = 64
        private const val BENCHMARK_GENERATION_TOKENS = 16
    }
}
