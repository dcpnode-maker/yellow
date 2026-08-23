package com.yellow.worker.domain

data class GateSnapshot(
    val manuallyPaused: Boolean,
    val deviceInteractive: Boolean,
    val charging: Boolean,
    val thermalLevel: ThermalLevel,
)

enum class ThermalLevel(val severity: Int) {
    NONE(0),
    LIGHT(1),
    MODERATE(2),
    SEVERE(3),
    CRITICAL(4),
    EMERGENCY(5),
    SHUTDOWN(6),
    UNKNOWN(Int.MAX_VALUE),
}

enum class BlockReason {
    MANUAL_PAUSE,
    DEVICE_IN_USE,
    NOT_CHARGING,
    THERMAL_LIMIT,
    UNKNOWN_THERMAL_STATE,
}

sealed interface GateDecision {
    data object Allowed : GateDecision
    data class Blocked(val reason: BlockReason) : GateDecision
}

object RunGate {
    fun evaluate(snapshot: GateSnapshot): GateDecision = when {
        snapshot.manuallyPaused -> GateDecision.Blocked(BlockReason.MANUAL_PAUSE)
        snapshot.deviceInteractive -> GateDecision.Blocked(BlockReason.DEVICE_IN_USE)
        !snapshot.charging -> GateDecision.Blocked(BlockReason.NOT_CHARGING)
        snapshot.thermalLevel == ThermalLevel.UNKNOWN ->
            GateDecision.Blocked(BlockReason.UNKNOWN_THERMAL_STATE)
        snapshot.thermalLevel.severity >= ThermalLevel.MODERATE.severity ->
            GateDecision.Blocked(BlockReason.THERMAL_LIMIT)
        else -> GateDecision.Allowed
    }
}
