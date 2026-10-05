# Order 207 — Governed departure-travel visibility

**Status:** BUILT-UNREVIEWED-D558 — implementation and executable proof complete; independent review deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-departure-travel-visibility`
**Base:** `49ca268` (built-unreviewed Order206)
**Risk tier:** 2 — read-only tenant/property association and disclosure boundary
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

The existing reservation board and Today due-out surfaces show minimized recorded
departure travel truth for each reservation. Operators can see mode, carrier, service
number and scheduled departure without opening every reservation. The existing board
route, permission, filters, ordering and cursor remain unchanged.

## Fixed read policy

- Extend each existing reservation-board row with exactly
  `departureTravel: null | { mode, carrier, serviceNo, scheduledAt }`.
- Read only `travel_detail.direction='departure'`. Arrival remains separately owned by
  Order206. No pickup/drop-off meaning, note, internal travel id, pickup flag, task id,
  task state, Party/contact, vehicle, parking or inferred transport outcome is returned.
- Stored mode/timestamp and nullable text fields are validated and deeply frozen.
  Repeated reads are byte-equivalent and mutation-free.
- Existing reservation-board `(created_at,id)` ordering, cursor, route, no-store
  response, `reservations.lifecycle:read` permission and property grant stay exact.
  Departure data never changes ordering and no global departure-time ordering claim is
  made.

## Exact scope

- `handoff/orders/207-governed-departure-travel-visibility.md`
- `src/contexts/reservations/board.ts`
- minimal projection in `src/http/operator.ts`
- `src/http/operator/operator.js` and only minimal shared
  `src/http/operator/operator.css` if needed
- `scripts/seed-review.ts`
- new `tests/departure-travel-visibility.intentional-red.test.ts`
- focused additions to `tests/reservation-board.integration.test.ts`,
  `tests/operator-reservation-read-surface.integration.test.ts`,
  `tests/operator-today-command-centre.integration.test.ts`, and
  `tests/review-seed.integration.test.ts`
- departure-travel read-only sections in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No route, permission, migration, dependency, table, state, event, task, automation or
write authority is admitted. `migrations/0001_init.sql` and every migration remain
byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Extend `ReservationBoardService.list` with exact departure-travel association while
   preserving existing arrival truth, ordering, cursor, filters and transaction-local
   RLS.
3. Extend the existing minimized operator JSON projection only; do not create a new
   route, permission, query parameter or background request.
4. Show a compact accessible Departure line in reservation board rows/cards and Today
   due-out cards only, with current stale/focus/responsive/reduced-motion/
   forced-colour/appearance protections.
5. Seed exactly one deterministic departure row on the existing `CHECKOUT-READY`
   due-out fixture, with `pickup_requested=false`, `pickup_task_id=NULL` and
   `notes=NULL`. Exact reseed is a no-op and creates no task/effect.

## Forbidden

- travel create/edit/delete, departure pickup/drop-off interpretation, task creation/
  linking, automation, ETA ordering/filtering, task status/assignment/queue inference
- notes, internal ids, Party/contact data, pickup flags, parking, vehicle or occupancy
  truth
- new route/query/scope/grant, write capability, idempotency, fact/outbox/event,
  migration, dependency, local promotion, second local, merge, push or deployment

## Pre-registered proof

- **P0 red:** board row, minimized transport and human departure line are absent.
- **P1 exact read:** literals/nulls, mode and microsecond timestamp validation, deeply
  frozen nested output, and exact departure-only selection are green.
- **P2 unchanged board:** arrival and departure coexist; existing filters,
  `(created_at,id)` order/cursor, limit and pagination bytes remain exact; travel never
  reorders rows.
- **P3 boundaries/no-write:** tenant/property isolation is exact; notes/ids/PII/pickup/
  task/vehicle/parking truth stay absent; repeated reads leave all truth unchanged.
- **P4 operator:** existing no-store authorization/query/concealment plus accessible
  table/card/Today due-out-only rendering, stale guards, responsive/appearance behavior
  are green.
- **P5 seed:** one deterministic departure row, exact no-op reseed and zero task/fact/
  outbox/occupancy/command effects.
- **P6 standing:** fresh migrations1–27, acceptance/runtime-DML/definer/schema,
  type/boundary/licence/audit/JS/diff/full suite and referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Departure truth is exact, minimized and mutation-free.
- [x] Existing arrival truth, board ordering/cursor/authorization remain compatible.
- [x] Reservation board and Today due-out surfaces make departure visible to a human.
- [x] Result is recorded built-unreviewed without claiming travel writes, transfer
  automation, Phase6 or app completion.
