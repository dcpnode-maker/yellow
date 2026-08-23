package com.yellow.worker

import android.Manifest
import android.app.ActivityManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.data.WorkerViewState
import com.yellow.worker.model.ModelCatalog
import com.yellow.worker.model.ModelUiPolicy
import com.yellow.worker.model.RepairedEnginePromotion
import com.yellow.worker.work.WorkerScheduler
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var preferences: WorkerPreferences
    private var pendingAction: PendingAction? = null
    private var latestState: WorkerViewState? = null

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val action = pendingAction
        if (granted && action != null) {
            perform(action)
        } else if (!granted) {
            activityScope.launch {
                preferences.pause()
                preferences.setStatus(WorkerStatus.NOTIFICATION_PERMISSION_REQUIRED)
            }
        }
        pendingAction = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        preferences = WorkerPreferences(applicationContext)

        val statusText = findViewById<TextView>(R.id.status_text)
        val safetyDetailText = findViewById<TextView>(R.id.safety_detail_text)
        val pauseModeText = findViewById<TextView>(R.id.pause_mode_text)
        val deviceProfileText = findViewById<TextView>(R.id.device_profile_text)
        val modelStatusText = findViewById<TextView>(R.id.model_status_text)
        val modelProgressBar = findViewById<ProgressBar>(R.id.model_progress_bar)
        val armButton = findViewById<Button>(R.id.arm_button)
        val prepareModelButton = findViewById<Button>(R.id.prepare_model_button)
        val pauseButton = findViewById<Button>(R.id.pause_button)
        val resumeButton = findViewById<Button>(R.id.resume_button)

        deviceProfileText.text = deviceProfile()

        activityScope.launch {
            preferences.state.collectLatest { state ->
                latestState = state
                statusText.text = state.status.displayText
                safetyDetailText.text = state.safetySummary.orEmpty()
                safetyDetailText.visibility = if (state.safetySummary == null) {
                    View.GONE
                } else {
                    View.VISIBLE
                }
                pauseModeText.setText(
                    if (state.manuallyPaused) {
                        R.string.manual_pause_on
                    } else {
                        R.string.manual_pause_off
                    },
                )
                modelStatusText.text = modelStatus(state)
                modelProgressBar.progress = state.modelProgressPercent
                val upgradeInProgress = ModelUiPolicy.isUpgradeInProgress(
                    state.preparingModelId,
                    state.activeModelId,
                )
                val showProgress = ModelUiPolicy.shouldShowProgress(
                    state.preparingModelId,
                    state.activeModelId,
                )
                modelProgressBar.visibility = if (showProgress) {
                    View.VISIBLE
                } else {
                    View.GONE
                }
                prepareModelButton.setText(
                    if (promotionAvailable(state) || upgradeInProgress) {
                        R.string.test_stronger_model
                    } else {
                        R.string.prepare_best_model
                    },
                )
                prepareModelButton.isEnabled = !upgradeInProgress
                pauseButton.isEnabled = !state.manuallyPaused
                resumeButton.isEnabled = state.manuallyPaused
            }
        }

        armButton.setOnClickListener { requestPermission(PendingAction.ARM) }
        prepareModelButton.setOnClickListener {
            requestPermission(PendingAction.RUN_MODEL_TEST_NOW)
        }
        resumeButton.setOnClickListener { requestPermission(PendingAction.RESUME) }
        pauseButton.setOnClickListener { pauseWorker() }
    }

    override fun onDestroy() {
        activityScope.cancel()
        super.onDestroy()
    }

    private fun requestPermission(action: PendingAction) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingAction = action
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        perform(action)
    }

    private fun perform(action: PendingAction) {
        when (action) {
            PendingAction.ARM -> armWorker()
            PendingAction.RUN_MODEL_TEST_NOW -> runModelTestNow()
            PendingAction.RESUME -> resumeWorker()
        }
    }

    private fun armWorker() {
        activityScope.launch {
            preferences.arm()
            WorkerScheduler.enqueue(applicationContext)
        }
    }

    private fun pauseWorker() {
        activityScope.launch {
            preferences.pause()
            WorkerScheduler.cancelAll(applicationContext)
        }
    }

    private fun runModelTestNow() {
        activityScope.launch {
            val state = latestState ?: preferences.current()
            val promotion = promotionAvailable(state)
            val candidateIndex = if (promotion) {
                ModelCatalog.candidates.indexOfFirst {
                    it.id == ModelCatalog.CODER_7B_COMPACT
                }.takeIf { it >= 0 } ?: 0
            } else {
                0
            }
            preferences.arm(WorkerStatus.CHECKING_SAFETY)
            WorkerScheduler.prepareModelNow(
                applicationContext,
                candidateIndex = candidateIndex,
                repairedEnginePromotion = promotion,
            )
        }
    }

    private fun resumeWorker() {
        activityScope.launch {
            val state = preferences.current()
            preferences.arm()
            if (ModelCatalog.byId(state.activeModelId) == null && state.preparingModelId != null) {
                val index = ModelCatalog.candidates.indexOfFirst { it.id == state.preparingModelId }
                    .takeIf { it >= 0 } ?: 0
                WorkerScheduler.prepareModel(applicationContext, candidateIndex = index)
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
                    applicationContext,
                    candidateIndex = index,
                    repairedEnginePromotion = true,
                )
            }
            WorkerScheduler.enqueue(applicationContext)
        }
    }

    private fun modelStatus(state: WorkerViewState): String {
        val active = ModelCatalog.byId(state.activeModelId)
        val preparing = ModelCatalog.byId(state.preparingModelId)
        if (
            active != null &&
            preparing != null &&
            ModelUiPolicy.isUpgradeInProgress(state.preparingModelId, state.activeModelId)
        ) {
            return buildString {
                append("Testing upgrade: ")
                append(preparing.displayName)
                append(" — ")
                append(state.modelProgressPercent)
                append('%')
                append('\n')
                append("Fallback ready: ")
                append(active.displayName)
                state.modelFailure?.let { failure ->
                    append('\n')
                    append("Last issue: ")
                    append(failure)
                }
            }
        }
        if (active != null) {
            return buildString {
                append("Ready: ")
                append(active.displayName)
                state.benchmarkResult?.lineSequence()?.firstOrNull()?.let { evidence ->
                    append('\n')
                    append(evidence)
                }
                state.modelFailure?.let { failure ->
                    append('\n')
                    append("Last stronger-model issue: ")
                    append(failure)
                }
            }
        }
        return buildString {
            if (preparing == null) {
                append(getString(R.string.model_not_prepared))
            } else {
                append("Preparing: ")
                append(preparing.displayName)
                append(" — ")
                append(state.modelProgressPercent)
                append('%')
            }
            state.modelFailure?.let { failure ->
                append('\n')
                append("Last issue: ")
                append(failure)
            }
        }
    }

    private fun promotionAvailable(state: WorkerViewState): Boolean =
        RepairedEnginePromotion.isAvailable(
            File(filesDir, MODEL_DIRECTORY),
            state.activeModelId,
        )

    private fun deviceProfile(): String {
        val memoryInfo = ActivityManager.MemoryInfo()
        getSystemService(ActivityManager::class.java)?.getMemoryInfo(memoryInfo)
        val physicalGiB = memoryInfo.totalMem.toDouble() / (1024.0 * 1024.0 * 1024.0)
        return getString(
            R.string.device_profile,
            Build.MANUFACTURER,
            Build.MODEL,
            physicalGiB,
        )
    }

    private enum class PendingAction {
        ARM,
        RUN_MODEL_TEST_NOW,
        RESUME,
    }

    companion object {
        private const val MODEL_DIRECTORY = "models"
    }
}
