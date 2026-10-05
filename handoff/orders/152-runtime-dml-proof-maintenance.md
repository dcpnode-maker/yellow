# Order 152 — Align inherited proofs with positive runtime DML

**Status:** READY — D-419
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/runtime-dml-proof-maintenance`
**Base:** `aff09155d68ad3f69cd0a119e24b79e7f876fc56` — immutable Order-150 positive-catalogue checkpoint
**Risk tier:** 2 — proof-fixture and oracle maintenance only
**Owner:** Codex implementation; independent review remains part of Order-150/151 cumulative exit
**Dependency:** Order 150 P2/P4 cannot finish until these inherited proofs run under the contracted authority

## Outcome

Correct eight inherited test fixtures/oracles that accidentally depend on blanket
runtime mutation, deploy/owner ambiguity or one cost-equivalent PostgreSQL plan. Keep
every substantive tenant, rollback, ordering, crash, tamper and index proof intact.

## Scope

- `tests/reservation-parent-before-occupancy.integration.test.ts`;
- `tests/reservation-lifecycle.integration.test.ts`;
- `tests/reservation-segment-changes.integration.test.ts`;
- `tests/fact-log.integration.test.ts`;
- `tests/outbox.integration.test.ts`;
- `tests/idempotency.integration.test.ts`;
- `tests/relay.integration.test.ts`;
- `tests/party-profiles.integration.test.ts`;
- this order, D-419/Q163–Q164, additive ledger and review metadata.

No production source, migration/schema, role/grant/policy, state/event, dependency,
fixture outside these eight files, protected referee, runner, setup or documentation
file is in scope.

## Required implementation

1. Reservation-parent stale preparation uses deploy/test-harness authority outside the
   runtime ACL, preserves the prepare-before-acquire race, restores injected state and
   still proves zero provisional runtime artifacts.
2. Reservation lifecycle/segment observation tables explicitly permit the existing
   yellow_owner trigger execution; production trigger/function authority is unchanged.
3. Fact-log app_user and outbox/relay task fixtures use deploy authority or an already
   authorized aggregate/effect shape. Runtime app_user/task mutation remains denied.
4. Idempotency asserts exact column INSERT/UPDATE catalogue rather than obsolete
   table-level privilege booleans, without weakening behavioral idempotency proofs.
5. Party proof requires both named indexes to exist and an index-backed tenant plan,
   accepting either correct cost-equivalent tenant-leading index selected by pinned
   PostgreSQL 16.15. Contact/trigram exact-index proofs remain unchanged.

## Pre-registered proof

### P0 — exact v16 inherited red

Reproduce every Q163/Q164 failure on isolated exact v16 databases and classify it as
fixture/oracle failure rather than production authority need.

### P1 — no authority widening

Run the Order-150 focused catalogue before and after the corrections; it must remain
byte-equivalent. Prove runtime sellable_unit/app_user/task mutations and table-level
idempotency DML stay denied.

### P2 — corrected inherited proofs

Run all eight files on fresh isolated databases with their contract-correct fixtures.
Every original substantive assertion remains present and green; crash/retry/order,
tenant isolation, rollback, tamper, parent sequencing and index existence are exact.

### P3 — cumulative

Run standing/static gates and the complete isolated phase matrix. Order 150 remains
blocked on Order 151 for the separate product-authority gap; this order must not hide
or alter that failure.

## Forbidden

- Any production/migration/grant change or new fixture file.
- Restoring runtime sellable_unit, app_user or task mutation.
- Weakening tenant, rollback, crash, ordering, tamper, parent or index assertions.
- Treating a fixture repair as product completion; self-review, merge or deployment.

## Definition of done

- [ ] All eight exact Base failures reproduced and classified.
- [ ] Corrections stay inside the eight test files with zero ACL/catalogue change.
- [ ] All corrected suites and cumulative non-product gates pass.
- [ ] Independent cumulative review confirms proof strength and scope.
