package com.yellow.worker.model

import com.yellow.worker.domain.ThermalLevel

data class BenchmarkSpeeds(
    val promptTokensPerSecond: Double,
    val generationTokensPerSecond: Double,
)

sealed interface BenchmarkAssessment {
    data class Passed(val speeds: BenchmarkSpeeds) : BenchmarkAssessment
    data class Failed(val reason: String) : BenchmarkAssessment
}

object BenchmarkResultParser {
    private val promptPattern = Regex("\\|\\s*pp\\s+\\d+\\s*\\|\\s*([0-9]+(?:\\.[0-9]+)?)")
    private val generationPattern = Regex("\\|\\s*tg\\s+\\d+\\s*\\|\\s*([0-9]+(?:\\.[0-9]+)?)")

    fun parse(raw: String): BenchmarkSpeeds? {
        val prompt = promptPattern.find(raw)?.groupValues?.get(1)?.toDoubleOrNull()
        val generation = generationPattern.find(raw)?.groupValues?.get(1)?.toDoubleOrNull()
        return if (prompt != null && generation != null) {
            BenchmarkSpeeds(prompt, generation)
        } else {
            null
        }
    }
}

object BenchmarkGate {
    private const val MIN_PROMPT_TOKENS_PER_SECOND = 1.0
    private const val MIN_GENERATION_TOKENS_PER_SECOND = 0.5

    fun assess(raw: String, endThermal: ThermalLevel): BenchmarkAssessment {
        if (
            endThermal == ThermalLevel.UNKNOWN ||
            endThermal.severity >= ThermalLevel.MODERATE.severity
        ) {
            return BenchmarkAssessment.Failed("phone reached an unsafe thermal state")
        }
        val speeds = BenchmarkResultParser.parse(raw)
            ?: return BenchmarkAssessment.Failed("benchmark output was not parseable")
        if (
            !speeds.promptTokensPerSecond.isFinite() ||
            !speeds.generationTokensPerSecond.isFinite() ||
            speeds.promptTokensPerSecond < MIN_PROMPT_TOKENS_PER_SECOND ||
            speeds.generationTokensPerSecond < MIN_GENERATION_TOKENS_PER_SECOND
        ) {
            return BenchmarkAssessment.Failed("model throughput is below the safe usability floor")
        }
        return BenchmarkAssessment.Passed(speeds)
    }
}
