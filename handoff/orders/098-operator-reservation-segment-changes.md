# Order 098 — Operator reservation segment changes

**Phase:** 4  
**Branch:** `phase-4/operator-reservation-segment-changes`  
**Base:** `699cbd6`  
**Risk tier:** 3 — live stay-leg history and occupancy re-arbitration  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Expose the independently approved Order 086 departure-change and immediate same-type
room-move commands through strict property-scoped HTTP and the existing Reservations
workbench. An operator finds a reservation by exact confirmation number, inspects its
immutable segment history, extends or shortens only the latest eligible segment, or moves
an in-house stay immediately to a different same-type sellable room. PostgreSQL remains
the only source of segment, clock and occupancy truth.

## Natural-Solution Test

The natural solution is one tenant/property-scoped segment query over the existing
reservation and segment tables, one distinct read/write permission pair, two strict routes
that inject the existing `ReservationSegmentService`, and one progressively disclosed
workbench panel. The query may describe history and server-derived action eligibility, but
the approved commands alone arbitrate expected values, time, destination compatibility,
occupancy, facts, outbox and idempotency. No new schema, state, event, inventory path or
financial approximation is needed.

## Scope

- `src/contexts/reservations/segments.ts`
- `src/contexts/reservations/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `scripts/seed-review.ts`
- `tests/operator-reservation-segments.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `tests/review-seed.integration.test.ts` only for exact scope expectations
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-4-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add a read-only segment query to the reservation segment service. It accepts only
   server-derived tenant/property and one canonical visible confirmation number, returns
   reservation id/confirmation/status and the complete ordered segment history with exact
   ids, sequence, status, unit type, optional sellable assignment and canonical UTC period.
   Only the latest segment carries server-derived `canChangeDeparture` and `canMoveRoom`
   guidance; the commands remain authoritative.
2. Add review-seed permissions `reservations.segments:read` and
   `reservations.segments:write`. Keep them distinct from booking, lifecycle and guest
   authority and reuse hierarchical property grants.
3. Add strict routes:
   - `GET /api/v1/properties/:property/reservation-segments?confirmationNo=...`
   - `PATCH /api/v1/properties/:property/reservations/:reservation/segments/:segment/departure`
   - `POST /api/v1/properties/:property/reservations/:reservation/segments/:segment/move`
4. Departure accepts exactly `expectedPeriod {from,to}` and one offset-aware
   `newDeparture`. Move accepts exactly `expectedSellableUnitId`, `expectedPeriod {from,to}`
   and `destinationSellableUnitId`. Mutation routes require `Idempotency-Key`; tenant,
   actor, property, request id, operation and move clock are server-owned.
5. Map validation/not-found/conflict failures to stable generic 400/404/409 responses.
   The adapter performs no segment, occupancy or clock calculation and calls only the
   injected segment service.
6. Wire one runtime segment service using the existing event bus, idempotency and shared
   reservation occupancy service. Preserve lifecycle, guest and booking behavior.
7. Extend Reservations with a separate exact-confirmation segment panel, an ordered
   semantic history list, a departure editor using the latest server period, and an
   immediate-move editor populated from already-authorized inventory read data and filtered
   for operator guidance to the same unit type. The server/domain still rejects stale or
   incompatible destinations.
8. Use visible labels, fieldsets, 44px controls, live status, deterministic focus after a
   successful command, responsive layout, safe text APIs, explicit UTC/offset guidance and
   no browser persistence or client segment/occupancy authority.

## Forbidden

- Any migration, schema/RLS/grant change, new state/event, seed fixture or dependency
- Editing `migrations/0001_init.sql`, another migration, `tests/run_invariants.py`, package
  or lock files, Compose/CI, Party, approval, financial, tax, journal, payment or fiscal
  surfaces
- Direct adapter SQL; browser or adapter occupancy queries/writes; client-supplied tenant,
  actor, move time, unit type, space, claim, price, rate or financial result
- Editing the active segment's assigned sellable for a move, deleting history, changing the
  arrival, scheduled moves, pre-arrival moves, cross-type/composite/positional moves or
  implying room readiness, keys, housekeeping or financial consequences are completed
- Reusing lifecycle/guest/booking scopes; merging segment read/write authority
- `innerHTML`, token/reservation persistence, external assets, inaccessible icon-only or
  hover-only controls, or client action eligibility treated as authority
- Any file outside Scope, self-review, self-merge or claiming Phase 4/app completion

## Pre-registered proof

### P0 — intentional red

Commit this order, then commit a focused proof using the planned segment query/routes and
workbench identifiers before production changes. It fails only because those public
surfaces are absent.

### P1 — history lookup and departure change

Read scope returns exact ordered history and latest-only server action guidance without
writes. Write scope extends and shortens through HTTP with exact expected period, unchanged
segment identity, atomic occupancy replacement and byte-equivalent replay; stale expected
period conflicts without artifacts.

### P2 — immutable immediate room move

An in-house same-type move through HTTP departs the old segment at the server clock, opens
the next sequence at that instant and transfers occupancy without a gap or double claim.
The browser cannot provide move time, space identity or unit type. Same source,
cross-type, composite, positional, occupied and out-of-service destinations write nothing.

### P3 — races and publication rollback

Concurrent departure/move contenders produce one durable winner. Injected publication
failure rolls segment, occupancy, fact, outbox and idempotency snapshots back exactly; the
same key succeeds after the publisher is restored.

### P4 — strict authority and UX

Missing/invalid auth, scope, property grant, foreign tenant, malformed/duplicate query,
path/body/key and forbidden fields return stable generic errors without artifacts.
Static/runtime browser canaries prove labelled history/departure/move controls,
   latest/server-derived conditional actions, timezone-independent UTC conversion, 44px targets, focus/live
status, safe hostile text and no browser persistence or mutation authority.

### P5 — standing and independent gate

Typecheck, boundaries, standing, review seed, schema, deployment, protected hashes and a
fresh app-never-started referee pass. A non-implementing reviewer personally executes
P1–P4 against fresh PostgreSQL and approves.

## Definition of done

- [x] Order exists before production code.
- [x] Intentional P0 red is committed before implementation.
- [x] Segment read/write permissions and strict routes pass.
- [x] Departure and room move converge on approved domain commands.
- [x] Races, incompatible destinations and publication rollback pass.
- [x] Workbench is accessible, responsive and server-authoritative.
- [x] Standing/schema/deployment/referee gates pass.
- [ ] Independent reviewer approves executed proof.
- [x] Scope is exact; user-owned untracked material remains untouched.

Builder evidence: focused adapter passed 3/3 with 15 assertions; the approved real
Order 086 domain battery passed 6/6 with 108 assertions; operator assets passed 9/9
with 112 assertions; standing passed 126/0 with 1,615 assertions; typecheck and 59-file
boundaries passed; fresh review seed passed 11/11; deployment passed 4/4; schema and
protected hashes were exact; licences and dependency audit were clean; pristine
app-never-started referee passed 11/11. This is not independent approval.
