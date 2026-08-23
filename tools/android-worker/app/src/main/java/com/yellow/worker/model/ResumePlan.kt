package com.yellow.worker.model

sealed interface ResumePlan {
    data class Write(val startOffset: Long, val append: Boolean) : ResumePlan
    data class Reject(val reason: String) : ResumePlan
}

object ResumePlanner {
    private val contentRangePattern = Regex("bytes\\s+(\\d+)-(\\d+)/(\\d+)")

    fun plan(
        localBytes: Long,
        expectedBytes: Long,
        responseCode: Int,
        contentLength: Long,
        contentRange: String?,
    ): ResumePlan {
        if (localBytes !in 0..expectedBytes) {
            return ResumePlan.Reject("partial length outside expected range")
        }

        if (responseCode == 200) {
            return if (contentLength == expectedBytes) {
                ResumePlan.Write(startOffset = 0, append = false)
            } else {
                ResumePlan.Reject("full response length mismatch")
            }
        }

        if (responseCode != 206) {
            return ResumePlan.Reject("unexpected HTTP status $responseCode")
        }

        val match = contentRange?.let(contentRangePattern::matchEntire)
            ?: return ResumePlan.Reject("missing or malformed Content-Range")
        val start = match.groupValues[1].toLongOrNull()
            ?: return ResumePlan.Reject("invalid range start")
        val end = match.groupValues[2].toLongOrNull()
            ?: return ResumePlan.Reject("invalid range end")
        val total = match.groupValues[3].toLongOrNull()
            ?: return ResumePlan.Reject("invalid range total")

        if (start != localBytes || total != expectedBytes || end < start) {
            return ResumePlan.Reject("range does not match the pinned file")
        }
        val responseBytes = end - start + 1
        if (contentLength != responseBytes || start + responseBytes != expectedBytes) {
            return ResumePlan.Reject("range response length mismatch")
        }
        return ResumePlan.Write(startOffset = start, append = start > 0)
    }
}
