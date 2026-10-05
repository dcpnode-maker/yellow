# Order 687 independent review — linked group creation and membership

2026-09-24. Reviewer: Codex non-implementing agent `order679_independent_review`. I did not implement the group service, API, UI, migration, tests, or release metadata. All database proof below ran against synthetic data on the isolated PostgreSQL 18.6 `yellow-order687-proof` container, loopback port 55687, database `yellow_order687_proof`; no serving database or real hotel record was touched.

## Decision

**Approve the scoped Order 687 source and migration 0101 for the coordinator's guarded release preparation.** This is not approval to skip migration 0100 or a claim that the group workspace is already live. Root must still complete exact live frontier/backup/role validation, ordered checksummed 0100→0101 migration, mounted desktop/mobile acceptance and rollback readiness before publication.

## Findings and corrections inspected

- The first candidate lookup returned in-house/cancelled reservations. It now returns only reserved/due-in candidates. It also fails closed when a stored membership points at a group outside the same tenant/property. I personally executed the new hostile SQL case with an other-property group reference after the fix.
- The initial attach query took `FOR UPDATE` on `reservation_group`, which the intentionally insert-only runtime grant could not perform. The unnecessary group lock was removed; the reservation row remains locked, and the exact `group_id IS NULL` compare-and-set remains in the update. The real concurrent two-group race admits one winner and one fact/event pair.
- The UI parent mounts the workspace with `key={propertyId}`, preventing previous-property pending attempts and details from being reused after a property change. The UI now persists each pending creation/attachment key and exact request identity to session storage synchronously before sending its POST/PUT, then retains it for uncertain retry. It does not manufacture a block, allotment, inventory or financial result.
- The HTTP adapter validates exact bodies and query shapes, uses current lifecycle scope and current property grant before service invocation and before a same-key replay, and derives tenant/actor from authenticated context. The mock HTTP proof includes revoking the property grant after a previous accepted key. The service additionally enforces transaction-local `app.tenant_id`, property identity, linked kind, eligible reservation status, and expected-null membership.
- Migration 0101 adds only `app_role` INSERT on seven `reservation_group` columns and UPDATE on `reservation.group_id`; it does not grant blanket reservation UPDATE or create a new table/function. Direct app-role column DML is a retained transitional capability debt: authorized application commands, not raw SQL, are responsible for same-transaction fact/outbox emission. The Order 687 command path does emit both atomically; a forced event failure rolls back the group header, fact and idempotency claim.
- The implementation reuses the existing `reservation_group` primitive. A linked group holds no rooms and does not touch `space_occupancy`, availability, journals, payer, folio, price or policy. Existing block/group kinds remain read-only in this workspace.

## Personally executed proof

- `bun test --timeout 15000 tests/order687-groups.integration.test.ts` with `YELLOW_REQUIRE_ORDER687_DB=1` and isolated deploy/runtime URLs: **6 pass, 0 fail, 29 assertions**. Cases cover exact-key replay/different-body conflict, tenant/property isolation, reserved/due-in and wrong-lifecycle guards, concurrent membership CAS, injected outbox failure rollback, direct runtime ACL/RLS denial, and incoherent cross-property stored membership. The test also verified one persisted fact and outbox event per successful attachment and no occupancy/journal count change.
- Loaded the canonical `tests/seed_fixture.sql` only into that disposable database, then ran `python tests/run_invariants.py yellow_order687_proof` with the isolated DSN: **11 passed, 0 failed of 11**. This includes 50-thread occupancy exclusion, insert-only denial, balanced/sealed financial checks, numbering, and table/view tenant RLS.
- `bun test tests/order687-groups.test.ts tests/order687-groups.http.test.ts tests/order687-groups.ui.test.ts tests/build-readiness.test.ts` after the final UI persistence adjustment: **17 pass, 0 fail, 289 assertions**.
- `bun run typecheck` passed both backend and frontend; `bun run boundaries` reported **208 TypeScript files scanned**.
- Directly read the isolated `schema_migration` ledger: **101 rows/max version 101**; entries 0099, 0100 and 0101 SHA-256 checksums exactly match their current source files. Direct privilege inspection showed the intended seven new group INSERT columns and reservation `group_id` UPDATE for `app_role`.
- Inspected `tests/schema/expected.sql` diff: **16 added ACL lines, no deletions**. A raw PG18.6 dump cannot match the canonical PG16.15 snapshot byte-for-byte: its first mismatch is the dump-version header at line 6, with known version-format differences beyond it. I do not claim a green full `schema:check` against that version-mismatched snapshot.
- Inspected the release metadata admission: `CURRENT_MIGRATION_FRONTIER` changes 99→101 and matching readiness/local-review expectations change; function-specific fiscal contract identities remain unchanged. `tests/build-readiness.test.ts` itself passed **8/0/250** in the independent run above.

## Release boundary

The live database was reported at frontier 99. The accepted Order 635 independent review covers 0100 on its own isolated PostgreSQL proof, but this Order 687 proof does not replace a fresh exact-target live preflight. Root must verify the live ledger/checksums and backup, apply 0100 then 0101 through the normal runner on the named target, confirm role/owner/grant and readiness state, and perform the actual browser/release checks. No direct serving migration, deployment, PR or merge was performed by this reviewer.

## Final pending-key fail-closed follow-up

After the approval above, the UI changed `persistAttempt` to return success/failure. I inspected both mutation handlers: each now requires a successful synchronous `sessionStorage` write of the exact name/group/reservation and idempotency key **before** starting its network command. If storage is unavailable, it displays an error and sends no mutation. Definitive rejection and successful authoritative refresh clear the retained attempt; an uncertain result keeps it for same-key reconciliation. The component is also keyed by `propertyId` internally. I did not implement this adjustment.

I personally reran `bun test tests/order687-groups.ui.test.ts` (**1 pass, 0 fail, 4 assertions**) and `bun run typecheck:frontend` (pass). The existing UI test is SSR/render proof, not an interaction test of disabled session storage; the fail-closed conclusion here is from direct source inspection. The scoped source approval stands.
