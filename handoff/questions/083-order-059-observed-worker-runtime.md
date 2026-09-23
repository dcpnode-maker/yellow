# Question 083 — Terminal catch still leaves deployed worker promises dormant

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** after the Question 082 change, the rebuilt Compose container carries the
exact host `src/server.ts` hash, all three opt-in flags are set, the app is healthy, and
the log shows no worker error. After more than two poll intervals, however, PostgreSQL
still has neither an `availability-projection` nor `hold-expiry` cursor while outbox has
24 rows. Attaching `.catch(...)` therefore did not make either pinned-Bun background
promise execute; D-212's proposed mechanism is disproven.

May an untracked minimal Bun 1.3.14 runtime diagnostic compare the deployed `.catch(...)`
launch shape with a promise observed by top-level `await`/`Promise.race`, without HTTP,
database mutations beyond disposable consumer cursors, or any tracked production change?
The next correction must name the observed mechanism, preserve both workers' domain logic,
and add executable runtime-source coverage before the deployed proof is restarted.
