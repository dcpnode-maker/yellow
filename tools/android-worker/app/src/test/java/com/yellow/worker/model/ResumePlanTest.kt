package com.yellow.worker.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ResumePlanTest {
    @Test
    fun `valid range resumes only at exact local offset`() {
        assertEquals(
            ResumePlan.Write(startOffset = 40, append = true),
            ResumePlanner.plan(
                localBytes = 40,
                expectedBytes = 100,
                responseCode = 206,
                contentLength = 60,
                contentRange = "bytes 40-99/100",
            ),
        )
    }

    @Test
    fun `server ignoring range restarts from zero`() {
        assertEquals(
            ResumePlan.Write(startOffset = 0, append = false),
            ResumePlanner.plan(40, 100, 200, 100, null),
        )
    }

    @Test
    fun `wrong range start is rejected`() {
        assertTrue(
            ResumePlanner.plan(40, 100, 206, 70, "bytes 30-99/100") is ResumePlan.Reject,
        )
    }

    @Test
    fun `wrong total or unknown length is rejected`() {
        assertTrue(
            ResumePlanner.plan(40, 100, 206, 60, "bytes 40-99/101") is ResumePlan.Reject,
        )
        assertTrue(ResumePlanner.plan(0, 100, 200, -1, null) is ResumePlan.Reject)
    }
}
