# Order 190 — Current project status through Order 189

**Status:** CHANGES REQUIRED — D-500
**Phase:** 5 — Financials  
**Risk:** Tier 1 (founder-visible recorded-status truth only)  
**Base:** `628d1591b5c392ab3aace7fcd6e9cee80c68f2a1`

## Outcome

Refresh the authenticated Project Status snapshot from the stale Order 178/179
position to the independently verified Order 189/190 position without changing the
runtime, product workflows, review counter, database, or phase claims.

## Scope

- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and its independent review record

No HTML, CSS, client JavaScript, API shape, schema, migration, seed, credential,
Compose, runtime, permission, dependency, merge, push, deployment, or Phase-wide
completion change is admitted.

## Required truth

1. `latestBuiltOrder` is 189, `currentOrder` is 190, and `recordedAt` is 2026-08-27.
2. Preserve all existing recorded work and append only independently approved Orders
   179–186, 188, and 189 in chronological order.
3. Exclude Order 187: it never received complete browser approval and was superseded
   by the independently approved Order 188 product.
4. `independentlyReviewedThroughOrder` remains exactly 91; later approval evidence is
   represented in `recordedWork`, not mislabelled as a contiguous review-through run.
5. Descriptions distinguish offline seed authority (181), bounded local imports and
   promotions (180, 182, 186, 189), product approvals (179, 183–185, 188), preserved
   founder CRUD drift, and sole-local scope.
6. Phase states remain reviewed for 0–3, built-unverified for 4, active for 5, and
   planned for 6–12.

## Proof

- Focused founder-status tests prove all exact fields, chronology, inclusion and
  explicit Order-187 exclusion.
- `bun test tests/founder-status.integration.test.ts`
- `bun run typecheck`
- `bun run boundaries`
- `bun run license-check`
- `bun audit`
- asset gzip limit and `git diff --check`
- independent non-implementing review of the exact candidate before local promotion

## Forbidden

- Inflating the contiguous independent-review counter beyond 91.
- Recording Order 187 as approved or built current truth.
- Claiming merge, push, public/production deployment, or Phase 5 completion.
- Mutating the local stack or persistent database in this order.
