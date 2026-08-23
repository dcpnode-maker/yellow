package com.yellow.worker.model

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object ModelIntegrity {
    fun matches(
        file: File,
        expectedBytes: Long,
        expectedSha256: String,
        onChunk: () -> Unit = {},
    ): Boolean =
        file.isFile &&
            file.length() == expectedBytes &&
            sha256(file, onChunk).equals(expectedSha256, ignoreCase = true)

    fun sha256(file: File, onChunk: () -> Unit = {}): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(VERIFY_BUFFER_BYTES)
            while (true) {
                onChunk()
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    private const val VERIFY_BUFFER_BYTES = 1024 * 1024
}
