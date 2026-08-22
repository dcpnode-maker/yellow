# Question 082 — Detached Bun worker promises are not driven in deployed app

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** rebuilt Compose app has both worker flags set and health/login 200, but after
multiple polls `consumer_cursor` contains no `availability-projection` row and logs contain
neither a poll nor an error. This matches the exact-class diagnostic where an unobserved
run promise made zero attempts. `server.ts` currently launches both projection and hold
expiry loops with detached `void worker.run(...)`.

May server startup attach `.catch(...)` to both existing worker promises, preserving each
loop's internal per-poll handling while making the pinned Bun runtime observe/drive the
promise and log an unexpected terminal rejection? Then rebuild Compose and require the
projection cursor to appear without an HTTP request.
