# Order 369 — Phase-6 standing status-oracle correction

**Status:** ACTIVE-D1037
**Phase:** cross-phase recorded-status proof repair
**Branch:** `phase-6/standing-status-oracle-correction`
**Base:** exact D1028 Phase-6 reviewed truth at `5d7bd9a`
**Risk tier:** 1 — test-only stale recorded-status expectation
**Owner:** Codex

## Outcome and exact scope

Change only `tests/current-management-demo-status.intentional-red.test.ts` so its
phase-state vector expects Phase 6 `reviewed`, matching the independently approved
D974 exit evidence and the canonical D1028 status correction. Preserve every other
Order311 historical assertion unchanged.

Run the focused status oracle, the focused founder-status suite, typecheck, diff
hygiene and the full standing suite. This order changes no product/status source,
review coverage, database, UI, local, credential, migration or phase completion.

## Forbidden

No weakening/removal/skip of the oracle; no source, runtime, local, `.yellow`,
port3000, merge or deployment change.
