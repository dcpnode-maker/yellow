# Order 029 — Disable unaudited application hold expiry

**Phase:** 2 · Slice 1B prerequisite
**Branch:** `phase-2/hold-expiry-hardening`
**Tier:** 3 — forward migration and occupancy-adjacent privilege boundary
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Prevent application callers from invoking the legacy global `expire_holds()` helper,
which mutates hold and occupancy state without the required audit fact and outbox event.
Repair the already-red fresh-deployment assertions inherited from Phase 1, and preserve
the immutable baseline plus occupancy referee.

## Scope

- `DECISIONS.log`
- `handoff/orders/029-hold-expiry-hardening.md`
- `migrations/0003_revoke_legacy_expire_holds.sql`
- `tests/hold-expiry-hardening.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/schema/expected.sql` (runner-generated only)
- `handoff/questions/032-order-029-ledger-row-type.md`
- `handoff/questions/032-ARCHITECT-RESPONSE.md`
- `handoff/questions/033-order-029-readonly-ledger-proof.md`
- `handoff/questions/033-ARCHITECT-RESPONSE.md`

## Required changes

1. Add a forward migration that revokes every PUBLIC and `app_role` privilege on
   `expire_holds()` without changing its body.
2. Document on the function that only the deployment owner may retain it for controlled
   maintenance until audited application expiry replaces it.
3. Prove `app_role` lacks EXECUTE and receives SQLSTATE 42501 when it attempts a call.
4. Update fresh-deployment evidence to expect every exact migration ledger entry now in
   the repository and object-shaped seed config per D-96/D-118.
5. Regenerate, never hand-edit, the schema snapshot.

## Forbidden

- Editing `migrations/0001_init.sql`, `migrations/0002_kernel_consumer_cursor.sql`,
  `tests/run_invariants.py`, or any product TypeScript.
- Changing `expire_holds()` behavior, dropping it, invoking it on live holds, or changing
  `record_occupancy()` / `release_occupancy()`.
- New tables, statuses, events, RLS policies, hold commands, workers, or schedulers.
- Weakening exact migration checksum, seed shape, denial SQLSTATE, schema drift, or 11/11
  assertions.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** migration ledger is exactly versions 1, 2, and 3 with correct filenames and
  SHA-256 checksums.
- **P2:** no PUBLIC execute ACL remains and `has_function_privilege('app_role', ...)` is
  false.
- **P3:** an `app_role` session calling `expire_holds()` fails with SQLSTATE 42501.
- **P4:** canonical seed config is a JSON object and fresh deployment acceptance is green.
- **P5:** generated schema matches; migration 0001, migration 0002, and the referee are
  byte-identical to branch base.
- **P6:** canonical referee remains exactly 11/11.

## Standing checks

Run migration integration, fresh deployment acceptance, the Order 029 denial proof,
typecheck, boundaries, full tests, licence check, audit, schema drift, and
`./setup.sh --db-only`. Commit and push only when all are green. Do not merge.
