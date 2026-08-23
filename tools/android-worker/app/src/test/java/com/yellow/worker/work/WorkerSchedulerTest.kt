package com.yellow.worker.work

import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkerSchedulerTest {
    @Test
    fun `scheduler requires every coarse safety constraint`() {
        val constraints = WorkerScheduler.requiredConstraints()

        assertEquals(NetworkType.UNMETERED, constraints.requiredNetworkType)
        assertTrue(constraints.requiresCharging())
        assertTrue(constraints.requiresBatteryNotLow())
        assertTrue(constraints.requiresStorageNotLow())
        assertTrue(constraints.requiresDeviceIdle())
    }

    @Test
    fun `arming replaces only the existing unique Yellow job`() {
        assertEquals(ExistingWorkPolicy.REPLACE, WorkerScheduler.EXISTING_WORK_POLICY)
        assertEquals("yellow-idle-worker", WorkerScheduler.UNIQUE_WORK_NAME)
    }
}
