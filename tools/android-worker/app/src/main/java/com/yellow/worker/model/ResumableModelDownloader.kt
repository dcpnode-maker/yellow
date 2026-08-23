package com.yellow.worker.model

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

enum class ModelDownloadStage {
    DOWNLOADING,
    VERIFYING,
    COMPLETE,
}

data class ModelDownloadProgress(
    val stage: ModelDownloadStage,
    val completedBytes: Long,
    val totalBytes: Long,
)

class ResumableModelDownloader {
    suspend fun download(
        model: PinnedModel,
        directory: File,
        onProgress: suspend (ModelDownloadProgress) -> Unit,
    ): File = withContext(Dispatchers.IO) {
        require(ModelCatalog.byId(model.id) == model) { "model is not in the immutable catalog" }
        check(directory.isDirectory || directory.mkdirs()) { "could not create model directory" }

        val finalFile = File(directory, model.fileName)
        if (finalFile.exists()) {
            onProgress(ModelDownloadProgress(ModelDownloadStage.VERIFYING, 0, model.sizeBytes))
            if (ModelIntegrity.matches(finalFile, model.sizeBytes, model.sha256)) {
                onProgress(
                    ModelDownloadProgress(ModelDownloadStage.COMPLETE, model.sizeBytes, model.sizeBytes),
                )
                return@withContext finalFile
            }
            check(finalFile.delete()) { "could not discard invalid app-private model" }
        }

        val partialFile = File(directory, "${model.fileName}.part")
        if (partialFile.length() > model.sizeBytes) {
            RandomAccessFile(partialFile, "rw").use { it.setLength(0) }
        }
        if (partialFile.length() < model.sizeBytes) {
            transfer(model, partialFile, onProgress)
        }

        if (partialFile.length() != model.sizeBytes) {
            throw IOException("download ended at ${partialFile.length()} of ${model.sizeBytes} bytes")
        }
        onProgress(ModelDownloadProgress(ModelDownloadStage.VERIFYING, 0, model.sizeBytes))
        if (!ModelIntegrity.matches(partialFile, model.sizeBytes, model.sha256)) {
            RandomAccessFile(partialFile, "rw").use { it.setLength(0) }
            throw IOException("model SHA-256 mismatch")
        }

        moveAtomically(partialFile, finalFile)
        onProgress(ModelDownloadProgress(ModelDownloadStage.COMPLETE, model.sizeBytes, model.sizeBytes))
        finalFile
    }

    private suspend fun transfer(
        model: PinnedModel,
        partialFile: File,
        onProgress: suspend (ModelDownloadProgress) -> Unit,
    ) {
        val localBytes = partialFile.length()
        val connection = openPinnedConnection(model.downloadUrl, localBytes)
        try {
            val plan = ResumePlanner.plan(
                localBytes = localBytes,
                expectedBytes = model.sizeBytes,
                responseCode = connection.responseCode,
                contentLength = connection.contentLengthLong,
                contentRange = connection.getHeaderField("Content-Range"),
            )
            if (plan is ResumePlan.Reject) throw IOException(plan.reason)
            plan as ResumePlan.Write

            var completed = plan.startOffset
            var lastReported = completed
            onProgress(
                ModelDownloadProgress(ModelDownloadStage.DOWNLOADING, completed, model.sizeBytes),
            )
            connection.inputStream.use { input ->
                FileOutputStream(partialFile, plan.append).use { output ->
                    val buffer = ByteArray(BUFFER_BYTES)
                    while (true) {
                        coroutineContext.ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        completed += read
                        if (completed > model.sizeBytes) {
                            throw IOException("server sent more than the pinned byte count")
                        }
                        if (completed - lastReported >= PROGRESS_INTERVAL_BYTES) {
                            onProgress(
                                ModelDownloadProgress(
                                    ModelDownloadStage.DOWNLOADING,
                                    completed,
                                    model.sizeBytes,
                                ),
                            )
                            lastReported = completed
                        }
                    }
                    output.fd.sync()
                }
            }
            onProgress(
                ModelDownloadProgress(ModelDownloadStage.DOWNLOADING, completed, model.sizeBytes),
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun openPinnedConnection(initialUrl: String, offset: Long): HttpURLConnection {
        var current = URL(initialUrl)
        repeat(MAX_REDIRECTS + 1) { redirectCount ->
            if (current.protocol != "https") throw IOException("model URL must remain HTTPS")
            val connection = current.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept-Encoding", "identity")
            connection.setRequestProperty("User-Agent", USER_AGENT)
            if (offset > 0) connection.setRequestProperty("Range", "bytes=$offset-")

            val responseCode = connection.responseCode
            if (responseCode !in REDIRECT_CODES) return connection
            val location = connection.getHeaderField("Location")
                ?: throw IOException("redirect missing Location")
            connection.disconnect()
            if (redirectCount == MAX_REDIRECTS) throw IOException("too many model redirects")
            current = URL(current, location)
        }
        throw IOException("too many model redirects")
    }

    private fun moveAtomically(source: File, destination: File) {
        try {
            Files.move(
                source.toPath(),
                destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(source.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    companion object {
        private const val BUFFER_BYTES = 1024 * 1024
        private const val PROGRESS_INTERVAL_BYTES = 32L * 1024 * 1024
        private const val CONNECT_TIMEOUT_MS = 30_000
        private const val READ_TIMEOUT_MS = 60_000
        private const val MAX_REDIRECTS = 8
        private const val USER_AGENT = "YellowWorker/0.2"
        private val REDIRECT_CODES = setOf(301, 302, 303, 307, 308)
    }
}
