# Question 089 — Idempotency privacy and convergence proof isolation

**Status:** CLOSED — temporary architect response recorded
**Order:** 060
**Evidence:** the recreated focused run returned 4 pass / 2 fail. P4 queried nonexistent
`api_idempotency.idempotency_key`; D-178 deliberately stores only `key_hash`. P7 then observed
the preceding April horizon because P4 stopped before its May retry and P7 did not explicitly
bootstrap its own prerequisite.

May P4 compare operation-scoped claim counts before/after the injected rollback without
looking for a raw key, and may P7 first call the production bootstrap endpoint for its own May
horizon before placing the canonical hold? Production and all expected behavior stay unchanged.
Recreate and restart all six focused tests.
