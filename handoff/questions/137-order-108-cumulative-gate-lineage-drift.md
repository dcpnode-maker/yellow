# Question 137 — Order 108 cumulative-gate lineage drift

**Order:** 108 — SECURITY DEFINER shadow-path containment
**Status:** RESOLVED by D-334 before current-line green proof

## Discrepancy

The independently approved containment branch is based on `52f8b0c`, where commit
`4c2720c` already added the reviewed Order-104 financial-postings suite to the
cumulative database runner. The canonical current parent `5f9d26c` contains the
financial implementation and `tests/financial-postings.integration.test.ts`, but is
not descended from `4c2720c`; its runner therefore invokes only thirteen suites.

Blindly applying the Order-113 runner hunk fails because its fourteen-suite parent
context does not exist. Adding only the new containment suite would produce a
fourteen-suite runner that still silently omits the inherited financial proof and
would not be cumulative.

## Resolution

Order 108 may restore the already-reviewed financial suite entry and add the new
containment suite in the two runner files already named in Scope. This is evidence-
chain repair only: it changes no financial product/test behavior and imports the exact
existing `4c2720c` mapping before the reviewed containment mapping. The runner must
then contain fifteen unique isolated suites and execute both proofs. No other Order-104
branch change enters current lineage through this resolution.
