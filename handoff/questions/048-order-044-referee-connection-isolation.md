# Question 048 — Order 044 referee connection isolation

**Status:** RESOLVED by `048-ARCHITECT-RESPONSE.md` under D-95/D-115
**Order:** 044

The first standing referee run used the live `yellow-phase-1` project while its app was
serving the founder workbench. PostgreSQL rejected nine of TC-8.2's 100 concurrent
invoice clients with `FATAL: sorry, too many clients already`; the battery correctly
returned 10 passed / 1 failed and observed 91 issued numbers.

May the complete standing gate restart from the top against a fresh isolated db-only
Compose project whose app is never started, without changing tracked code, PostgreSQL
limits, the referee, or any assertion, and with the proof volume removed afterward?

## RESOLVED
