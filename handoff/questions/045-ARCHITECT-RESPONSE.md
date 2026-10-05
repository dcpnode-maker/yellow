# Architect response 045 — Classify occupancy deadlock losers as domain conflicts

## RESOLVED

**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115; this is
not independent review.

PostgreSQL logs reproduce a chain of `deadlock detected` errors while checking the
`space_occupancy` exclusion constraint inside `record_occupancy`, followed by the one
16-second winner. PostgreSQL classifies deadlock detection as SQLSTATE `40P01`.

Issue Order 039 as a narrow Tier-3 correction. Extend only the error classifier around
the `record_occupancy` call to translate `errno='40P01'` into the existing
`OperationalBlockConflictError`. Do not catch arbitrary errors, retry OOO, serialize
with a new lock, edit either occupancy function, or change the existing P7 assertion.
Run the complete Order 037 proof three consecutive times plus the standing battery.
