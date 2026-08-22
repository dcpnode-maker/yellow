# Order 055 — Operator cart-hold management

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-cart-hold-management`
**Tier:** 3 — existing occupancy-backed hold lifecycle
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized operator place a ten-minute cart hold directly from a real bookable
availability option, see active holds, and release one hold, using only the existing
audited `HoldService` occupancy choke point.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/055-operator-cart-hold-management.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-holds.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (exact scope assertion only)
- `tests/operator-restrictions.integration.test.ts` (exact scope assertion only)
- `tests/operator-rate-configuration.integration.test.ts` (exact scope assertion only)
- `tests/operator-rate-pricing.integration.test.ts` (exact scope assertion only)
- `tests/operator-operational-blocks.integration.test.ts` (exact scope assertion only)
- `tests/operator-oos-policy.integration.test.ts` (exact scope assertion only)

## Required behavior

1. `GET /api/v1/properties/:property/holds` requires `inventory.holds:read`, an
   exact-or-ancestor property grant, and returns only `HoldService.listActive` truth in
   deterministic service order.
2. Idempotent `POST /api/v1/properties/:property/holds` requires
   `inventory.holds:write`, a matching property grant and exact body
   `{sellableUnitId,from,to,holderReference}`. The edge converts bounded UTC strings,
   sets `ttlSeconds` to exactly 600, stores holder exactly `{reference}`, and calls only
   `HoldService.place` with `hold.created`.
3. Idempotent `POST /api/v1/properties/:property/holds/:holdId/release` requires the
   write scope, matching property grant and exact empty body. It calls only
   `HoldService.release` with `hold.released`.
4. Hold conflict maps to 409; stable validation/not-found and unexpected failures map
   only after the tenant transaction rolls back, so hold, occupancy, fact, event and
   durable claim remain atomic.
5. Availability renders a ten-minute hold action only for bookable options, requires a
   bounded holder reference, refreshes active holds and availability after place/release,
   and explains that a hold is temporary inventory protection, not a reservation.

## Forbidden

- Any direct `hold` or `space_occupancy` SQL outside tests; any direct call to
  `record_occupancy`, `release_occupancy` or legacy expiry helpers; occupancy algorithm
  edits; new hold states or transitions; consume/expire flows; reservation/guest/profile
  creation; configurable/offline/manual leases; arbitrary holder JSON; client-supplied
  expiry or TTL; availability/restriction/policy calculation in HTTP or browser;
  migrations, RLS, tenant middleware, token shape, journal/fiscal, public hosting,
  persistence, self-approval or merge.

## Pre-registered proofs

- **P0:** the complete focused file fails before routes, scopes, wiring and UI exist.
- **P1:** authorized active-list is empty initially, deterministic, property-scoped and
  carries no write evidence.
- **P2:** one ten-minute placement writes exactly one hold, one canonical room claim,
  one fact, exact hold/occupancy events, holder reference and durable response; real
  availability for only that option decreases.
- **P3:** exact replay is byte-equivalent, changed-body key reuse conflicts, and twenty
  distinct simultaneous placements against one exclusive room produce one winner and
  no loser artifacts or durable successful claims.
- **P4:** release is byte-replayable, writes one exact transition, removes only the
  captured claim, leaves no active-list row and restores real availability.
- **P5:** malformed/unknown/missing-key, missing-scope, foreign property/tenant and
  already-released calls persist no extra hold, occupancy, fact, event or claim.
- **P6:** publisher failure during place and release rolls all domain/evidence/claim
  artifacts back; the same key succeeds after retry with the real dependency.
- **P7:** unchanged Order 030 place/release/race proofs and Orders 031/040/053-054 remain
  green; same-origin both-skin responsive UI has no storage, direct occupancy or generic
  holder path; the review role has exactly fifteen scopes.

## Standing checks

Run P1-P7 on fresh isolated databases, restart after any D-92 stop, perform rendered
desktop/responsive place/list/release review, refresh Graphify, commit `[codex]`, push,
and open a draft stacked PR. Do not approve or merge; preserve independent review debt.
