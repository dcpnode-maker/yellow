# Order 086 — Atomic reservation segment move, extend and shorten

**Phase:** 4 · Reservations
**Branch:** `phase-4/reservation-segment-changes`
**Tier:** 3 — live segment history and occupancy re-arbitration
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Add one transaction-owned reservation segment service for two bounded operations:

1. extend or shorten the departure instant of the latest active segment without changing its
   start, unit type, sellable unit, rate plan or party shape; and
2. move an in-house exclusive-room segment immediately to another exclusive sellable of the same
   unit type by departing the old segment and opening the next sequence.

Both commands use exact durable idempotency, lock the reservation and all segments, release and
re-record occupancy only through `ReservationOccupancyService`, and write existing immutable facts
and outbox events in the same transaction. Failed re-arbitration restores the original segment and
claims byte-for-byte.

Phase 5 owns financial repricing/posting, and stay operations own room-condition, key and
housekeeping consequences. This order records `financial_journal_id: null` and exposes no HTTP
route, so those later orchestrators cannot be mistaken for completed behavior.

Orders 045 onward remain independent-review debt. Green builder evidence records Order 086 as
`UNVERIFIED` only.

## Natural-Solution Test

- A stay-leg change already fits `reservation_segment`; no table, column, state or event is needed.
- Same-unit departure changes preserve the segment identity and follow the canonical
  release/re-record rule.
- A physical room move never overwrites the old unit or period. It trims and departs the old
  segment, then creates `max(seq)+1` with the destination sellable.
- Inventory remains the only context that reads or writes occupancy. It may return the exact
  captured claim evidence needed for the existing `segment.moved {from_space,to_space}` event;
  reservations never query `space_occupancy`.
- V1 room moves are immediate, in-house, one-exclusive-space to one-exclusive-space and same unit
  type. Pre-arrival assignment, composite/bed moves, upgrades/downgrades, scheduled moves,
  housekeeping readiness, keys and financial consequences require their own explicit contracts.

## Scope

- `handoff/orders/086-reservation-segment-changes.md`
- `src/contexts/inventory/reservation-occupancy.ts` only to return frozen exact claim evidence from
  the existing claim/release commands; allocation and release behavior stay unchanged
- `src/contexts/inventory/index.ts`
- `src/contexts/reservations/segments.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-segment-changes.integration.test.ts`
- `src/project-status.ts` only after green proof
- `tests/founder-status.integration.test.ts` only for the exact counter change
- `handoff/PHASE-4-PLAN.md` only for completion/status text
- `handoff/GATE-3-MANIFEST.md` only after every proof is green
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/` only for a D-92 hard-floor condition

## Required work

1. Extend the existing reservation occupancy result types with a frozen, deterministic list of
   captured claims: occupancy id, space id, canonical period text, canonical claim text and
   exclusive flag. Claim and release must return the exact rows they already record/publish; do not
   add a query, DML path or new authority.
2. Add `ReservationSegmentService.changeDeparture()`. Require operation `reservation.modified`,
   exact tenant/property/reservation/segment UUIDs, expected canonical `[from,to)` period, one new
   offset-aware end instant and an exact idempotency key. Lock reservation and all segments. The
   target must be the highest sequence, own a sellable, be `booked` or `in_house`, and agree with
   the reservation state. The new end must differ, remain after the start, and for an in-house
   segment remain after the injected server clock.
3. For a departure change, release the target through inventory, reclaim the same sellable and
   segment id for `[from,new_to)`, require the returned unit type to match the stored unit type,
   update only `reservation_segment.period`, then append one existing `reservation.modified`
   fact/event with exact before/after period, `extended|shortened` classification and
   `financial_journal_id: null`. Re-arbitration or publication failure rolls everything back.
4. Add `ReservationSegmentService.moveRoom()`. Require operation `segment.moved`, exact expected
   source sellable and period, a different destination sellable, exact idempotency and an injected
   server move instant. Lock the reservation/segments. Permit only `in_house|due_out` reservation
   with the highest-sequence `in_house` segment and a move instant strictly inside its period.
5. For a move, generate the new segment id before mutation, release the old segment through
   inventory, claim `[move_at,old_to)` for the new id and destination, and require both sides to be
   exactly one exclusive physical space, different spaces and the same unit type. Update the old
   segment to `departed` with `[old_from,move_at)`, insert `max(seq)+1` as `in_house` with copied
   adults/children/rate plan and the destination identifiers, then append one existing
   `segment.moved` fact/event containing both segment/sellable/space ids, exact periods, move time
   and `financial_journal_id: null`.
6. Both commands bind tenant, actor, property, reservation, segment, expected values and requested
   values into the idempotency request. Exact replay is byte-equivalent; changed reuse conflicts.
   Wrong tenant/property, stale values, malformed/ambiguous instants, no-op, non-latest segment,
   illegal status, cross-type/composite/positional/same-space destination and absent claims persist
   nothing.
7. Inject publication failures at first, middle and final event boundaries. Compare reservation,
   segment, occupancy, fact, outbox and idempotency snapshots before/after; each failure is exact
   rollback and the same key succeeds after the publisher is restored.
8. After every proof passes, advance only builder status/manifest/ledger to 086, quote both
   protected hashes, refresh Graphify code-only with parser limits, rebuild localhost app-only
   without reseeding, open a stacked draft PR on Order 085, require replacement final-tip CI and do
   not merge.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, Dockerfile, CI, RLS, tenant context, grants, seeds or protected baseline
- A new table, column, function, state, transition, event, permission, dependency, cache, worker,
  HTTP/browser route, journal, folio, charge, refund, tax, fiscal or statutory behavior
- Editing a live segment's unit/sellable for a room move; creating a same-sequence replacement;
  deleting segment history; direct reservation SQL against `space_occupancy` or its functions
- Caller-owned tenant, actor, move time, unit type, space, occupancy claim, rate, price or financial
  result; current projection/cache/browser availability as move authority
- Moving a booked/pre-arrival, departed or cancelled segment; scheduled moves; changing the stay
  start; modifying a non-latest segment; cross-unit-type upgrade/downgrade; composite or positional
  move; silently treating missing readiness/key/financial work as completed
- Weakening inherited proofs, changing the reservation state registry, merging, approval or
  claiming independent review

## Pre-registered proof

### P0 — absent segment command is red

Import the planned public service from `tests/reservation-segment-changes.integration.test.ts` on
this branch before production code. The focused run must fail only because the service/export is
absent. Commit this order and red proof before implementation.

### P1 — same-segment extend and shorten

On a fresh migrated database, extend a booked segment and shorten an in-house segment. Each keeps
one segment identity and the exact sellable/unit/rate/party values, replaces occupancy atomically,
emits occupancy release/record plus one exact `reservation.modified`, classifies the diff correctly
and replays byte-equivalently.

### P2 — immutable room-move history

Move one in-house exclusive room at an injected server instant. The old segment becomes departed
and ends exactly at that instant; the next sequence starts at the same instant, remains in-house,
copies commercial/party shape and owns the different destination. One exact `segment.moved` names
the old/new spaces and no occupancy gap or double claim survives commit.

### P3 — conflicts and races roll back

An extension into occupied time and a move into an occupied/OOO destination leave the original
period, status and claims exact. After the blocker is released, the same key succeeds. Twenty
same-segment contenders yield one durable change; every loser has no fact/event/idempotency
artifact, and aggregate occupancy never exceeds truth.

### P4 — fail-closed scope and shape

Prove tenant/property isolation, stale expected period/source, non-latest target, illegal
reservation/segment state, invalid move clock, null sellable, same destination, cross-type,
composite, positional and same-space moves, invalid periods and changed-key reuse all persist
nothing.

### P5 — publication rollback

For extend/shorten/move, fail the first, a middle occupancy and the final reservation event. Every
domain/claim/fact/outbox/idempotency snapshot stays byte-equivalent; restoring the publisher lets
the same key succeed once.

### P6 — standing gate, map and localhost

From the top: frozen install; state; typecheck; import boundaries; complete default tests; focused
fresh Order-086 proof plus inherited reservation state/commit/HTTP/offers/lifecycle proofs;
thirteen-suite isolated gate; review coverage; licence/dependency audits; schema drift; protected
hashes; fresh isolated app-never-started `./setup.sh --db-only` at 11/11. Refresh Graphify code-only
and record semantic/parser limits. Rebuild only the persistent app, verify authenticated status
reports Order 086/review 044/debt 42, push the stacked draft PR and require replacement final-tip
CI.

## Definition of done

## Builder evidence — UNVERIFIED

- [x] P0 red evidence is committed before production code.
- [x] Departure-change and immutable move proofs pass.
- [x] Conflict, concurrency, tenant/property, hostile-input and rollback proofs pass.
- [x] Standing checks, protected hashes, Graphify, localhost and remote CI are green; the final
  evidence commit requires its replacement final-tip run before handoff.
- [x] Independent review remains exactly through Order 044; Order 086 is not self-approved.
