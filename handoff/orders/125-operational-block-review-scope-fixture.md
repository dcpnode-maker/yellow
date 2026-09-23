# Order 125 — Align the Order 053 scope fixture with the approved review role

**Status:** DONE / VERIFIED — fixture-only correction independently executed by the coordinator
**Phase:** 5 · Proof maintenance
**Branch:** `phase-5/operational-block-review-scope-fixture`
**Base:** `a2540fdf76f6436f2b59f3d09345b5b054d569c3` (independently approved Order 120 metadata head)
**Risk tier:** 1 — test expectation only; production diff forbidden
**Owner:** Codex implementation; routine independent proof

## Outcome

The existing Order 053 P7/P8 proof asserts the exact currently approved 27-scope
`Local Availability Reviewer` role instead of its retired 17-scope snapshot. No
permission, seed, token, adapter, product, schema, or runtime behavior changes.

## Exact scope

### In scope

- `tests/operator-operational-blocks.integration.test.ts` — only the inline expected
  permission array inside the test labelled `P7/P8: Operations assets are typed,
  same-origin, responsive and exact-scope`;
- `handoff/orders/125-operational-block-review-scope-fixture.md` — final evidence;
- `DECISIONS.log` and `handoff/LEDGER.md` — exact builder provenance after green gates.

### Explicitly out of scope

- every file under `src/`, `migrations/`, `scripts/`, and every other test;
- review-seed permissions, role grants, tokens, authentication, authorization,
  operator assets, operational-block commands, idempotency, facts, events, RLS, and
  any Cyber finding;
- dependency, schema, API, UI, merge, push, deployment, or live-status changes.

If the proof cannot turn green by adding only the ten exact Question-142 scopes to
that one expected array in canonical sorted order, stop; do not widen scope.

## Required proof

1. On the exact base, run the fresh Order 053 suite and record that its six product
   cases pass while only P7/P8 fails with received 27 versus expected 17 scopes.
2. Add exactly the ten Question-142 scope strings to the named inline expectation in
   the same order returned by `ORDER BY permission.code`. Do not edit the test body,
   production seed, source, label, or any other assertion.
3. On a new fresh database, personally pass the complete Order 053 suite, including
   all operational-block behavior and the exact 27-scope P7/P8 assertion.
4. Run typecheck, import boundaries, the standing test suite, licence/audit, exact
   schema/protected hashes, and a pristine app-never-started referee 11/11.
5. Verify `git diff --name-only` contains no product, migration, script, dependency,
   or unrelated test file.

## Completion boundary

Reserve D-355 for the exact fixture correction and its proof. Completion repairs only
the inherited Order 053 test expectation. It does not alter or reapprove production,
close an Order 121/Cyber finding, authorize merge/push/deployment, or imply any wider
scope correction.

## Builder evidence (2026-08-24)

Implementation commit `8fb42bb3c1e99c7bcee45d8b7bfd7fab908e0290` changes only the named P7/P8 expected permission
literal, adding the ten Question-142 scopes in the `ORDER BY permission.code` order.
The exact-base fresh database attempt is environment-blocked before database startup:
`setup.ps1 -DbOnly` reports that Docker is unavailable on this host. `git diff --check`
passes and `license-check` passes; typecheck and import-boundary execution are also
environment-blocked because this isolated worktree has no installed `typescript`
package (`tsc` not found; boundary script cannot resolve `typescript/unstable/ast`).
Coordinator independent proof must run the fresh Order-053 baseline/red reproduction,
27-scope green suite, standing gates, exact hashes, and pristine referee.

## Coordinator verification (2026-08-24)

The coordinator personally verified exact implementation SHA
`8fb42bb3c1e99c7bcee45d8b7bfd7fab908e0290` on isolated Compose project
`yellow-order125-gate`. The complete Order 053 suite passed 7/7 with 42 assertions;
standing tests passed 170/0 with 395 skipped and 1,931 assertions; typecheck, 64
import boundaries, 23 installed-package licences and dependency audit passed. A fresh
85-table database passed the invariant referee 11/11, schema drift was exact, and
protected hashes remained
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
`3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
The exact implementation diff changes only the named test fixture plus its planning
order/question; no production, seed, authorization, migration or schema file changed.
