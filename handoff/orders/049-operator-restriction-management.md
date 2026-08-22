# Order 049 — Operator restriction management

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-restriction-management`
**Tier:** 3 — authenticated commercial sellability mutations
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator list and create real manual restrictions from the local
workbench, then observe their existing availability effect. Reuse `RestrictionService`,
the Order 047 replay primitive, and the Order 048 rollback-before-HTTP boundary.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/049-operator-restriction-management.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/server.ts`
- `tests/operator-restrictions.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (D-174 exact scope expectation only)
- `tests/review-seed.integration.test.ts`

## Required behavior

1. Add exact coarse scopes `inventory.restriction:read` and
   `inventory.restriction:write`; the deterministic local review role gains both.
2. `GET /api/v1/properties/:property/restrictions` requires restriction-read and a
   matching exact-or-ancestor property grant, then returns `RestrictionService.list`
   ordering unchanged.
3. `POST /api/v1/properties/:property/restrictions` accepts an exact-key body containing
   `restrictions` with 1..100 strict drafts supported by D-137. It requires
   restriction-write, matching property grant, and `Idempotency-Key`.
4. Creation runs through `PostgresIdempotency.execute` and
   `RestrictionService.createBatch` in tenant middleware's existing transaction. Property
   is part of request identity; success/replay is exact 201 plus replay header.
5. Every typed or unexpected command error escapes transaction settlement before the
   outer boundary maps stable 400/404/409 or generic correlated 503. No incomplete claim,
   restriction, fact or event may commit.
6. Add one Restrictions workbench domain using the shared token skins. Show deterministic
   active rows and a progressive form for kind, half-open dates, conditional integer
   value, optional room type and optional channel. Explain that end date is exclusive.

## Forbidden

- Migrations, `tests/run_invariants.py`, availability evaluation changes, occupancy,
  OOO/OOS, holds, rates/prices, journal, fiscal, RLS, tenant middleware, token claims,
  update/delete, automation/RMS, public hosting, or generic table CRUD.
- Browser persistence, direct SQL, caller-supplied tenant/actor/source, hidden protected
  states, approval, merge, or independent-review claims.

## Pre-registered proofs

- **P0:** complete focused file fails before restriction routes/services/UI exist.
- **P1:** authorized read is deterministic and tenant/property isolated.
- **P2:** a manual closed restriction creates exactly one row, fact and event; the existing
  availability query exposes it and marks the overlapping option non-bookable.
- **P3:** exact replay is byte-equivalent with no new artifacts; changed request conflicts.
- **P4:** missing key, unknown keys, invalid dates/value/kind, missing scope, foreign
  property and foreign tenant persist no restriction or idempotency claim.
- **P5:** publisher failure rolls restriction, fact and claim back; same-key retry succeeds.
- **P6:** UI is same-origin, in-memory only, accessible, both-skin, conditionally explains
  value semantics, and has no database shortcut.
- **P7:** deterministic review seed reruns as a no-op and login carries all five workbench
  scopes; Order 048 and availability behavior remain green.
- **P8:** complete standing gate and fresh db-only referee remain green at 11/11; protected
  files remain byte-identical.

## Standing checks

Run P1-P7 on fresh isolated databases, restart the complete standing gate, perform
rendered desktop/mobile review, refresh Graphify, commit `[codex]`, push, and open a draft
stacked PR. Do not approve or merge; preserve independent review debt.
