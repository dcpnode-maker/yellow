package com.yellow.worker.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SafetyDiagnosticTest {
    @Test
    fun `renders the measured battery temperature for a manual test`() {
        val summary = SafetyDiagnostic.summary(
            snapshot(thermalLevel = ThermalLevel.MODERATE, batteryTemperature = 31.7),
            GateProfile.MANUAL_MODEL_TEST,
        )

        assertEquals(
            "Android thermal: MODERATE; battery: 31.7 °C. " +
                "Manual test ceiling: <40.0 °C; stops at SEVERE.",
            summary,
        )
    }

    @Test
    fun `labels an unavailable battery reading instead of inventing zero`() {
        val summary = SafetyDiagnostic.summary(
            snapshot(thermalLevel = ThermalLevel.LIGHT, batteryTemperature = null),
            GateProfile.IDLE_WORK,
        )

        assertEquals(
            "Android thermal: LIGHT; battery: unavailable. Idle mode stops at MODERATE.",
            summary,
        )
        assertNull(BatteryTemperature.fromTenthsCelsius(Int.MIN_VALUE))
        assertNull(BatteryTemperature.fromTenthsCelsius(0))
        assertEquals(31.7, BatteryTemperature.fromTenthsCelsius(317)!!, 0.0)
    }

    private fun snapshot(
        thermalLevel: ThermalLevel,
        batteryTemperature: Double?,
    ) = GateSnapshot(
        manuallyPaused = false,
        deviceInteractive = false,
        charging = true,
        thermalLevel = thermalLevel,
        batteryTemperatureCelsius = batteryTemperature,
    )
}
