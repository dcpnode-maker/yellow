package com.yellow.worker.domain

import android.content.Context
import android.os.BatteryManager
import android.os.PowerManager

object DeviceSafety {
    fun snapshot(context: Context, manuallyPaused: Boolean): GateSnapshot {
        val powerManager = context.getSystemService(PowerManager::class.java)
        val batteryManager = context.getSystemService(BatteryManager::class.java)
        return GateSnapshot(
            manuallyPaused = manuallyPaused,
            deviceInteractive = powerManager?.isInteractive ?: true,
            charging = batteryManager?.isCharging ?: false,
            thermalLevel = thermalLevel(context),
        )
    }

    fun thermalLevel(context: Context): ThermalLevel {
        val status = context.getSystemService(PowerManager::class.java)?.currentThermalStatus
        return when (status) {
            PowerManager.THERMAL_STATUS_NONE -> ThermalLevel.NONE
            PowerManager.THERMAL_STATUS_LIGHT -> ThermalLevel.LIGHT
            PowerManager.THERMAL_STATUS_MODERATE -> ThermalLevel.MODERATE
            PowerManager.THERMAL_STATUS_SEVERE -> ThermalLevel.SEVERE
            PowerManager.THERMAL_STATUS_CRITICAL -> ThermalLevel.CRITICAL
            PowerManager.THERMAL_STATUS_EMERGENCY -> ThermalLevel.EMERGENCY
            PowerManager.THERMAL_STATUS_SHUTDOWN -> ThermalLevel.SHUTDOWN
            else -> ThermalLevel.UNKNOWN
        }
    }
}
