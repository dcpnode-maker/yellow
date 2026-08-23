package com.yellow.worker.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.workerDataStore by preferencesDataStore(name = "yellow_worker_state")

data class WorkerViewState(
    val manuallyPaused: Boolean,
    val status: WorkerStatus,
    val preparingModelId: String?,
    val activeModelId: String?,
    val modelProgressPercent: Int,
    val benchmarkResult: String?,
    val modelFailure: String?,
)

enum class WorkerStatus(val storedValue: String, val displayText: String) {
    PAUSED("paused", "Paused manually"),
    NOTIFICATION_PERMISSION_REQUIRED(
        "notification_permission_required",
        "Notification permission is required before work can run",
    ),
    WAITING_FOR_CONSTRAINTS("waiting_for_constraints", "Armed — waiting for idle conditions"),
    CHECKING_SAFETY("checking_safety", "Checking phone safety gates"),
    BLOCKED_PHONE_IN_USE("blocked_phone_in_use", "Blocked — phone is in use"),
    BLOCKED_NOT_CHARGING("blocked_not_charging", "Blocked — connect the charger"),
    COOLING_DOWN("cooling_down", "Blocked — waiting for the phone to cool"),
    BLOCKED_UNKNOWN_THERMAL("blocked_unknown_thermal", "Blocked — thermal state unavailable"),
    NATIVE_ENGINE_READY("native_engine_ready", "Native llama.cpp engine ready"),
    WAITING_FOR_MODEL("waiting_for_model", "Waiting for an approved model"),
    PREPARING_14B("preparing_14b", "Preparing Qwen2.5 Coder 14B"),
    PREPARING_7B("preparing_7b", "Preparing Qwen2.5 Coder 7B fallback"),
    VERIFYING_MODEL("verifying_model", "Verifying model SHA-256"),
    LOADING_MODEL("loading_model", "Testing whether the model loads safely"),
    BENCHMARKING_MODEL("benchmarking_model", "Benchmarking the model on this phone"),
    FALLING_BACK_7B("falling_back_7b", "14B did not pass — switching to 7B"),
    MODEL_READY("model_ready", "Local coding model ready"),
    MODEL_STORAGE_LOW("model_storage_low", "Not enough free storage for the model reserve"),
    MODEL_FAILED("model_failed", "No approved model passed preparation"),
    ERROR("error", "Worker error — remains fail-closed"),
    ;

    companion object {
        fun fromStoredValue(value: String?): WorkerStatus =
            entries.firstOrNull { it.storedValue == value } ?: PAUSED
    }
}

class WorkerPreferences(context: Context) {
    private val dataStore = context.applicationContext.workerDataStore

    val state: Flow<WorkerViewState> = dataStore.data.map { preferences ->
        WorkerViewState(
            manuallyPaused = preferences[MANUAL_PAUSE] ?: true,
            status = WorkerStatus.fromStoredValue(preferences[STATUS]),
            preparingModelId = preferences[PREPARING_MODEL_ID],
            activeModelId = preferences[ACTIVE_MODEL_ID],
            modelProgressPercent = preferences[MODEL_PROGRESS_PERCENT] ?: 0,
            benchmarkResult = preferences[BENCHMARK_RESULT],
            modelFailure = preferences[MODEL_FAILURE],
        )
    }

    suspend fun current(): WorkerViewState = state.first()

    suspend fun arm(status: WorkerStatus = WorkerStatus.WAITING_FOR_CONSTRAINTS) {
        dataStore.edit { preferences ->
            preferences[MANUAL_PAUSE] = false
            preferences[STATUS] = status.storedValue
        }
    }

    suspend fun pause() {
        dataStore.edit { preferences ->
            preferences[MANUAL_PAUSE] = true
            preferences[STATUS] = WorkerStatus.PAUSED.storedValue
        }
    }

    suspend fun setStatus(status: WorkerStatus) {
        dataStore.edit { preferences ->
            preferences[STATUS] = status.storedValue
        }
    }

    suspend fun beginModel(modelId: String, status: WorkerStatus) {
        dataStore.edit { preferences ->
            preferences[PREPARING_MODEL_ID] = modelId
            preferences[MODEL_PROGRESS_PERCENT] = 0
            preferences.remove(MODEL_FAILURE)
            preferences[STATUS] = status.storedValue
        }
    }

    suspend fun setModelProgress(percent: Int) {
        dataStore.edit { preferences ->
            preferences[MODEL_PROGRESS_PERCENT] = percent.coerceIn(0, 100)
        }
    }

    suspend fun activateModel(modelId: String, benchmarkResult: String) {
        dataStore.edit { preferences ->
            preferences[ACTIVE_MODEL_ID] = modelId
            preferences.remove(PREPARING_MODEL_ID)
            preferences[MODEL_PROGRESS_PERCENT] = 100
            preferences[BENCHMARK_RESULT] = benchmarkResult
            preferences.remove(MODEL_FAILURE)
            preferences[STATUS] = WorkerStatus.MODEL_READY.storedValue
        }
    }

    suspend fun recordModelFailure(modelId: String, reason: String, status: WorkerStatus) {
        dataStore.edit { preferences ->
            preferences[PREPARING_MODEL_ID] = modelId
            preferences[MODEL_FAILURE] = reason.take(MAX_FAILURE_LENGTH)
            preferences[STATUS] = status.storedValue
        }
    }

    companion object {
        private val MANUAL_PAUSE = booleanPreferencesKey("manual_pause")
        private val STATUS = stringPreferencesKey("status")
        private val PREPARING_MODEL_ID = stringPreferencesKey("preparing_model_id")
        private val ACTIVE_MODEL_ID = stringPreferencesKey("active_model_id")
        private val MODEL_PROGRESS_PERCENT = intPreferencesKey("model_progress_percent")
        private val BENCHMARK_RESULT = stringPreferencesKey("benchmark_result")
        private val MODEL_FAILURE = stringPreferencesKey("model_failure")
        private const val MAX_FAILURE_LENGTH = 240
    }
}
