# Order 369 — Phase-6 standing status-oracle correction

**Status:** COMPLETE-D1038 — exact candidate `d447cca`
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

## Evidence

The exact one-line oracle correction passes focused 1/0 (8), founder status 5/0
with 2 expected database skips (96), typecheck and diff hygiene. A clean detached
exact-candidate standing run with canonical dependencies passes 1216/0 with 946
expected database skips and 18,519 assertions. No product source or runtime changed.
