package com.yellow.worker.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.ServiceInfo
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo
import com.yellow.worker.MainActivity
import com.yellow.worker.R

object WorkerNotification {
    private const val CHANNEL_ID = "yellow_worker"
    private const val NOTIFICATION_ID = 2701

    fun foregroundInfo(context: Context, status: String): ForegroundInfo {
        ensureChannel(context)

        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val pauseIntent = PendingIntent.getBroadcast(
            context,
            1,
            Intent(context, WorkerActionReceiver::class.java).setAction(
                WorkerActionReceiver.ACTION_PAUSE,
            ),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_worker)
            .setContentTitle(context.getString(R.string.notification_title))
            .setContentText(status)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(
                R.drawable.ic_worker,
                context.getString(R.string.pause_now),
                pauseIntent,
            )
            .build()

        return ForegroundInfo(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
    }

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = context.getString(R.string.notification_channel_description)
            setSound(null, null)
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)
    }
}
