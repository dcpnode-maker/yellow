package com.yellow.worker.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.workerDataStore by preferencesDataStore(name = "yellow_worker_state")

data class WorkerViewState(
    val manuallyPaused: Boolean,
    val status: WorkerStatus,
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
    MODEL_PRESENT_NOT_ENABLED(
        "model_present_not_enabled",
        "Model found, but execution is disabled until the benchmark gate",
    ),
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
        )
    }

    suspend fun current(): WorkerViewState = state.first()

    suspend fun arm() {
        dataStore.edit { preferences ->
            preferences[MANUAL_PAUSE] = false
            preferences[STATUS] = WorkerStatus.WAITING_FOR_CONSTRAINTS.storedValue
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

    companion object {
        private val MANUAL_PAUSE = booleanPreferencesKey("manual_pause")
        private val STATUS = stringPreferencesKey("status")
    }
}
