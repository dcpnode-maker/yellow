# Order 087 — Exact reservation guests and share allocation

**Phase:** 4 — Reservations  
**Tier:** 2  
**Branch:** `phase-4/reservation-guests-shares`  
**Base:** `phase-4/reservation-segment-changes` at `c92b096`  
**Status:** BUILDER-AUTHORED · UNVERIFIED

## Why this order is deliberately narrower than the reserved plan row

The Phase-4 plan grouped guests, shares, alerts and waitlist offers. Preflight found that the
immutable baseline can represent exact reservation guests and `share_pct`, but it has no durable
waitlist-offer window and no canonical alert activation lifecycle. Inventing either in application
code would cross the D-92 migration/state floor. This order therefore completes only the natural
schema-backed guest/share unit. Alerts and waitlist offers remain explicit Phase-4 work, not hidden
inside `waitlist_entry.stay_dates`, free-form status strings, alert messages, facts or outbox payloads.

## Natural-Solution Test

The natural implementation is one reservation-context service over the existing
`reservation_guest` table. It locks one same-property reservation, compares a canonical allocation
hash, validates same-tenant active people and an exact sharer total, replaces only non-primary rows,
and emits the existing `reservation.modified` fact/event in the same transaction. It does not need
a migration, second guest store, new event, reservation state, HTTP route or financial side effect.

## Scope

- `src/contexts/reservations/guests.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-guests.integration.test.ts`
- `handoff/orders/087-reservation-guests-shares.md`
- `DECISIONS.log`
- `handoff/PHASE-4-PLAN.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`

## Forbidden

- Every file in `migrations/`, including `migrations/0001_init.sql`.
- `tests/run_invariants.py`, occupancy claims or logic, RLS/tenant policy, authentication,
  idempotency-kernel behavior, journal/fiscal/payment/tax logic, rate publication and cancellation
  waiver behavior.
- Alert or waitlist writes; new alert/waitlist states; an invented offer expiry; a new table,
  column, state, transition, event, permission, worker, HTTP route or browser surface.
- Editing `reservation.primary_party`; deleting/replacing the primary guest; PII in facts/events;
  client-supplied tenant, actor, audit, property, computed hash result or database authority.
- Treating builder evidence as independent review, merging this branch, or advancing review beyond
  Order 044.

## Contract

### Query

`readAllocation(tx, scope)` accepts exact tenant, property and reservation UUIDs from a trusted
internal caller. It returns a deeply frozen canonical allocation sorted primary first and then by
party UUID, plus a lowercase SHA-256 hash of exactly `{partyId,role,sharePct}` rows. Numeric shares
cross the context boundary only as fixed two-decimal strings. The query requires the transaction's
`app.tenant_id` to match and returns not-found for another tenant/property.

### Replace command

`replaceAllocation(tx, input)` requires:

- audit operation `reservation.modified`, a visible-ASCII idempotency key and exact expected hash;
- a same-tenant, same-property reservation in `reserved`, `due_in`, `in_house` or `due_out`;
- the stored primary row to match `reservation.primary_party`, with role `primary` and null share;
- 0–128 unique non-primary entries naming active same-tenant `person` parties;
- role `accompanying` with `sharePct: null`, or role `sharer` with canonical `0.01`–`100.00`;
- when sharers exist, their integer hundredths total exactly `100.00`; when none exist, no share is
  stored.

Inside the idempotent command, lock the reservation and its guest rows, recompute the expected hash,
reject stale input, replace only non-primary rows and return the exact frozen before/after hashes,
allocation and added/removed/changed party ids. Include authenticated actor and property in the
idempotency request hash. Exact retry replays; changed actor/property/body under the same key
conflicts. A no-op replacement succeeds once with empty deltas but still produces one attributable
command fact/event, so the audit envelope matches the acknowledged action.

Write one `reservation.modified` fact and the existing `reservation.modified {diff}` outbox event
in the same transaction. Payload contains party ids, roles, shares, hashes and deltas only—never
party names, contact data, identity documents or arbitrary profile JSON.

## Pre-registered proof

### P0 — intentional red

Commit this order and a focused proof that imports the absent `ReservationGuestService`. Run it and
record the failing output before adding production code.

Observed before production code: Bun exited 1 because the named `ReservationGuestService` export
was absent; `0 pass`, `1 fail`, `1 error` across the one-file precondition proof.

### P1 — exact allocation

On a fresh migrated/seeded database, prove the commit-created primary remains exact; add
accompanying guests; add 2/3/4 sharers whose canonical hundredths total exactly 10000; replace and
remove non-primary rows; read rows in canonical order; and prove all returned objects are frozen.
Database numeric text, response strings and hashes must agree exactly.

### P2 — fail closed

Reject duplicate/primary/foreign-tenant/foreign-property/missing/inactive/non-person parties,
invalid UUIDs/roles/share strings, fractional precision tricks, zero/negative/over-100 shares,
totals 99.99/100.01, more than 128 entries, stale hashes, wrong audit operation, invalid key and
terminal/waitlist reservation statuses. Every rejected command leaves guest/fact/outbox/idempotency
snapshots byte-equivalent.

### P3 — concurrency and idempotency

Two different replacements using the same expected hash race: exactly one succeeds and one returns
stale conflict; no mixed allocation is visible. Exact retry replays without duplicate evidence.
Same key with another actor, property or allocation conflicts. Failed first/middle/final publisher
injection is not a valid shape because this command emits exactly one event. Instead inject one
failure at each real transaction boundary: guest-row insertion, fact insertion and the single event
publication. Each rolls back every guest/fact/outbox/idempotency write, and removing the injection
lets the same key succeed once.

### P4 — inherited and standing evidence

Restart from the top: frozen install; state; typecheck; import boundaries; complete default tests;
fresh Order-087 proof; reservation commit/HTTP/offers/lifecycle/segments proofs; thirteen-suite
isolated database gate; review coverage; licence/audit/schema drift; protected hashes; fresh isolated
app-never-started `./setup.sh --db-only` at 11/11. Refresh Graphify code-only, rebuild only the
persistent app, verify Order 087/review 044/debt 43, push a stacked draft PR and require replacement
final-tip CI.

## Definition of done

## Builder evidence — UNVERIFIED

- [x] P0 red evidence is committed before production code.
- [ ] Exact allocation, validation, concurrency, idempotency and rollback proofs pass.
- [ ] Inherited/standing checks, protected hashes, Graphify, localhost and final-tip CI are green.
- [ ] Alerts and waitlist offers remain explicit deferred work; no schema/state substitute exists.
- [ ] Independent review remains exactly through Order 044; Order 087 is not self-approved.
