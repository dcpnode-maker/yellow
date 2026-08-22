# Order 081 — Atomic cart-hold to reservation commit

**Phase:** 4 · Reservations  
**Branch:** `phase-4/atomic-hold-reservation-commit`  
**Tier:** 3 — occupancy ownership, reservation creation, tenant scope and audit/outbox atomicity  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Add one internal reservation command that converts an active, unexpired `cart` hold into exactly
one `reserved` reservation, one booked segment and one primary guest. The same tenant transaction
must move every authoritative occupancy claim from the hold id to the new segment id, record exact
facts, emit the existing `hold.consumed`, occupancy and `reservation.confirmed` events, and complete
the existing PostgreSQL idempotency claim.

This is the atomic domain core only. It does not expose HTTP, create a party, quote a price, take a
payment, open a folio or post a journal. Those contracts retain their own later orders and phases.

Orders 045 onward remain explicit review debt. A green builder proof records this order as
UNVERIFIED; it is not independent approval.

## Natural-Solution Test

- The immutable schema already contains `hold.status='consumed'`, reservation, segment, primary
  guest and `space_occupancy.slot_kind='segment'`. No migration, state, table or event is missing.
- `HoldService` already owns every hold transition and is the only application service allowed to
  call `release_occupancy()` or `record_occupancy()`. Extend that public inventory command with a
  cart-only `consumeForSegment`; reservation code must never write `space_occupancy` directly.
- PostgreSQL MVCC plus the exclusion constraint makes release then re-record safe inside one
  transaction: competing writers continue to observe/conflict with the old committed hold until
  the transaction atomically exposes the new segment claim.
- Reservation code may synchronously call the exported inventory command because this transfer
  cannot be made correct through an eventually delivered event. The inventory context remains the
  owner of claim mutation and emits its existing events.
- The reservation id and segment id are generated before mutation. The human reference is the
  deterministic, collision-equivalent `Y-` plus the reservation UUID without hyphens in uppercase;
  it introduces no sequence, mutable counter or second identity store.
- Existing active same-tenant party and active same-property rate-plan records are referenced.
  Inline party creation and quote/price/payment binding remain outside this order.
- The existing `PostgresIdempotency` primitive wraps the complete command in the caller's tenant
  transaction, so exact retries replay one JSON result and changed reuse conflicts.

## Scope

- `handoff/orders/081-atomic-hold-reservation-commit.md`
- `src/contexts/inventory/holds.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/reservations/commit.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-commit.integration.test.ts`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/`

## Required work

1. Add `HoldService.consumeForSegment(tx, input)` as the only new occupancy mutation surface.
   Require operation `hold.consumed`, UUID hold/segment ids, the envelope's tenant/property, an
   active unexpired `cart` hold and at least one existing hold claim. Lock the hold `FOR UPDATE`.
2. Capture the hold's authoritative claim rows, call only `release_occupancy()` for the hold, then
   call only `record_occupancy()` once per captured space/period/exclusivity tuple with the supplied
   segment id and `slot_kind='segment'`. Require release and replacement counts to match exactly.
   Do not derive transfer claims from current sellable mappings or projection/cache state.
3. Change the locked hold from active to consumed, append one `hold.consumed` fact, publish the
   existing `hold.consumed` event, one `occupancy.released` event per old claim and one
   `occupancy.recorded` event per new segment claim. Payloads name the authoritative slot kind/ref;
   they never carry a whole entity.
4. Add `ReservationCommitService.commitHeld(tx, input)`. Accept only hold id, existing primary-party
   id, existing rate-plan id, `adults` 1–99, at most 30 child ages 0–17, canonical lowercase channel
   code, an 8–200 printable-character idempotency key and an audit envelope whose operation is
   `reservation.confirmed`. Tenant, property, actor and request identity come only from the envelope.
5. Before occupancy mutation, require an active same-tenant primary party and an active same-tenant,
   same-property rate plan. Server-derive currency, guarantee policy and rate default market/source
   codes. Never accept those authority fields from the caller.
6. Inside the idempotent callback, generate and validate one reservation id and segment id, consume
   the hold, then insert one explicit `reserved` reservation, one `booked` segment using the
   transferred hold's exact sellable/unit type/period, and one `reservation_guest` row with
   `role='primary'`. Persist child ages as `[{"age":n}]` and do not create sharer allocation.
7. Append one `reservation.confirmed` fact and publish one existing `reservation.confirmed` event
   containing ids plus `segments:[{unit_type,period,rate_plan}]` and channel. Return a frozen JSON
   result with canonical ISO instants and an explicit replay flag; exact retries must not generate
   a second id or evidence row.
8. Export only the new typed public commands/results/errors from their context indexes. Use bounded
   domain validation/not-found/conflict errors; never expose PostgreSQL messages as product data.
9. After all proofs pass, advance only the builder snapshot/manifest/ledger to Order 081, append the
   exact autonomous decision, quote both protected hashes, refresh the disposable Graphify code map,
   push a stacked draft PR on Order 080 and leave localhost healthy. Do not merge.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, CI, `docs/`, application routes, operator HTML/CSS/JS, generated review coverage or the
  Order-080 state table
- Direct `INSERT`, `UPDATE` or `DELETE` against `space_occupancy`; a reservation-owned occupancy
  helper; projection/Valkey arbitration; a second idempotency table or in-memory replay cache
- Consuming `offline_lease` or `manual` holds; direct commit without a hold; positional retry policy;
  search/quote/price capture; HTTP status mapping; inline party/profile/contact creation
- Account, folio, journal, posting, deposit, payment, tax, fiscal, statutory, approval, waitlist,
  alert, group/block, distribution, overbooking or availability behavior
- A new status, transition, event, table, column, database function, RLS rule, permission, scope,
  worker, dependency, mutable confirmation counter or client-supplied tenant/property/actor/currency/
  policy/occupancy authority
- Partial success, swallowing publisher failures, releasing a hold before the caller transaction,
  weakening exclusion conflicts, marking Orders 045–081 approved/merged, self-review or merge

## Pre-registered proof

### P0 — absent atomic command is red

Add `tests/reservation-commit.integration.test.ts` first. It must import the absent
`ReservationCommitService`/`consumeForSegment` surface and define the complete PostgreSQL proof.
With `YELLOW_REQUIRE_RESERVATION_COMMIT=1` against a fresh migrated database, the run must fail only
because the command surface is absent. Preserve that intentional red commit before implementation.

### P1 — exact held commit and replay

One cart hold over a composite sellable commits one reserved reservation, one booked segment and one
primary guest. Every old hold claim is gone and an equal set of segment claims exists for the exact
spaces/period/exclusivity. The hold is consumed. Exact retry returns the identical result with
`replayed=true`; changed reuse conflicts. Exactly one reservation fact/event set exists.

### P2 — committed-ownership concurrency

Pause the first command after replacement claims exist but before commit, then race a second hold on
the same exclusive space. The contender cannot complete while the first transaction is open and
loses after commit. A committed snapshot contains segment claims only—never both hold and segment,
never neither. Twenty different idempotency keys racing one hold produce one reservation and no
loser reservation/fact/event/idempotency residue.

### P3 — rollback at injected publication boundaries

For every inventory/reservation publication position in a composite transfer, inject one publisher
failure. Each run rolls back the idempotency claim, reservation, segment, guest, new facts/events,
hold status and replacement claims. The original active hold and its exact claims remain retryable;
an ordinary retry then succeeds once.

### P4 — fail-closed scope and references

Expired, released, consumed, missing, foreign-property, foreign-tenant, offline and manual holds are
rejected without artifacts. Missing/merged/foreign party and inactive/foreign rate plan are rejected
before claim mutation. Invalid UUIDs, guest bounds, child ages, channel, idempotency key, envelope
operation and generated ids fail closed.

### P5 — standing gate

From the top: frozen install; state; typecheck; import boundaries; focused database proof; complete
default tests; exact Phase-3 database gate; licence; audit; schema drift; protected hashes; fresh
isolated app-never-started `./setup.sh --db-only` 11/11. Confirm the persistent localhost stack was
not stopped or reseeded. Refresh Graphify code-only and record its parser/semantic limitations.

## Definition of done

- [ ] P0 intentional red evidence is committed before implementation.
- [ ] P1–P4 prove exact atomic ownership, replay, concurrency, rollback and scope.
- [ ] P5 is fully green and protected hashes remain exact.
- [ ] Order 081 is pushed as UNVERIFIED review debt on a stacked draft PR; nothing is merged.
