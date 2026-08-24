# Order 100 — Repair inherited hold-role proof

**Phase:** 4  
**Branch:** `phase-4/repair-hold-role-proof`  
**Base:** `a2b951d`  
**Risk tier:** 1 — test-only reconciliation  
**Owner:** Codex implementation and executable verification

## Outcome

Restore the complete Order 055 operator-hold suite after Orders 096–098 deliberately
added six reservation permissions to the canonical local-review role. Preserve every
original hold UI, no-browser-occupancy and inventory/rate permission assertion while
making the exact role expectation include the later independently approved scopes.

## Natural-Solution Test

The seed is already canonical and independently approved. The natural correction is
only to update the stale exact expected permission list in its inherited consumer test;
production, seed, permissions, migrations and runtime behavior remain byte-equivalent.

## Scope

- `tests/operator-holds.integration.test.ts`
- this order, `handoff/questions/135-order-099-inherited-hold-permission-assertion.md`,
  `handoff/PHASE-4-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after green

## Required work

1. Pre-register an intentional red that reproduces P7 rejecting exactly the six
   approved reservation permissions and no other behavior.
2. Rename the stale seventeen-scope wording and extend its ordered exact expectation
   with guest, lifecycle and segment read/write scopes already provisioned by the seed.
3. Re-run all seven Order 055 tests on fresh PostgreSQL, focused assets, typecheck,
   boundaries, standing and the 11/11 referee.
4. Record Question 135 answered and keep its discrepancy history intact.

## Forbidden

- Production, seed, permission, role, schema, migration, RLS, dependency or fixture mutation
- Weak subset/contains assertions, removing original permissions, ignoring unexpected scopes,
  or deleting any hold UI/security/occupancy/replay/rollback assertion
- Any file outside Scope, self-merge or claiming broader product completion

## Pre-registered proof

### P0 — intentional red

On a fresh seeded review database, execute Order 055 P7 unchanged and record its exact
failure: received equals the approved seventeen inventory/rate permissions plus the six
Orders 096–098 reservation permissions.

### P1 — exact evolving role

The corrected assertion requires all 23 permissions in sorted order, rejects any missing
or unexpected permission, and retains every original browser-authority assertion.

### P2 — no behavioral change

All seven real hold cases pass, including placement, twenty-way race, replay, release,
authority failure and publication rollback. Production and seed files are unchanged.

### P3 — standing gate

Focused assets, typecheck, 59-file boundaries, standing, protected hashes and a fresh
84-table referee pass.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before correction.
- [ ] Exact current 23-permission role assertion passes.
- [ ] Complete Order 055 suite and standing gates pass.
- [ ] Question 135 is answered; scope is exact.
