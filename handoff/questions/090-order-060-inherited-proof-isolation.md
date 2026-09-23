# Question 090 — Inherited projection consumer ran on Order 060's mutated database

**Status:** CLOSED — temporary architect response recorded
**Order:** 060
**Evidence:** Order 058 passed 6/6 on the Order 060 database, but the immediately following
Order 059 run returned 2/6 because its exact cursor/event-count assertions observed Order 060's
review-seed and hold events. The received counts (16 examined, 14 rebuilt) identify inherited
outbox history, not a consumer behavior change. D-215 already requires recreated databases for
tests with canonical fixtures that mutate shared state.

May each inherited focused file run on its own fresh 0001–0005 database with only its declared
fixture, then may schema drift run separately with its required explicit database variable?
No production, assertion, migration or expected count changes.
