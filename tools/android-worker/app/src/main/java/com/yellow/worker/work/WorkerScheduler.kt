package com.yellow.worker.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

object WorkerScheduler {
    const val UNIQUE_WORK_NAME = "yellow-idle-worker"
    const val MODEL_WORK_NAME = "yellow-model-preparation"
    const val WORK_TAG = "yellow-worker"
    const val MODEL_WORK_TAG = "yellow-model"
    val EXISTING_WORK_POLICY: ExistingWorkPolicy = ExistingWorkPolicy.REPLACE

    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<YellowWorker>()
            .setConstraints(requiredConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
            .addTag(WORK_TAG)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            UNIQUE_WORK_NAME,
            EXISTING_WORK_POLICY,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(UNIQUE_WORK_NAME)
    }

    fun prepareModel(context: Context, candidateIndex: Int = 0) {
        val request = OneTimeWorkRequestBuilder<PrepareModelWorker>()
            .setInputData(workDataOf(PrepareModelWorker.INPUT_CANDIDATE_INDEX to candidateIndex))
            .setConstraints(requiredConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .addTag(MODEL_WORK_TAG)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            MODEL_WORK_NAME,
            EXISTING_WORK_POLICY,
            request,
        )
    }

    fun prepareModelNow(context: Context, candidateIndex: Int = 0) {
        val request = OneTimeWorkRequestBuilder<PrepareModelWorker>()
            .setInputData(
                workDataOf(
                    PrepareModelWorker.INPUT_CANDIDATE_INDEX to candidateIndex,
                    PrepareModelWorker.INPUT_MANUAL_TEST_MODE to true,
                ),
            )
            .setConstraints(manualTestConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .addTag(MODEL_WORK_TAG)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            MODEL_WORK_NAME,
            EXISTING_WORK_POLICY,
            request,
        )
    }

    fun cancelAll(context: Context) {
        val manager = WorkManager.getInstance(context.applicationContext)
        manager.cancelUniqueWork(UNIQUE_WORK_NAME)
        manager.cancelUniqueWork(MODEL_WORK_NAME)
    }

    internal fun requiredConstraints(): Constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.UNMETERED)
        .setRequiresCharging(true)
        .setRequiresBatteryNotLow(true)
        .setRequiresStorageNotLow(true)
        .setRequiresDeviceIdle(true)
        .build()

    internal fun manualTestConstraints(): Constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .setRequiresBatteryNotLow(true)
        .setRequiresStorageNotLow(true)
        .build()
}
