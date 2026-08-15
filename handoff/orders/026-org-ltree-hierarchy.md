# ORDER 026 — org ltree hierarchy queries

**Phase:** 1 · **Branch:** `phase-1/org-ltree` · **Tier:** 2
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-92

## Goal

Answer "which properties are under this brand, under this chain" correctly and with an
index, using the baseline's `ltree` column.

## Position in the phase

Independent of the outbox chain (022–023). If you want two tracks, this one can run in
parallel with them. It depends only on Order 019.

## Scope

`src/contexts/identity/` org queries, `src/kernel/index.ts` if exports are needed,
`tests/org-hierarchy.integration.test.ts`, fixture rows for a three-level hierarchy.
`ltree` and the org table are baseline — **no migration**.

## Required behaviour

1. Ancestor, descendant and sibling queries use `ltree` operators (`<@`, `@>`, `~`) and
   hit a GiST index. Prove the index is used; a correct query that seq-scans is a Phase 5
   incident waiting to happen.
2. Every query is tenant-scoped — an ltree path must never cross a tenant boundary.
3. Depth is not assumed. Chain → brand → property is the common case, not the only one.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Correctness | properties under a brand, brands under a chain, and the full ancestor chain of a property |
| P2 | **Index is used** | `EXPLAIN` output showing a GiST index scan, not a sequential scan |
| P3 | Tenant isolation | an ltree query as tenant B returns nothing from tenant A's tree, even with a crafted path |
| P4 | Depth independence | a four-level hierarchy answers correctly with no code change |
| P5 | Cycle safety | an attempt to create a cycle is rejected |

P2 is the one worth the order. P3 is the one worth the tier — a path-based query that
forgets the tenant predicate is a cross-tenant read that looks like a feature.

## Forbidden

Recursive CTE walking in place of `ltree` operators · hardcoding three levels ·
tenant-unscoped hierarchy queries · editing `migrations/` or `tests/run_invariants.py` ·
merging.

## Phase 1 exit

Order 026 completes Phase 1. Do not start Phase 2. Write
`handoff/questions/NNN-phase-1-review-request.md` with the order/commit table, the full
D-87 self-check output, and every pre-registered proof from Orders 019–026. The architect
re-executes them at the exit gate per D-84, then writes Phase 2's plan — that is the point
at which the information to write it exists.
