package com.yellow.worker.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object WorkerScheduler {
    const val UNIQUE_WORK_NAME = "yellow-idle-worker"
    const val WORK_TAG = "yellow-worker"
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

    internal fun requiredConstraints(): Constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.UNMETERED)
        .setRequiresCharging(true)
        .setRequiresBatteryNotLow(true)
        .setRequiresStorageNotLow(true)
        .setRequiresDeviceIdle(true)
        .build()
}
