# Order 082 — Direct reservation commit and racing HTTP contract

**Phase:** 4 · Reservations  
**Branch:** `phase-4/direct-reservation-commit-http`  
**Tier:** 3 — public reservation creation, occupancy arbitration, tenant/property authorization and concurrency  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Expose the canonical `POST /api/v1/reservations:commit` command for either one active cart hold or
one exact direct sellable/stay request. Both paths create the same durable reserved reservation
through Order 081's service, exact PostgreSQL idempotency, transaction-local tenant context and the
existing occupancy choke. A last-unit race must produce exactly one `201` and one `409
conflict/occupancy`; no loser may leave a reservation, segment, guest, fact, event, claim or
idempotency row.

This is a reservation/inventory contract, not a checkout shortcut. It references one existing active
party and rate plan. Inline profile creation, quote/price capture, payment, deposit, tax, folio,
journal and fiscal behavior remain later orders. Orders 045 onward remain explicit review debt: a
green builder proof records this order as `UNVERIFIED`, never independently approved.

## Natural-Solution Test

- `ReservationCommitService.commitHeld` already owns atomic cart-hold conversion. Extend the same
  service with a direct variant and one shared `reservation.commit` idempotency operation so one HTTP
  command namespace cannot reuse a key independently across sources.
- Inventory, not reservations or HTTP, must resolve a sellable's physical mappings and call
  `record_occupancy()`. Add one public inventory command dedicated to claiming an exact segment; do
  not hide a temporary hold inside a direct commit and do not create a reservation-owned SQL helper.
- The immutable `record_occupancy()` function already serializes positional allocation per physical
  space with a transaction advisory lock. The application still honours `CONTRACTS.md` by wrapping
  each positional call in a savepoint and retrying exclusion violation at most three total attempts.
  Exclusive claims execute once. Capacity exhaustion, final exclusion failure and PostgreSQL's
  exclusion-arbitration deadlock outcome become one bounded inventory conflict.
- Direct commit accepts exact UTC instants, sellable id and existing party/rate references. It does
  not accept tenant, actor, currency, policy, market/source, availability count, space/position,
  confirmation number or occupancy claims. PostgreSQL truth at commit time is final authority.
- The HTTP route accepts exactly one of `holdId` or `direct`, derives tenant/actor from the bearer
  token, verifies a dedicated `reservations.booking:write` scope plus property grant, requires the
  `Idempotency-Key` header, and maps stable domain errors without leaking PostgreSQL detail.
- No review-seed permission or founder UI is added here. Order 087 owns the complete review workbench;
  this order proves the real route using explicit test-role grants and keeps persistent localhost
  status useful without pretending the current operator can book.

## Scope

- `handoff/orders/082-direct-reservation-commit-http.md`
- `src/contexts/inventory/reservation-occupancy.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/reservations/commit.ts`
- `src/contexts/reservations/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `tests/reservation-commit.integration.test.ts`
- `tests/reservation-commit-http.integration.test.ts`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/`

## Required work

1. Add an inventory-owned `ReservationOccupancyService.claimForSegment(tx,input)`. Require UUID
   sellable/segment ids, exact bounded `[from,to)` UTC instants, operation `occupancy.recorded`, and
   the envelope's tenant/property. Resolve only one active sellable whose unit type, every mapped
   space and mapping property are active and consistent in that tenant/property.
2. For every deterministic mapping, call only `record_occupancy()` with the segment id and
   `slot_kind='segment'`. Exclusive claims get one attempt. Each positional call gets a savepoint and
   at most three total attempts on SQLSTATE `23P01`; roll back to and release that savepoint after a
   failed attempt. SQLSTATE `P0002`, the final exclusion violation, or SQLSTATE `40P01` from mutually
   waiting exclusion checks is a bounded occupancy conflict. `40P01` is never retried here. Any
   other database error escapes and the request transaction rolls back.
3. Require every returned claim row to match the requested segment, space, period and exclusivity.
   Record one `occupancy.recorded` segment fact to derive the property business date, then publish
   one existing `occupancy.recorded` event per claim. Return a frozen result containing only the
   server-resolved sellable/unit-type/stay and exact claim count.
4. Add `ReservationCommitService.commitDirect`. Reuse Order 081's validation and durable command
   flow: existing active same-tenant party; active same-property rate plan with valid guarantee
   reference; server-derived currency/policies/market/source; generated reservation/segment ids;
   one reserved reservation, booked segment and primary guest; one `reservation.confirmed` fact and
   existing event. The direct source calls only the injected inventory claim command.
5. Refactor held/direct construction only enough to share exact behavior. Both variants use operation
   `reservation.commit`; the canonical idempotency request includes a source discriminator and every
   accepted field. Exact retries replay identical JSON; changed source or content conflicts. Preserve
   Order 081's held-commit proofs after the operation-name change.
6. Add strict HTTP parsing for body
   `{propertyNode, holdId | direct:{sellableUnitId,from,to}, primaryPartyId, ratePlanId, adults,
   childAges, channelCode}`. Exactly one source is required; unknown keys, malformed UUID/instant,
   unbounded arrays/numbers/codes or missing/invalid `Idempotency-Key` fail `400 request/invalid`.
7. Require bearer scope `reservations.booking:write` and a role grant covering the exact property.
   Missing scope returns `403 auth/scope_missing`; absent property grant returns `403
   auth/property_forbidden`. The server never accepts tenant or actor from JSON.
8. Wire `POST /api/v1/reservations:commit` through the existing tenant transaction and runtime
   services. Return `201` plus `Idempotency-Replayed`; map `ReservationConflictError` and inventory
   capacity/exclusion conflict to `409 conflict/occupancy`, changed key reuse to `409
   request/idempotency_conflict`, domain validation to `400`, missing party/rate/sellable to `404`,
   and unexpected/publisher/database failure to the existing generic `503` without internal detail.
9. After all proofs pass, advance only builder status/manifest/ledger to Order 082, append the exact
   autonomous decision, quote both protected hashes, refresh the disposable Graphify code map,
   rebuild only the persistent localhost app container without reseeding PostgreSQL, push a stacked
   draft PR on Order 081 and leave it unmerged.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, CI, canonical contracts/state machines, review seed/permissions, operator HTML/CSS/JS,
  generated review coverage or the Order-080 state table
- Direct `INSERT`, `UPDATE` or `DELETE` against `space_occupancy`; reservations/HTTP resolving
  physical spaces or positions; projection/Valkey/browser arbitration; a temporary hidden hold;
  retries beyond three positional attempts; any retry for an exclusive claim
- Inline party/profile/contact creation; search/offer/quote/price capture; caller-provided currency,
  policy, market/source, confirmation, tenant, actor, space, position, availability or audit evidence
- Account, folio, journal, posting, deposit, payment, tax, fiscal, statutory, approval, waitlist,
  alert, group/block, distribution, overbooking, offline/manual consumption or rate configuration
- A new status, transition, event, table, column, database function, RLS rule, persistent permission,
  worker, dependency or mutable confirmation counter
- Partial success, swallowing publisher failures, committing an idempotency loser, leaking SQL detail,
  marking Orders 045–082 approved/merged, self-review or merge

## Pre-registered proof

### P0 — absent direct HTTP command is red

Add `tests/reservation-commit-http.integration.test.ts` first. It must import the absent public
inventory segment-claim surface, create the real app with the reservation service, and define P1–P5.
With `YELLOW_REQUIRE_RESERVATION_COMMIT_HTTP=1` against a fresh migrated/seeded database, the run
must fail only because the direct inventory/HTTP surface is absent. Preserve that red commit before
implementation.

### P1 — exact held/direct HTTP behavior and replay

The same authenticated endpoint commits an active cart hold and a direct exact sellable. Each
returns `201`, correlation id, replay header and one canonical reservation result. Exact retry
replays byte-equivalent JSON with no new artifacts. Reusing the key with changed source, dates,
party/rate or guests returns the stable idempotency conflict. Body authority/unknown-key attacks and
missing key fail before domain mutation.

### P2 — last-unit exclusive race

Two authenticated direct HTTP requests with different keys race for the same exclusive last unit.
Exactly one returns `201`; exactly one returns `409 conflict/occupancy`. The database contains one
reservation, one segment, one primary guest, one segment occupancy set, one reservation fact/event
set and one completed idempotency claim for that race. The loser leaves none of those artifacts.

### P3 — positional capacity and bounded retry

Race more direct HTTP requests than a positional space's capacity. Exactly capacity requests return
`201`; every excess request returns `409 conflict/occupancy`; committed claims occupy distinct
positions and no request exceeds one reservation. A test-only database trigger injects two
transaction-local `23P01` failures before success and proves exactly three attempts. A separate
always-failing probe proves the server stops after exactly three attempts and rolls back every
artifact. An exclusive conflict proves one attempt only.

### P4 — tenant/property/reference and rollback boundaries

Missing scope, foreign/no property grant, foreign tenant, foreign property, inactive/missing
sellable, missing/merged/foreign party and inactive/missing/foreign rate fail closed. Inject event
publication failure at every new direct occupancy/reservation publication position; each request
returns generic `503` with no SQL detail and leaves no reservation, guest, claim, fact, event or
idempotency residue. A clean retry then succeeds once.

### P5 — standing gate

From the top: frozen install; state; typecheck; import boundaries; Orders 080–082 focused database
proofs; complete default tests; exact Phase-3 isolated gate; licences; audit; schema drift; protected
hashes; fresh isolated app-never-started `./setup.sh --db-only` 11/11. Confirm no persistent database
reseed/restart. Refresh Graphify code-only and record parser/semantic limitations.

## Definition of done

- [x] P0 intentional red evidence is committed before implementation.
- [x] P1–P4 prove exact HTTP, arbitration, bounded retry, authorization and rollback behavior.
- [x] P5 is fully green and protected hashes remain exact.
- [ ] Order 082 is pushed as `UNVERIFIED` review debt on a stacked draft PR; nothing is merged.

## Evidence

- Intentional red `bc12a70` failed only because `ReservationOccupancyService` was absent. Order
  `403b962` pre-registered the complete direct/held HTTP, authorization, race, retry and rollback
  contract before implementation `da9c3bd`.
- The first implemented run stopped on two exact contract defects: replayed `jsonb` returned a
  different key order, and the last-unit race exposed PostgreSQL `40P01` during mutual exclusion
  checks as generic `503`. D-279 canonicalizes both response paths and classifies that exact
  occupancy-arbitration result as `409` without retrying exclusive claims. A freshly recreated
  database then passed the complete Order-082 proof 5/5 with 61 assertions.
- A second fresh restart passed Orders 080–082 together 15/15 with 298 assertions. The inherited
  Order-081 held-commit suite independently remained green 5/5 with 106 assertions after both paths
  moved to the shared `reservation.commit` namespace.
- Frozen install made no changes; typecheck and 52-file import boundaries passed. The default suite
  passed 100 with 0 failures and 1,336 assertions, while 311 database-gated cases remained explicit
  skips under the ordinary command. Licences passed for 23 packages, audit found no vulnerabilities,
  and schema drift matched the exact generated snapshot after supplying its required isolated
  Compose database-name precondition.
- The reproducible isolated Phase-3 gate passed all eight suites: 60/60 and 1,020 assertions with
  every temporary database removed. Fresh project `yellow-order-082-referee` ran
  `./setup.sh --db-only` with no app container and returned 11 passed / 0 failed.
- Protected hashes remain `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  and `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Graphify's disposable code-only map contains 2,187 nodes, 5,894 directed edges and 117
  communities, with zero missing, dangling, duplicate or collapsed edges and ten inherited
  self-loops. It skipped 397 non-code files and semantic labeling; the useful HTTP → reservation →
  inventory-claim query was saved and reflected only as derived memory.
