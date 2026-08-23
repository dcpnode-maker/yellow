package com.yellow.worker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.yellow.worker.data.WorkerPreferences
import com.yellow.worker.data.WorkerStatus
import com.yellow.worker.work.WorkerScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var preferences: WorkerPreferences
    private var armAfterPermission = false

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && armAfterPermission) {
            armWorker()
        } else if (!granted) {
            activityScope.launch {
                preferences.pause()
                preferences.setStatus(WorkerStatus.NOTIFICATION_PERMISSION_REQUIRED)
            }
        }
        armAfterPermission = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        preferences = WorkerPreferences(applicationContext)

        val statusText = findViewById<TextView>(R.id.status_text)
        val pauseModeText = findViewById<TextView>(R.id.pause_mode_text)
        val armButton = findViewById<Button>(R.id.arm_button)
        val pauseButton = findViewById<Button>(R.id.pause_button)
        val resumeButton = findViewById<Button>(R.id.resume_button)

        activityScope.launch {
            preferences.state.collectLatest { state ->
                statusText.text = state.status.displayText
                pauseModeText.setText(
                    if (state.manuallyPaused) {
                        R.string.manual_pause_on
                    } else {
                        R.string.manual_pause_off
                    },
                )
                pauseButton.isEnabled = !state.manuallyPaused
                resumeButton.isEnabled = state.manuallyPaused
            }
        }

        armButton.setOnClickListener { requestPermissionAndArm() }
        resumeButton.setOnClickListener { requestPermissionAndArm() }
        pauseButton.setOnClickListener { pauseWorker() }
    }

    override fun onDestroy() {
        activityScope.cancel()
        super.onDestroy()
    }

    private fun requestPermissionAndArm() {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            armAfterPermission = true
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        armWorker()
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
            WorkerScheduler.cancel(applicationContext)
        }
    }
}
