# Question 027 — deterministic GiST proof versus cost-plan benchmark

**Status:** CLOSED — see `027-ARCHITECT-RESPONSE.md` and D-110.

## RESOLVED

P2 failed again at 100,000 rows, now as a Parallel Seq Scan, and cleanup exceeded 30
seconds. Across repeated probes PostgreSQL alternated between GiST and sequential plans
as physical index bloat/statistics changed. Cost choice is environment state, not a
stable executable invariant.

May P2 return to 1,500 isolated rows and use transaction-local `enable_seqscan=off` only
for EXPLAIN, proving the `<@` plus tenant predicate is supported by the named composite
GiST index? Natural-plan crossover moves to a future benchmark with controlled table and
index statistics.

