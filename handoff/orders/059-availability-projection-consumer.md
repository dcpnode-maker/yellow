# Order 059 — Durable availability-projection event consumer

**Phase:** 2 · Inventory and occupancy completion
**Branch:** `phase-2/availability-projection-consumer`
**Tier:** 3 — event-driven occupancy-derived state
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Keep Order 058's disposable PostgreSQL availability projection convergent after relevant
inventory events. A named durable outbox consumer derives the smallest honest property-local
date range from each event and calls the existing `AvailabilityProjectionService` inside the
consumer transaction. Cursor acknowledgement and projection replacement therefore commit or
roll back together. The projection remains acceleration only and never authorizes a hold or
booking.

This order operationalizes the PostgreSQL projection. Valkey/NATS cache selection, offline
leases, overbooking, reservations and an initial scheduling horizon remain later decisions.

## Scope

- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/orders/059-availability-projection-consumer.md`
- `src/contexts/inventory/availability-projection-consumer.ts`
- `src/contexts/inventory/index.ts`
- `src/server.ts`
- `docker-compose.yml`
- `tests/availability-projection-consumer.integration.test.ts`

If an implemented proof fails, add only the next numbered question and temporary-architect
response plus append-only decision/ledger entries, then recreate and restart under D-92.

## Required behavior

1. Add a named consumer `availability-projection` using only the existing
   `EventBus.consumeBatch` durability boundary and Order 058's rebuild service. The handler
   must use the transaction supplied by the event bus; do not open or commit another
   transaction.
2. For `occupancy.recorded`, `occupancy.released`, `ooo.opened` and `ooo.closed`, accept only
   an exact non-empty finite `tstzrange` string in `payload.period` plus a non-null event
   property. PostgreSQL, using that exact property's timezone under tenant RLS, derives the
   half-open local-date envelope touched by the UTC interval. Rebuild that envelope. Duplicate
   OOO occupancy/block events may repeat an idempotent rebuild but may not change the result.
3. For `inventory.policy.changed`, `space.created`, `unit_type.created` and
   `sellable_unit.created`, rebuild the property's existing projected min/max date envelope.
   If no projection horizon exists, acknowledge the event without inventing dates. This order
   does not choose an initial future horizon.
4. Every other catalogue event is an acknowledged no-op. A relevant malformed event, foreign
   or missing property, invalid range, or rebuild failure rolls back all projection changes,
   `consumer_processed`, and `consumer_cursor`; the same event remains retryable. Never skip a
   poison relevant event silently.
5. Expose bounded `drainOnce()` plus an abortable polling loop. Batch size is 1–100 and poll
   interval 100–60,000 ms with conservative defaults. Concurrent instances with the same
   consumer name serialize through the existing cursor lock and do not double-apply effects.
6. Runtime is doubly opt-in: only when the operator workbench is enabled and
   `YELLOW_AVAILABILITY_PROJECTION_WORKER=1`. Local Compose opts in. Errors are reported without
   secrets and the loop retries; disabled health-only mode remains database-free.

## Forbidden

- Editing any migration, `tests/run_invariants.py`, occupancy functions/constraints, RLS,
  tenant middleware, outbox/cursor implementation, event catalogue or event payload producer.
- Direct canonical occupancy/configuration DML; direct projection arithmetic outside Order
  058; using projection results to accept a hold/booking; facts, new events, new dependency,
  new table, new state transition or new privilege.
- Valkey/NATS/cache implementation or benchmark, initial projection horizon policy, operator
  HTTP/UI, offline leases, overbooking, reservations, rates/restrictions, public hosting,
  approval, merge, or representing builder execution as independent review.

## Pre-registered proofs

- **P0:** on a fresh 0001–0005 database before implementation, the complete new test fails
  because the consumer export/runtime does not exist; preserve the red output.
- **P1:** a canonical hold placement publishes occupancy and one drain rebuilds exactly its
  property-local touched nights; cursor, processed marker and projection commit together.
- **P2:** canonical hold release plus a later drain restores exact rows. Duplicate/replayed
  event observation leaves byte-equivalent projection and one processed marker per event.
- **P3:** OOO/OOS block and OOS-policy events rebuild exact period/existing-horizon rows;
  unrelated rate/audit events advance the cursor without changing projection bytes.
- **P4:** UTC periods crossing America/New_York DST and local midnight derive exact half-open
  date envelopes through PostgreSQL, not host timezone or fixed-hour arithmetic.
- **P5:** malformed period, null/foreign property and an injected rebuild failure leave
  projection, cursor and processed markers byte-equivalent; a corrected/retryable event then
  succeeds without manual cursor movement.
- **P6:** two concurrent consumer instances have one effective handler sequence and converge;
  polling is bounded, abortable and retries a transient failure without overlapping polls.
- **P7:** runtime is exactly doubly opt-in, health-only remains database-free, inherited Order
  058/022/023 proofs, typecheck, boundaries, full tests, licence, audit, schema drift and referee
  11/11 remain green; protected files stay byte-identical.

## Standing checks and handoff

Run P0 before production code and P1–P6 on fresh isolated databases. Restart the complete
standing self-check from the lockfile. Stop the persistent app before the referee per D-191,
restore it with both workers enabled, refresh Graphify, commit `[codex]`, push and open a draft
stacked PR against Order 058. Do not approve or merge. Label all results builder-asserted and
record the deliberately absent initial horizon/cache/offline/overbooking decisions.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
