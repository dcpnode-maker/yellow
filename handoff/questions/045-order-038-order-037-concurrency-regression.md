# Question 045 — Unchanged Order 037 concurrency regression returned a non-domain loser

**Status:** RESOLVED by `045-ARCHITECT-RESPONSE.md` under D-95/D-115
**Order:** 038 standing regression against Order 037 P7

After the Order 038 precision correction, the full battery's unchanged Order 037 run
returned 6 pass / 1 fail. P7 still produced exactly one winner and nineteen losers, but
at least one loser was not an `OperationalBlockConflictError`; the test took 16.08 s
instead of its usual sub-second duration. The existing assertion gives no loser error
details. Determine whether the unexpected rejection is environmental pool/connection
failure or an unhandled PostgreSQL conflict without weakening P7, changing occupancy,
or committing any Order 037 test change. Do not resume the Order 038 battery until the
cause is reproduced and classified.
