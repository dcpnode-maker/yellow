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
    fun `moderate thermal status blocks work`() {
        assertBlocked(BlockReason.THERMAL_LIMIT, safeSnapshot().copy(thermalLevel = ThermalLevel.MODERATE))
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

    private fun assertBlocked(reason: BlockReason, snapshot: GateSnapshot) {
        assertEquals(GateDecision.Blocked(reason), RunGate.evaluate(snapshot))
    }

    private fun safeSnapshot() = GateSnapshot(
        manuallyPaused = false,
        deviceInteractive = false,
        charging = true,
        thermalLevel = ThermalLevel.LIGHT,
    )
}
