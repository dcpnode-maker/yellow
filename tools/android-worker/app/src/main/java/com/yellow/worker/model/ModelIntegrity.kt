package com.yellow.worker.model

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object ModelIntegrity {
    fun matches(file: File, expectedBytes: Long, expectedSha256: String): Boolean =
        file.isFile &&
            file.length() == expectedBytes &&
            sha256(file).equals(expectedSha256, ignoreCase = true)

    fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString(separator = "") { byte -> "%02x".format(byte) }
    }
}
