# Order 231 — Governed due-in room assignment

**Status:** READY-D606
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-due-in-room-assignment`
**Base:** `e5224fe` (built-unreviewed Order230)
**Risk tier:** 3 — occupancy-critical reservation assignment and evidence
**Owner:** Codex implementation; independent high-risk review remains deferred by founder build-first direction

## Outcome

An authorized front-desk operator can resolve the exact current
`room_assignment_missing` check-in blocker by selecting one server-admitted physical
room, deliberately assigning it, and returning to the same canonical check-in
preparation journey. PostgreSQL occupancy truth remains the final arbiter; assignment
does not infer room readiness and never checks the guest in automatically.

## Fixed policy

- Admission requires one exact-property `due_in` reservation, exactly one latest
  `booked` segment with no assigned sellable unit, and zero existing segment occupancy
  claims. Any incoherence fails closed.
- Candidate presentation is reservation-scoped and server-derived from the existing
  authoritative availability path for the segment period, occupants and unit type.
  Only active same-property sellable units mapping to exactly one active physical room
  are returned. The browser never performs availability or occupancy arithmetic.
- Candidate output is minimized to sellable-unit id/name and physical room id/code,
  floor and current nullable condition evidence. No price, guest, contact, hold,
  occupancy row, internal mapping or other reservation truth is disclosed.
- The command uses existing exact property-scoped
  `reservations.segments:write` authority, an actor-bound idempotency key and expected
  reservation/segment/period/unit-type/unassigned evidence.
- The command locks reservation and segment, revalidates the candidate, claims the
  exact period only through `ReservationOccupancyService.claimForSegment`, and sets
  the segment sellable assignment only through one bounded owner-mediated capability
  from migration `0033`. Assignment, occupancy fact/outbox and minimized
  `reservation.modified` fact/outbox commit or roll back together.
- Exact replay is byte-equivalent; changed input under the same key conflicts.
  Concurrent candidates for the same segment converge to one assignment. Concurrent
  claims for the last room produce exactly one coherent winner.
- The operator action exists only for the exact current `room_assignment_missing`
  blocker. Success refetches reservation detail and check-in readiness and focuses the
  next exact blocker action or safe check-in heading. Conflict stays in assignment
  with an authoritative refresh path.
- No room-condition mutation, housekeeping task, folio or identity repair, automatic
  alternate selection, dirty override, check-in, room move, segment split, price,
  financial, day, statutory, vehicle, parking or queue effect is admitted.

## Exact scope

- this order and focused intentional-red/domain/HTTP/UI/navigation tests;
- `migrations/0033_governed_due_in_room_assignment.sql`;
- `src/contexts/reservations/segments.ts`, `src/contexts/reservations/index.ts`;
- existing inventory public interfaces only if the authoritative availability result
  needs a narrow exported type already produced by that context;
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`;
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`;
- `scripts/seed-review.ts` only for deterministic unassigned-arrival/scopes evidence;
- directly affected migration/schema/database/runtime-authority/security-definer,
  review-seed and Order200/209/219/226/230 regression tests;
- `tests/schema/expected.sql`, `setup.sh` only for the exact migration/table message if
  required, and relevant contract/event/state/domain/security/UI documentation;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql` remains immutable. No table, event name or permission beyond
the existing `reservation.modified`, `occupancy.recorded` and
`reservations.segments:read/write` catalogue is added.

## Forbidden

- direct application `space_occupancy` DML or browser sellability arithmetic;
- generic segment assignment, bulk room allocation, automatic room selection or
  assignment from an unscoped inventory screen;
- editing an existing assignment or treating this as room move;
- caller actor/property/status/unit type/occupancy/readiness or event authority;
- partial assignment without occupancy, or occupancy without exact segment assignment;
- room-condition/task/folio/identity/check-in/checkout/financial/day/statutory effect;
- new dependency, local promotion, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** exact blocker action, candidate read, assignment command and governed
  capability are absent before implementation.
- **P1 candidates:** only exact due-in/unassigned/latest-booked truth returns active
  same-type, same-property, one-room candidates from authoritative availability;
  foreign, OOO/OOS, blocked, occupied, held, composite/positional, wrong-type and stale
  truth is absent or fails closed.
- **P2 atomic command:** exact assignment creates the segment assignment, one sanctioned
  occupancy chain, minimized facts and outbox in one transaction; no other domain rows
  change.
- **P3 contention/replay:** exact replay is stable, changed-key reuse conflicts,
  twenty contenders converge to one result, and last-room competition has one winner.
- **P4 hostile authority:** foreign tenant/property/actor, inactive actor, wrong status,
  prior assignment/occupancy, stale segment/period/unit type, raw DML, PUBLIC/runtime
  direct execution and capability misuse fail without artifacts.
- **P5 rollback:** injected fact or publication failure rolls back assignment,
  occupancy and idempotency; exact retry succeeds once.
- **P6 HTTP/UI:** strict no-store candidate/command adapters, scope/property guards,
  stale generations, detached DOM, in-flight/error/conflict/refetch/focus/history and
  direct-route compatibility are executable.
- **P7 UX:** semantic 44px controls, Android 48px, current appearances, 375px/200%,
  keyboard, forced colours and reduced motion pass.
- **P8 standing:** focused Order200/209/210/219/226/229/230 regressions plus typecheck,
  boundaries, licence, audit, JavaScript, full suite, exact schema and referee remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Candidate read and exact assignment are server-authoritative and bounded.
- [ ] Occupancy choke point, atomic evidence, rollback, replay and contention pass.
- [ ] The human check-in journey resolves assignment without automatic check-in.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
