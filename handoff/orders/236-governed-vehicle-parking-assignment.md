# Order 236 — Governed vehicle parking-slot assignment

**Status:** BUILT-UNREVIEWED-D622
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-vehicle-parking-assignment`
**Base:** `dbaafec` (built-unreviewed Order235)
**Risk tier:** 3 — owner-mediated vehicle mutation through canonical occupancy truth
**Owner:** Codex implementation; independent high-risk approval remains deferred by founder build-first direction

## Outcome

An authorized operator can open one exact onsite reservation-linked vehicle, choose an
active exact-property parking space, and create one exclusive parking occupancy claim.
PostgreSQL derives the current in-house segment and bounded claim period and arbitrates
all contention through the existing `record_occupancy()` choke point.

## Fixed policy

- A parking slot is the existing `space` primitive with `profile_key='parking'`; no
  parking table, synthetic inventory primitive or browser-owned availability is added.
- The target vehicle belongs to the exact tenant/property, has `entered_at` set,
  `exited_at` null, no prior parking assignment, and one exact linked reservation.
- The linked reservation is `in_house|due_out` with exactly one latest current
  `in_house` segment. PostgreSQL derives that segment and the claim period
  `[transaction_timestamp(), upper(segment.period))`.
- The selected slot is one active capacity-one exact-property parking space. The
  capability records an exclusive `slot_kind='segment'` claim through
  `record_occupancy()` and then binds `vehicle.parking_space` atomically.
- Exact same-vehicle/same-slot replay returns the original current claim. A different
  slot, stale/incoherent vehicle/stay truth, elapsed stay or occupied slot fails closed.
- V1 is create-only. Replacement, manual release, vehicle entry/exit, staff/visitor
  vehicles without a reservation, historical parking and automatic allocation remain
  later policy work. Existing segment checkout/release remains the only release path
  and clears both the parking claim and its vehicle pointer atomically.
- Exact scope is `stay-operations.vehicles:park`; the existing register/detail read
  scope remains unchanged. Every command requires an actor-bound `Idempotency-Key`.
- A changed assignment writes the governed vehicle binding, one minimized
  `occupancy.recorded` fact and one existing `occupancy.recorded` outbox event in the
  same transaction. Publication failure rolls back the assignment, claim and envelope.

## Exact scope

- this order and committed intentional-red/focused PostgreSQL, service, HTTP, UI and
  navigation tests;
- `migrations/0037_governed_vehicle_parking_assignment.sql` and mechanically generated
  `tests/schema/expected.sql`;
- one bounded parking assignment service in `src/contexts/stay-operations/vehicles.ts`
  and its existing context export only if required;
- minimal adapter/route/composition changes in `src/http/operator.ts`, `src/app.ts`
  and `src/server.ts`;
- the existing exact vehicle-detail surface in `src/http/operator/operator.js` and
  `src/http/operator/operator.css`; `src/http/operator/index.html` only if one static
  semantic hook is required;
- `scripts/seed-review.ts` only for the exact scope and deterministic active parking
  spaces/one assignable reservation-linked vehicle;
- focused migration/acceptance/runtime-DML/SECURITY-DEFINER/review-seed/schema tests;
- parking-only notes in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` and
  `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql`, the established six-argument room/unit occupancy recorder,
reservation/segment lifecycle, vehicle entry/exit, room occupancy, financial,
business-day and statutory truth remain unchanged. D-621 admits only one owner-private
seven-argument `record_occupancy` overload for vehicle-validated parking and one
external-name-preserving `release_occupancy` wrapper around the former owner-only
typed-parent implementation so canonical checkout can release parking safely.

## Required work

1. Commit intentional red before implementation.
2. Add migration0037 with exact function owner/signature/search path/ACL, canonical
   vehicle/reservation/segment/parking locks and create-only convergence.
3. Add deeply frozen parking candidates/read and actor-bound idempotent assignment.
   The command records one minimized fact and outbox event atomically.
4. Add strict no-query GET/POST routes with exact scope, UUID/body/header/property,
   no-store, concealment, conflict and correlation handling.
5. Extend the exact vehicle-detail view with a stale-safe deliberate parking picker,
   assignment action and authoritative refresh; no optimistic parking state.
6. Preserve every current appearance, 44px controls (Android 48px), 375px/200%
   containment, keyboard/focus, forced colours and reduced motion.

## Forbidden

- parking replacement/manual release/history, automatic allocation, batch assignment,
  staff/visitor parking, generic vehicle CRUD, vehicle entry/exit or notes mutation;
- reservation/segment lifecycle, room occupancy, condition/task/sheet/discrepancy,
  folio/financial/day/key/statutory mutation;
- positional/shared parking, new table/event/dependency, polling or browser storage;
- local promotion, second local, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** capability/service/routes/scope and semantic detail action are absent first.
- **P1 success:** fresh PostgreSQL proves one current onsite linked vehicle obtains one
  exact exclusive parking claim using the current segment and server-derived period.
- **P2 containment:** inactive/foreign/non-parking/capacity>1/positional, offsite,
  unlinked, non-current, elapsed and incoherent shapes write nothing.
- **P3 atomicity:** binding plus claim plus fact/outbox commits, while injected evidence
  failure rolls back all state and idempotency before one successful retry.
- **P4 replay/concurrency:** exact replay is stable, changed reuse conflicts, and twenty
  contenders for one slot converge to one vehicle/claim effect.
- **P5 authority:** PUBLIC/direct-login/raw runtime vehicle/occupancy DML/capability
  misuse is denied; fixed search path, owner and exact grants are executable.
- **P6 HTTP/UI:** strict access/body/header/query/no-store handling, stale identity,
  authoritative refresh, direct-detail behavior, history/focus and responsive access.
- **P7 standing:** adjacent vehicles/occupancy/checkout regressions, full suite,
  typecheck, boundaries, licence, audit, JavaScript, diff, exact schema and fresh referee.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact governed create-only parking assignment implementation is present.
- [x] Authority, hostile-boundary, rollback, replay and convergence proof coverage is present.
- [x] The stale-safe accessible vehicle-detail assignment journey is implemented.
- [x] Final focused, adjacent, standing, schema and fresh-referee totals are transcribed.

## Built-unreviewed evidence

Focused parking/HTTP/authority proof is `23 passed, 0 failed` (`337` assertions), the
adjacent vehicle/occupancy/checkout lane is `80 passed, 0 failed` (`7` environment
skips; `924` assertions), and the standing suite is `771 passed, 0 failed` (`704`
environment skips; `8,098` assertions across `1,475` tests/`268` files). Fresh
migration, database acceptance, review seed, runtime-DML and SECURITY-DEFINER proofs,
exact schema, typecheck, `87` import-boundary files, `23` dependency licences, zero
audit vulnerabilities, JavaScript syntax and diff checks are green. A native Windows
execution of the exact database-only setup sequence rebuilt `93` tables and the
canonical referee printed `11 passed, 0 failed of 11`. Migration0037 SHA-256 is
`82df1de46ee97771390d1d102142380b40b590456f687fdd1bd0cd1d3a4d601a`.

Independent Tier-3 review remains deferred under the founder's build-first direction.
No approval, Phase-6/app completion, local promotion, merge, push or deployment is
claimed by opening this order.
