# Order 039 — Classify exclusion-deadlock OOO losers at the domain boundary

**Phase:** 2 · Slice 2H correction
**Branch:** `phase-2/oos-sellability-policy`
**Tier:** 3 — occupancy conflict boundary
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Return one stable domain conflict for every losing concurrent OOO claim while leaving
PostgreSQL as the sole winner arbiter.

## Scope

- `DECISIONS.log`
- `handoff/orders/039-operational-block-deadlock-classification.md`
- `src/contexts/inventory/operational-blocks.ts`

Question/response 045 are governance artifacts under the D-92 exception.

## Required behavior

1. Inside the existing `record_occupancy` error boundary only, classify PostgreSQL
   SQLSTATE `40P01` alongside the existing exclusion/function conflict codes.
2. Return the existing `OperationalBlockConflictError`; do not retry, add locks, or
   change transaction/occupancy semantics.
3. Every other error remains unaltered and propagates.

## Forbidden

- Any migration, occupancy-function or direct occupancy DML change.
- Any OOO/OOS lifecycle, evidence, fact, event, range, availability, restriction,
  policy, hold/reservation, projection/cache, RLS, tenant middleware, journal/fiscal,
  referee, dependency, HTTP, or UI change beyond the one error classification.
- Weakening or editing Order 037 P7; self-approval or merge.

## Pre-registered proofs

- **P1:** three consecutive clean-process executions of the unchanged complete Order
  037 proof each produce 7 pass / 0 fail; every 20-way P7 race has one winner and all
  nineteen losers are `OperationalBlockConflictError`.
- **P2:** the unchanged real-hold P4 conflict and publisher rollback P6 remain green.
- **P3:** Order 038 plus standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run Order 037 three consecutive times, then Order 038, typecheck, boundaries, full
tests, licence policy, audit, schema drift, and `./setup.sh --db-only`. Commit and push
only when all are green. Do not merge.
