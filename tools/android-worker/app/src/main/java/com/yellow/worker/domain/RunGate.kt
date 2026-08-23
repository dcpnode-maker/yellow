package com.yellow.worker.domain

data class GateSnapshot(
    val manuallyPaused: Boolean,
    val deviceInteractive: Boolean,
    val charging: Boolean,
    val thermalLevel: ThermalLevel,
    val batteryTemperatureCelsius: Double?,
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
    BATTERY_TEMPERATURE_LIMIT,
    BATTERY_TEMPERATURE_UNAVAILABLE,
}

enum class GateProfile {
    IDLE_WORK,
    MANUAL_MODEL_TEST,
}

sealed interface GateDecision {
    data object Allowed : GateDecision
    data class Blocked(val reason: BlockReason) : GateDecision
}

object RunGate {
    const val MANUAL_TEST_MAX_BATTERY_CELSIUS = 40.0

    fun evaluate(
        snapshot: GateSnapshot,
        profile: GateProfile = GateProfile.IDLE_WORK,
    ): GateDecision = when {
        snapshot.manuallyPaused -> GateDecision.Blocked(BlockReason.MANUAL_PAUSE)
        profile == GateProfile.IDLE_WORK && snapshot.deviceInteractive ->
            GateDecision.Blocked(BlockReason.DEVICE_IN_USE)
        profile == GateProfile.IDLE_WORK && !snapshot.charging ->
            GateDecision.Blocked(BlockReason.NOT_CHARGING)
        else -> evaluateThermal(snapshot, profile)
    }

    fun evaluateThermal(
        snapshot: GateSnapshot,
        profile: GateProfile = GateProfile.IDLE_WORK,
    ): GateDecision {
        val batteryTemperature = snapshot.validBatteryTemperatureCelsius()
        return when {
            snapshot.thermalLevel == ThermalLevel.UNKNOWN ->
                GateDecision.Blocked(BlockReason.UNKNOWN_THERMAL_STATE)
            profile == GateProfile.IDLE_WORK &&
                snapshot.thermalLevel.severity >= ThermalLevel.MODERATE.severity ->
                GateDecision.Blocked(BlockReason.THERMAL_LIMIT)
            profile == GateProfile.MANUAL_MODEL_TEST &&
                snapshot.thermalLevel.severity >= ThermalLevel.SEVERE.severity ->
                GateDecision.Blocked(BlockReason.THERMAL_LIMIT)
            profile == GateProfile.MANUAL_MODEL_TEST &&
                batteryTemperature != null &&
                batteryTemperature >= MANUAL_TEST_MAX_BATTERY_CELSIUS ->
                GateDecision.Blocked(BlockReason.BATTERY_TEMPERATURE_LIMIT)
            profile == GateProfile.MANUAL_MODEL_TEST &&
                snapshot.thermalLevel == ThermalLevel.MODERATE &&
                batteryTemperature == null ->
                GateDecision.Blocked(BlockReason.BATTERY_TEMPERATURE_UNAVAILABLE)
            else -> GateDecision.Allowed
        }
    }
}

fun GateSnapshot.validBatteryTemperatureCelsius(): Double? =
    batteryTemperatureCelsius?.takeIf { it.isFinite() && it > 0.0 && it < 100.0 }
