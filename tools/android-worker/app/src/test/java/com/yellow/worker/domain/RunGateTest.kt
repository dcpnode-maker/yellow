package com.yellow.worker.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class RunGateTest {
    @Test
    fun `manual pause blocks an otherwise safe phone`() {
        assertBlocked(BlockReason.MANUAL_PAUSE, safeSnapshot().copy(manuallyPaused = true))
    }

    @Test
    fun `interactive phone blocks work`() {
        assertBlocked(BlockReason.DEVICE_IN_USE, safeSnapshot().copy(deviceInteractive = true))
    }

    @Test
    fun `disconnected power blocks work`() {
        assertBlocked(BlockReason.NOT_CHARGING, safeSnapshot().copy(charging = false))
    }

    @Test
    fun `moderate thermal status still blocks idle work with a cool battery`() {
        assertBlocked(
            BlockReason.THERMAL_LIMIT,
            safeSnapshot().copy(
                thermalLevel = ThermalLevel.MODERATE,
                batteryTemperatureCelsius = 30.0,
            ),
        )
    }

    @Test
    fun `severe thermal status blocks work`() {
        assertBlocked(BlockReason.THERMAL_LIMIT, safeSnapshot().copy(thermalLevel = ThermalLevel.SEVERE))
    }

    @Test
    fun `unknown thermal status fails closed`() {
        assertBlocked(
            BlockReason.UNKNOWN_THERMAL_STATE,
            safeSnapshot().copy(thermalLevel = ThermalLevel.UNKNOWN),
        )
    }

    @Test
    fun `cool noninteractive charging phone is allowed`() {
        assertEquals(GateDecision.Allowed, RunGate.evaluate(safeSnapshot()))
    }

    @Test
    fun `manual test permits an interactive unplugged phone`() {
        val snapshot = safeSnapshot().copy(deviceInteractive = true, charging = false)

        assertEquals(
            GateDecision.Allowed,
            RunGate.evaluate(snapshot, GateProfile.MANUAL_MODEL_TEST),
        )
    }

    @Test
    fun `manual test still blocks manual pause`() {
        assertBlockedInManualTest(
            BlockReason.MANUAL_PAUSE,
            safeSnapshot().copy(manuallyPaused = true, deviceInteractive = true, charging = false),
        )
    }

    @Test
    fun `manual test permits moderate platform status below measured ceiling`() {
        assertEquals(
            GateDecision.Allowed,
            RunGate.evaluate(
                safeSnapshot().copy(
                    thermalLevel = ThermalLevel.MODERATE,
                    batteryTemperatureCelsius = 39.9,
                ),
                GateProfile.MANUAL_MODEL_TEST,
            ),
        )
    }

    @Test
    fun `manual test blocks battery temperature at the measured ceiling`() {
        assertBlockedInManualTest(
            BlockReason.BATTERY_TEMPERATURE_LIMIT,
            safeSnapshot().copy(batteryTemperatureCelsius = 40.0),
        )
    }

    @Test
    fun `manual test blocks severe platform heat even with a cool battery`() {
        assertBlockedInManualTest(
            BlockReason.THERMAL_LIMIT,
            safeSnapshot().copy(
                thermalLevel = ThermalLevel.SEVERE,
                batteryTemperatureCelsius = 25.0,
            ),
        )
    }

    @Test
    fun `manual test requires a battery reading to override moderate status`() {
        assertBlockedInManualTest(
            BlockReason.BATTERY_TEMPERATURE_UNAVAILABLE,
            safeSnapshot().copy(
                thermalLevel = ThermalLevel.MODERATE,
                batteryTemperatureCelsius = null,
            ),
        )
    }

    @Test
    fun `manual test still fails closed on unknown thermal state`() {
        assertBlockedInManualTest(
            BlockReason.UNKNOWN_THERMAL_STATE,
            safeSnapshot().copy(thermalLevel = ThermalLevel.UNKNOWN),
        )
    }

    private fun assertBlocked(reason: BlockReason, snapshot: GateSnapshot) {
        assertEquals(GateDecision.Blocked(reason), RunGate.evaluate(snapshot))
    }

    private fun assertBlockedInManualTest(reason: BlockReason, snapshot: GateSnapshot) {
        assertEquals(
            GateDecision.Blocked(reason),
            RunGate.evaluate(snapshot, GateProfile.MANUAL_MODEL_TEST),
        )
    }

    private fun safeSnapshot() = GateSnapshot(
        manuallyPaused = false,
        deviceInteractive = false,
        charging = true,
        thermalLevel = ThermalLevel.LIGHT,
        batteryTemperatureCelsius = 30.0,
    )
}
