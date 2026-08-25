# Question 163 — Order 150 stale-reservation proof fixture

**Status:** OPEN — founder decision required
**Order:** 150
**Raised:** 2026-08-25
**Trigger:** post-Q162 continuation of pre-registered P4 matrix

## RESOLVED — D-419

The founder authorized the recommended proof-only correction on 2026-08-25. Order
152 combines this one stale-state harness with Q164's seven inherited proof repairs;
it grants no production authority and changes no production caller or assertion.

## Exact evidence

After the financial-postings stop, the seven later isolated matrix lanes were run
independently so unrelated work could continue. Six lanes passed. In
`tests/reservation-parent-before-occupancy.integration.test.ts`, six tests passed
and the stale-preparation test failed because its test-only subclass executes:

```sql
UPDATE sellable_unit SET status = 'inactive' ...
```

through the real runtime/app-role transaction. Migration 0016 intentionally denies
that mutation, so PostgreSQL returns `42501 permission denied for table
sellable_unit` before the fixture can reach its expected `Active sellable unit`
domain conflict.

This is inherited proof-fixture drift, not a current production caller gap.
Production has no sellable-unit UPDATE caller, and D-116 explicitly deferred
sellable-unit status updates until lifecycle/mutability policy exists. Regranting
UPDATE would contradict both D-116 and Order 150.

## Decision needed

Authorize a narrow proof-only correction under Order 150 (recommended): add
`tests/reservation-parent-before-occupancy.integration.test.ts` to Scope only so
the stale-state injection uses deployment/test-harness authority outside the
runtime ACL, preserves the prepare-before-acquire race, restores the injected row,
and continues to prove zero provisional runtime artifacts. Production code,
schema, grants, states and assertions remain unchanged.

Alternative: place that fixture correction in a separate proof-maintenance order
and keep Order 150 blocked until it is approved.

Rejected: grant runtime `sellable_unit` UPDATE or weaken the expected stale-state
and rollback assertions.

The failed disposable database was removed. No migration, production caller,
assertion or permanent workbench was changed after the failure.
