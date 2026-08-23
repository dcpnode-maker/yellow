package com.yellow.worker.model

import com.yellow.worker.domain.ThermalLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BenchmarkResultTest {
    private val fixture = """
        | model | size | params | backend | test | t/s |
        | --- | --- | --- | --- | --- | --- |
        | qwen | 8.37GiB | 14.7B | KleidiAI | pp 64 | 12.4 ± 0.1 |
        | qwen | 8.37GiB | 14.7B | KleidiAI | tg 16 | 1.25 ± 0.02 |
    """.trimIndent()

    @Test
    fun `parses upstream Android benchmark table`() {
        assertEquals(BenchmarkSpeeds(12.4, 1.25), BenchmarkResultParser.parse(fixture))
        assertTrue(BenchmarkGate.assess(fixture, ThermalLevel.LIGHT) is BenchmarkAssessment.Passed)
    }

    @Test
    fun `thermal rise or malformed result fails closed`() {
        assertTrue(BenchmarkGate.assess(fixture, ThermalLevel.MODERATE) is BenchmarkAssessment.Failed)
        assertTrue(BenchmarkGate.assess("not a benchmark", ThermalLevel.NONE) is BenchmarkAssessment.Failed)
    }
}
