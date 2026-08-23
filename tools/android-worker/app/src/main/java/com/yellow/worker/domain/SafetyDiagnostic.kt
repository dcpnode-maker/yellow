package com.yellow.worker.domain

import java.util.Locale

object SafetyDiagnostic {
    fun summary(snapshot: GateSnapshot, profile: GateProfile): String = buildString {
        append("Android thermal: ")
        append(snapshot.thermalLevel.name)
        append("; battery: ")
        val batteryTemperature = snapshot.validBatteryTemperatureCelsius()
        if (batteryTemperature == null) {
            append("unavailable")
        } else {
            append(String.format(Locale.US, "%.1f °C", batteryTemperature))
        }
        append(". ")
        if (profile == GateProfile.MANUAL_MODEL_TEST) {
            append("Manual test ceiling: <40.0 °C; stops at SEVERE.")
        } else {
            append("Idle mode stops at MODERATE.")
        }
    }
}
