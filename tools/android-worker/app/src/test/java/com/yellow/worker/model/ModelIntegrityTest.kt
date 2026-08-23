package com.yellow.worker.model

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelIntegrityTest {
    @Test
    fun `wrong length or digest never matches`() {
        val directory = Files.createTempDirectory("yellow-integrity").toFile()
        val file = File(directory, "fixture.gguf")
        file.writeText("yellow")
        try {
            assertTrue(
                ModelIntegrity.matches(
                    file,
                    6,
                    "c685a2c9bab235ccdd2ab0ea92281a521c8aaf37895493d080070ea00fc7f5d7",
                ),
            )
            assertFalse(ModelIntegrity.matches(file, 7, ModelIntegrity.sha256(file)))
            assertFalse(ModelIntegrity.matches(file, 6, "0".repeat(64)))
        } finally {
            file.delete()
            directory.delete()
        }
    }
}
