package com.yellow.worker.work

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.yellow.worker.data.WorkerPreferences
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
                        WorkerScheduler.cancel(context)
                    }
                    ACTION_RESUME -> {
                        preferences.arm()
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
