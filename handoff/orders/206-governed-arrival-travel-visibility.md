# Order 206 — Governed arrival-travel visibility

**Status:** READY-D555 — intentional red and implementation required
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-arrival-travel-visibility`
**Base:** `c971b01` (built-unreviewed Order205)
**Risk tier:** 2 — read-only tenant/property association and disclosure boundary
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

The existing reservation board and Today due-in surfaces show minimized recorded
arrival and pickup truth for each reservation. Operators can see mode, carrier,
service number, scheduled arrival, whether pickup was requested and whether a valid
same-property task link exists, without opening every reservation. The existing
board route, permission, filters, ordering and cursor remain unchanged.

## Fixed read policy

- Extend each existing reservation-board row with exactly
  `arrivalTravel: null | { mode, carrier, serviceNo, scheduledAt,
  pickupRequested, pickupTaskLinked }`.
- Read only `travel_detail.direction='arrival'`. No departure, note, internal travel
  id, task id, Party/contact, parking or inferred status is returned.
- `pickupTaskLinked=true` means only that the recorded pickup-task foreign key
  resolves to a task in the same tenant and exact property. It does not imply task
  state, assignment, queue position, completed transport or successful pickup.
- Any linked pickup task that is missing from the current tenant/exact property fails
  the complete board read closed without disclosing the hostile identifier.
- Stored mode/timestamp and nullable text fields are validated and deeply frozen.
  Repeated reads are byte-equivalent and mutation-free.
- Existing reservation-board `(created_at,id)` ordering, cursor, route, no-store
  response, `reservations.lifecycle:read` permission and property grant stay exact.
  Travel data never changes ordering and no global ETA-order claim is made.

## Exact scope

- `handoff/orders/206-governed-arrival-travel-visibility.md`
- `src/contexts/reservations/board.ts`
- minimal projection in `src/http/operator.ts`
- `src/http/operator/operator.js`, `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- new `tests/arrival-travel-visibility.intentional-red.test.ts`
- focused additions to `tests/reservation-board.integration.test.ts`,
  `tests/operator-reservation-read-surface.integration.test.ts`,
  `tests/operator-today-command-centre.integration.test.ts`, and
  `tests/review-seed.integration.test.ts`
- arrival-travel read-only sections in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No route, permission, migration, dependency, table, state, event, task, automation or
write authority is admitted. `migrations/0001_init.sql` and every migration remain
byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Extend `ReservationBoardService.list` with exact arrival-travel association and
   pickup-task property-coherence checks while preserving its existing ordering,
   cursor, filters and transaction-local RLS.
3. Extend the existing minimized operator JSON projection only; do not create a new
   route, permission, query parameter or background request.
4. Show a compact accessible Arrival/Pickup line in reservation board rows/cards and
   Today due-in cards with current stale/focus/responsive/reduced-motion/
   forced-colour/appearance protections.
5. Seed two deterministic arrival rows on the existing clean and dirty due-in
   examples: one pickup requested and one not requested, both without notes or a
   linked task. Exact reseed is a no-op and creates no task/effect.

## Forbidden

- travel create/edit/delete, departure travel, pickup-task creation/linking,
  automation, ETA ordering/filtering, task status/assignment/queue inference
- notes, internal ids, Party/contact data, parking, vehicle or occupancy truth
- new route/query/scope/grant, write capability, idempotency, fact/outbox/event,
  migration, dependency, local promotion, second local, merge, push or deployment

## Pre-registered proof

- **P0 red:** board row, minimized transport and human arrival/pickup line are absent.
- **P1 exact read:** literals/nulls, mode and microsecond timestamp validation, deeply
  frozen nested output, and exact arrival-only selection are green.
- **P2 unchanged board:** existing filters, `(created_at,id)` order/cursor, limit and
  pagination bytes remain exact; travel never reorders rows.
- **P3 boundaries/no-write:** tenant/property isolation and hostile task association
  fail closed; notes/ids/PII/task state stay absent; repeated reads leave all truth
  unchanged.
- **P4 operator:** existing no-store authorization/query/concealment plus accessible
  table/card/Today rendering, stale guards, responsive/appearance behavior are green.
- **P5 seed:** two deterministic arrival rows, exact no-op reseed and zero task/fact/
  outbox/occupancy/command effects.
- **P6 standing:** fresh migrations1–27, acceptance/runtime-DML/definer/schema,
  type/boundary/licence/audit/JS/diff/full suite and referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Arrival/pickup truth is exact, minimized, coherent and mutation-free.
- [ ] Existing board ordering/cursor/authorization are byte-compatible.
- [ ] Reservation board and Today surfaces make travel visible to a human operator.
- [ ] Result is recorded built-unreviewed without claiming travel writes, pickup
  automation, Phase6 or app completion.
