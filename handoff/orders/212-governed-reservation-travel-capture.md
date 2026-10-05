# Order 212 — Governed reservation travel capture

**Status:** BUILT-UNREVIEWED-D568 — implementation and required builder gates green
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-reservation-travel-capture`
**Base:** `790740b` (built-unreviewed Order211)
**Risk tier:** 3 — new owner-mediated runtime write capability and audited reservation mutation
**Owner:** Codex implementation; independent executable review remains required before approval

## Outcome

An operator can create or replace one recorded arrival or departure travel leg from
the exact canonical reservation detail. The command is actor-bound, compare-and-set,
idempotent and audited. It records travel intent only: pickup-task automation,
vehicle/parking truth and occupancy remain separate future work.

## Fixed contract

- One resource command is `PUT
  /api/v1/properties/:property/reservations/:reservation/travel/:direction`, where
  direction is exactly `arrival` or `departure`. It uses the existing exact-property
  grant and `reservations.lifecycle:write` scope plus a mandatory visible-ASCII
  `Idempotency-Key`.
- The exact body is `{expected,travel}`. Each value is either `null` for expected
  absence or an exact object containing only `mode`, `carrier`, `serviceNo`,
  `scheduledAt` and `pickupRequested`. Desired `travel` is always an object.
- `mode` is nullable or one of `flight|train|bus|car|ferry|other`;
  `scheduledAt` is nullable or a canonical UTC instant; nullable carrier and service
  values are trimmed, nonblank Unicode strings bounded to 120 and 64 code points.
  A desired tuple with no recorded value is rejected; this order does not invent
  delete semantics. Departure requires `pickupRequested=false`.
- The server derives tenant, property, reservation, direction, travel id, actor and
  audit envelope. It locks and verifies the exact reservation in a modifiable
  `reserved|due_in|in_house|due_out` state, then performs one exact tuple CAS over
  the unique tenant/reservation/direction row. Create requires `expected=null`;
  replacement requires byte-equivalent normalized expected truth; stale is 409.
- Exact no-op returns `changed=false` and emits no fact/event. A changed command
  emits one minimized `reservation.modified` fact and one same-transaction outbox
  event. Exact replay is stable; conflicting reuse is rejected.
- `notes` and `pickup_task_id` are never accepted or returned by the command. A
  changed command against an already linked pickup task fails closed; no task is
  detached, edited or created. Arrival `pickupRequested=true` is recorded intent
  only and remains visibly unlinked until a later automation order.
- Migration 0028 adds one fixed-search-path SECURITY DEFINER capability with exact
  runtime-role, tenant-context, property, reservation-state, CAS and linked-task
  checks. Raw app-role INSERT/UPDATE/DELETE on `travel_detail` stays denied.
- The canonical reservation drawer hosts one reusable Travel details editor. Success
  refreshes authoritative reservation detail exactly once. Property, route,
  reservation, confirmation, detail-generation, request-generation and mounted-panel
  guards make stale paint/focus inert. Travel, Stay changes, Guests & shares and
  lifecycle panels are mutually exclusive and each editor returns to its inert home.

## Exact scope

- this order plus intentional-red and focused Order212 tests
- `migrations/0028_governed_reservation_travel.sql` and mechanically generated
  `tests/schema/expected.sql`
- new `src/contexts/reservations/travel.ts` and focused reservation exports/wiring in
  `src/contexts/reservations/index.ts`, `src/server.ts`, `src/app.ts`
- focused adapter/error/route work in `src/http/operator.ts`
- one inert editor and canonical detail integration in
  `src/http/operator/index.html`, `operator.js`, `operator.css`
- focused additions to runtime-DML, SECURITY-DEFINER, migration, reservation-detail,
  operator-workspace and review-seed proof only when required by the fixed contract
- Order212 sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`, `docs/SECURITY.md`,
  `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only for a real scope correction

No baseline edit, new table/event/dependency, raw travel DML grant, pickup-task
automation, task mutation, vehicle/parking/occupancy/financial/statutory effect,
board contract/cursor change, second local, merge, push or deployment is admitted.

## Required work

1. Commit intentional red before implementation.
2. Add and prove the bounded owner capability while raw app-role DML remains denied.
3. Add exact per-direction normalization, CAS, replay, concurrency and rollback.
4. Add one exact HTTP command with property/scope/concealment/error containment.
5. Add one progressive Arrival/Departure editor to canonical reservation detail.
6. Preserve 44px controls, Android 48px, 375px/200%-zoom containment, visible focus,
   reduced motion, forced colours and distinct native treatment for every appearance.
7. Mechanically regenerate schema truth and pass the complete standing/referee gates.

## Pre-registered proof

- **P0 red:** capability, service, route and reservation-detail travel editor are absent.
- **P1 authority:** raw DML fails; only exact runtime/tenant/property/reservation/status
  may call the owner capability; hostile associations and linked tasks fail closed.
- **P2 command:** exact arrival/departure create/replace/no-op/CAS validation with no
  task, reservation, segment, Party, occupancy or financial mutation.
- **P3 replay/concurrency/rollback:** replay is byte-stable, conflicts are bounded,
  contenders converge to one changed effect, and publication failure rolls back all.
- **P4 HTTP:** exact path/body/header/scope/property/concealment and no-store response.
- **P5 human journey:** one current-detail editor, exact loaded expected truth,
  mutual exclusion, stale/lifecycle/focus containment and one detail refresh.
- **P6 standing:** focused, migration/schema, type/boundary/licence/audit/JS/diff,
  full suite and fresh referee 11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact governed arrival and departure capture works from reservation detail.
- [x] Raw runtime DML, linked-task desynchronization and all unrelated effects fail closed.
- [x] Migration/schema, focused, standing and referee proofs are green.
- [x] Result is built-unreviewed; independent Tier-3 execution remains pending.
