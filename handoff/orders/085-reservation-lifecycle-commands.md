# Order 085 — Reservation modify, cancel and reinstate commands

**Phase:** 4 · Reservations  
**Branch:** `phase-4/reservation-lifecycle-commands`  
**Tier:** 3 — reservation state, occupancy release/re-arbitration and policy approval boundary  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Add one transaction-owned reservation lifecycle service for bounded metadata modification,
cancellation and reinstatement. Every command locks the reservation, consults the executable
Order-080 state contract where a status changes, uses exact durable idempotency, writes immutable
fact/outbox evidence, and either commits every domain/occupancy effect or none.

New confirmations also freeze the exact cancellation-policy id, validated canonical content and
SHA-256 content hash in the existing `reservation.confirmed` fact. Cancellation evaluates only that
booking-time evidence. A zero/no-policy result may cancel automatically. A non-zero penalty, or a
legacy confirmation whose policy evidence was never frozen, may cancel only with an exact approved
two-operator `reservation_cancellation_waiver`. Phase 5 owns financial posting, so this order never
fabricates, drops or partially posts a penalty.

Orders 045 onward remain explicit independent-review debt. Green builder evidence records this
order as `UNVERIFIED` only.

## Natural-Solution Test

- Reservation owns lifecycle and metadata; inventory owns both `release_occupancy()` and
  `record_occupancy()`. Reservation code may call only the public inventory service.
- Cancellation rules are descending minimum-hours-remaining tiers. The first rule whose
  `before_hours` floor is met applies; below every floor the last (most restrictive) rule applies.
  Equality belongs to the named tier. This matches the canonical QA shape
  `24h -> 0 nights, 0h -> 1 night`.
- Policy evidence is copied into the confirmation fact, not read later from mutable current hotel
  configuration. A legacy fact without that field is explicitly unknown and needs approval.
- Non-zero penalty means “financial consequence exists,” not “charge zero.” Until Phase 5 can post
  an exact journal, a different operator may approve a waiver bound to reservation, reason, frozen
  policy/hash and selected penalty. The cancellation event carries no fake journal id.
- Reinstatement reclaims every original segment through `ReservationOccupancyService` inside the
  same transaction. A competitor, later publisher failure or any segment failure rolls all claims,
  statuses, facts, events and idempotency back.
- Modify is deliberately non-financial and non-inventory: notes, ETA, ETD, market, source and origin
  only. Dates, unit, sellable, rate, party, channel, currency, policies and guests remain later or
  specialized commands.

## Scope

- `handoff/orders/085-reservation-lifecycle-commands.md`
- `src/contexts/rates/configuration.ts` only to export the existing strict cancellation-policy parser
- `src/contexts/rates/index.ts`
- `src/contexts/inventory/reservation-occupancy.ts` only for canonical segment release and an
  inventory-owned zero-existing-claim guard before segment claim
- `src/contexts/inventory/index.ts`
- `src/contexts/reservations/policy-evidence.ts`
- `src/contexts/reservations/commit.ts` only to freeze cancellation-policy evidence at confirmation
- `src/contexts/reservations/lifecycle.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-lifecycle.integration.test.ts`
- `tests/reservation-commit.integration.test.ts` only for exact frozen-policy regression evidence
- `src/project-status.ts` only after green proof
- `tests/founder-status.integration.test.ts` only for the exact counter change
- `handoff/PHASE-4-PLAN.md` only for completion/status text, not deliverable expansion
- `handoff/GATE-3-MANIFEST.md` only after all proofs are green
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/` only if a D-92 hard-floor condition occurs

## Required work

1. Export a pure strict parser for the already-declared cancellation policy content. Add a
   reservation-owned frozen-evidence helper that validates exact keys, canonicalizes the content,
   hashes the canonical content and rejects forged/mismatched evidence.
2. Extend reservation confirmation to same-tenant join the referenced cancellation policy and add
   `cancellation_policy: null | {policy_id,content,content_hash}` to the immutable confirmation fact.
   A dangling/wrong-kind policy makes the active plan unusable. Do not add a column or read current
   policy during cancellation.
3. Add `ReservationOccupancyService.releaseForSegment()`. It locks and captures the exact
   tenant-scoped segment claims, calls only `release_occupancy()`, verifies the count, records one
   `occupancy.released` fact and publishes one existing `occupancy.released` event per captured
   claim. Zero claims and count drift fail closed. Its existing claim command must also reject a
   segment that already owns any claim before allocation, including positional inventory.
4. Add an idempotent modify command for only notes, ETA, ETD, market/source/origin codes. Expected
   and changed fields must be the same non-empty set; unknown fields, malformed values, no-ops and
   stale expected values fail. Permit only reserved/due-in/in-house/due-out reservations. Emit one
   exact `reservation.modified` fact/event with before/after diff and no status/occupancy change.
5. Add an idempotent cancel command. Lock one same-tenant/same-property reservation and all booked
   segments, require the declared reserved/due-in -> cancelled transition, evaluate the frozen
   policy at a server-owned injected clock against the earliest segment start, and require an exact
   different-operator approved waiver for a non-zero or unknown legacy result. Release each segment
   through inventory, mark segments/reservation cancelled, set reason/time/deterministic
   cancellation number and emit only the existing `reservation.cancelled` fact/event.
6. Bind a waiver to kind `reservation_cancellation_waiver`, subject type/id, requester actor,
   distinct non-null decider, exact reason and exact generated policy decision payload. Fetch by the
   typed primary-key fields and validate payload bytes in application; do not add an unindexed JSON
   predicate. Treat a waiver as single-use: scan only typed reservation cancellation facts and
   compare their selected payloads in application, so a cancel -> reinstate -> cancel cycle needs a
   fresh second-operator decision. Missing/mismatched/pending/rejected/self/foreign/already-used
   approval fails with a structured approval-required error and no mutation.
7. Add an idempotent reinstate command. Lock the reservation/segments, require the declared
   cancelled/no-show -> reserved transition, require segments to be cancelled with no existing
   claims, and reclaim every original sellable/period using the inventory public service. Then mark
   segments booked, clear cancellation fields, mark reserved and emit only
   `reservation.reinstated`. A failed or racing re-arbitration cannot overbook or leave partial work.
8. Every command requires the exact audit operation and validates tenant/property/id/keys before
   mutation. Event publication failure at first, middle and final boundaries rolls domain,
   occupancy, fact, outbox and idempotency back; the same key can then succeed cleanly.
9. After all proofs pass, advance only builder status/manifest/ledger to 085, append the exact
   autonomous decision, quote both protected hashes, refresh the disposable Graphify map, rebuild
   localhost app-only without reseeding, push a stacked draft PR on Order 084 and leave it unmerged.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, Dockerfile, CI, RLS, tenant context, role grants, review seed or protected baseline
- A new table, column, function, state, transition, event, permission, dependency, cache, worker,
  HTTP route, browser control, financial journal, posting, folio, payment, refund, tax, fiscal or
  statutory behavior
- Reservation-owned SQL against `space_occupancy`, `record_occupancy()` or
  `release_occupancy()`; projection/cache/browser authority; caller tenant/actor/policy/penalty/time
- Reading current mutable policy as booking truth; treating absent legacy evidence as free;
  posting a zero/fake penalty; self-approval; an approval bound only by id; unindexed JSON WHERE
  predicates
- Modifying period, unit type, sellable unit, rate plan, party, channel, currency, policy or guests;
  changing an existing segment's meaning; hidden new segment; silently accepting a no-op or stale
  expected value
- Weakening inherited proofs, changing the state registry, merging, approval or claiming
  independent review

## Pre-registered proof

### P0 — absent lifecycle surface is red

Add `tests/reservation-lifecycle.integration.test.ts` first with P1–P6 and enable it only through
`YELLOW_REQUIRE_RESERVATION_LIFECYCLE=1`. On a fresh migrated database it must fail only because
the lifecycle module/export and frozen confirmation policy evidence do not exist. Commit the order
and red proof before production changes.

### P1 — frozen policy and exact modify diff

A confirmed reservation freezes the exact cancellation policy id/content/hash. Later direct policy
row tampering cannot alter the frozen evidence. A notes/commercial/time modification records the
exact before/after diff, exact replay returns byte-equivalent output, changed reuse conflicts, stale
expected/no-op/unsupported/terminal attempts leave zero artifacts and occupancy unchanged.

### P2 — free cancellation releases only canonical claims

No-policy and zero-penalty reservations cancel from reserved/due-in, mark every booked segment
cancelled, release every claim through the public inventory choke, set deterministic cancellation
identity and emit the declared occupancy/reservation facts/events once. Exact replay is inert.
Invalid transitions, wrong property/tenant and malformed reason/key produce no mutation.

### P3 — non-zero and legacy policy require exact four-eyes waiver

The structured error exposes the canonical waiver payload. Missing, pending, rejected, self,
foreign, already-used, wrong-reason, wrong-policy/hash or wrong-penalty approval cannot cancel.
Only an approved request made by the command actor and decided by another actor succeeds once;
cancel -> reinstate -> cancel needs a fresh waiver. Evidence names the waiver and explicitly
records `penalty_journal_id: null` rather than inventing a charge. Legacy unfrozen confirmation
follows the same explicit waiver path.

### P4 — reinstate re-arbitrates and cannot overbook

After cancellation, a competitor can take the exact unit. Reinstate then fails with all reservation,
segment, occupancy, fact, outbox and idempotency state unchanged. Releasing the competitor allows
one clean reinstate; concurrent same-reservation attempts yield one durable winner, exact replay is
inert, and aggregate occupancy never exceeds canonical capacity.

### P5 — injected publication failures are atomic

For modify, cancel and reinstate, inject publication failure at the first, middle and final
published event. Compare complete before/after domain, claim, fact, outbox and idempotency snapshots;
each must be byte-equivalent. Restore the publisher and prove the same idempotency key succeeds.

### P6 — standing gate, derived map and localhost

From the top: frozen install; state; typecheck; import boundaries; complete default tests; focused
fresh Order-085 proof plus inherited state/commit/HTTP/offer proofs; thirteen-suite isolated gate;
review coverage; licence/dependency audits; schema drift; protected hashes; fresh isolated
app-never-started `./setup.sh --db-only` at 11/11. Refresh Graphify code-only and record parser
limits. Rebuild only the persistent app, verify authenticated status reports Order 085/review 044/
debt 41, and leave app/PostgreSQL/Valkey healthy. Push final-tip CI and do not merge.

## Definition of done

## Builder evidence — UNVERIFIED

- [ ] P0 red evidence is committed before production code.
- [ ] Booking-time policy, modify, cancellation approval and reinstatement proofs pass.
- [ ] Failure injection, concurrency, tenant/property and hostile-input proofs pass.
- [ ] Standing checks, protected hashes, Graphify, localhost and final-tip remote CI are green.
- [ ] Independent review remains exactly through Order 044; Order 085 is not self-approved.
