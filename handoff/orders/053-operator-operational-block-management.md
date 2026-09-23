# Order 053 — Operator OOO/OOS lifecycle

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-operational-block-management`
**Tier:** 3 — OOO acquires and releases authoritative occupancy
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator list, open and close out-of-order and out-of-service
intervals through the already-proven operational-block service, with a clear UI
distinction between physical removal and commercial unavailability.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/053-operator-operational-block-management.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-operational-blocks.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (exact scope literal only)
- `tests/operator-restrictions.integration.test.ts` (exact scope literal only)
- `tests/operator-rate-configuration.integration.test.ts` (exact scope literal only)
- `tests/operator-rate-pricing.integration.test.ts` (exact scope literal only)
- `tests/operator-rate-price-correction.integration.test.ts` (exact scope literal only)

## Required behavior

1. `GET /api/v1/properties/:property/operational-blocks` requires
   `inventory.blocks:read`; exact-or-ancestor property authorization precedes one
   deterministic `OperationalBlockService.listActive` call.
2. Idempotent `POST /operational-blocks` accepts only `{spaceId,kind,from,to,reason}`.
   Idempotent `POST /operational-blocks/:blockId/close` accepts only `{}`. Both require
   `inventory.blocks:write`, a matching property grant, canonical UUIDs and finite exact
   ISO instants; domain errors escape settlement for rollback before stable outer HTTP.
3. OOO open/close calls only `OperationalBlockService.open/close`; it never writes
   occupancy directly. OOS uses the same service and never creates an occupancy claim.
4. The same-origin Operations view lists active causes, selects only active spaces from
   the property inventory snapshot, explains OOO versus OOS, opens exact half-open
   intervals, and closes one cause at a time with generated in-memory idempotency keys.
5. UI copy does not promise maintenance tasks, history, policy editing, availability or
   automatic restoration beyond the command result.

## Forbidden

- Migrations, `tests/run_invariants.py`, direct `space_occupancy` writes, occupancy
  function edits, new occupancy logic, new block transitions/events, availability or
  restriction logic, OOS policy mutation, holds, reservations, tasks, bulk/history,
  projections, packages, pricing, journal, fiscal, RLS, tenant middleware, token shape,
  public hosting, local persistence, generic JSON, self-approval or merge.

## Pre-registered proofs

- **P0:** the complete focused file fails before routes, scopes, runtime wiring and view exist.
- **P1:** authorized OOO open creates one block, one exclusive claim, exact facts/events
  and reduces live physical availability for only its space; exact replay adds nothing.
- **P2:** authorized OOS open creates no occupancy claim and remains visibly distinct.
- **P3:** close releases only its OOO claim, writes exact close/release evidence, removes
  the cause from the active list, and exact replay is byte-equivalent.
- **P4:** twenty simultaneous OOO opens for one space/interval produce one 201, nineteen
  typed 409 responses, one block/claim and one durable winner claim—never loser artifacts.
- **P5:** malformed, unknown-key, missing-key, missing-scope, foreign property/tenant/
  space/block and repeated close requests persist no block, occupancy or durable claim.
- **P6:** an injected second-publish failure rolls block, occupancy, facts, first event
  and idempotency claim back; same-key retry succeeds with the real dependency.
- **P7:** the Operations UI is keyboard-labelled, responsive and both-skin, contains the
  exact OOO/OOS distinction, active-space selector and no direct SQL/persistence/policy UI.
- **P8:** Orders 030/031/037/040/042/046/048-052, standing checks, schema drift,
  protected hashes and a fresh 11/11 remain green.

## Standing checks

Run P1-P8 on fresh isolated databases, restart the complete standing gate after any
D-92 stop, perform rendered desktop/responsive open-and-close review, refresh Graphify,
commit `[codex]`, push, and open a draft stacked PR. Do not approve or merge; preserve
independent review debt.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
