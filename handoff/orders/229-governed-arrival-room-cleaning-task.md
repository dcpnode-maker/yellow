# Order 229 — Governed arrival room-cleaning task creation

**Status:** READY-D601
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-arrival-room-cleaning-task`
**Base:** `c58a734` (built-unreviewed Order228)
**Risk tier:** 3 — owner-mediated operational task creation and arrival linkage evidence
**Owner:** Codex implementation; independent high-risk approval remains deferred by founder build-first direction

## Outcome

An authorized operator following the exact current `room_not_ready` arrival blocker can
select one active property staff attendant and deliberately create the one governed
housekeeping task needed for the assigned dirty or pickup room, then continue through
the existing task-detail and check-in preparation journeys.

## Fixed policy

- Eligibility is server-owned: one exact due-in reservation, its unique current segment,
  exact assigned active physical room, current canonical condition `dirty` or `pickup`,
  and current check-in readiness blocker `room_not_ready` must agree inside one tenant
  transaction. Missing, foreign, inactive, wrong-property or incoherent truth conceals.
- If an actionable housekeeping/space task already exists for that exact room in
  `assigned` or `in_progress`, no duplicate may be created; the exact current task is
  returned for navigation. `open`, `done`, `verified`, `cancelled`, non-housekeeping and
  non-space tasks are not silently adopted or mutated.
- A new task is exactly `kind='housekeeping'`, `subject_type='space'`,
  `status='assigned'`, `department='Housekeeping'`, priority 1, due at the recorded
  arrival instant, and assigned to one selected active same-tenant staff Party. Its
  minimized payload records only governed arrival-cleaning provenance and canonical
  reservation identity; no guest, contact, note, payment or statutory data is stored.
- Exact-property grants are `housekeeping.arrival-tasks:read` for the candidate and
  `housekeeping.arrival-tasks:create` for creation. Existing task work/inspect grants
  remain unchanged. Direct runtime task DML remains denied.
- The command is actor-bound and idempotent. Migration0032 may expose one fixed-search-
  path owner capability that locks and revalidates reservation, segment, room, condition,
  existing actionable task and selected attendant, then creates at most one task.
- Creation and one minimized `task.created` fact/outbox pair commit in the same
  transaction. Exact replay returns the same result, changed-key reuse conflicts,
  contenders converge, and publication failure rolls back task/evidence/idempotency.
- No condition, reservation, segment, occupancy, check-in, folio, financial, business-
  day, key, travel, vehicle, parking, discrepancy or statutory truth changes.

## Exact scope

- this order and its intentional-red/focused PostgreSQL, HTTP, seed and UI tests;
- `migrations/0032_governed_arrival_room_cleaning_task.sql`;
- a bounded arrival-cleaning service in `src/contexts/housekeeping/` and its export;
- exact reservation readiness/detail composition only where required;
- minimal wiring in `src/http/operator.ts`, `src/app.ts`, and `src/server.ts`;
- `src/http/operator/operator.js`, `src/http/operator/operator.css`, and
  `src/http/operator/index.html` only if static semantic markup is required;
- `scripts/seed-review.ts` for exact review grants, active attendant and one deterministic
  dirty due-in candidate without pre-creating the task;
- focused authority/schema tests in `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, and `tests/schema/expected.sql`;
- housekeeping-only notes in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, and
  `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log`, and `handoff/LEDGER.md`.

`migrations/0001_init.sql`, dependencies and unrelated contexts remain unchanged.

## Required work

1. Commit intentional red before implementation.
2. Add migration0032 with one exact owner-mediated create-or-return capability and
   least-privilege ACL. PUBLIC/direct-login/direct-capability/raw runtime task DML stay denied.
3. Add strict candidate read and actor-bound idempotent create service. Revalidate all
   current arrival/room/condition/task/attendant evidence in the command transaction.
4. Add no-store exact-reservation candidate GET and POST routes with strict parsing,
   property grants, 404 concealment, 409 conflict, 201/200 replay and correlation headers.
5. Extend only the exact current `room_not_ready` Housekeeping return context with active-
   staff search, deliberate Create cleaning task, retained-key retry, locked in-flight
   controls, authoritative refetch and navigation into existing task detail.
6. Preserve direct Housekeeping and all six appearances, 44px controls (Android 48px),
   375px/200% containment, keyboard/focus, forced colours and reduced motion.

## Forbidden

- generic task CRUD, automatic scheduling, timers, multiple tasks, reassignment,
  cancellation, reopen, verification, task-sheet creation or cadence changes;
- adopting or mutating open/done/verified/cancelled or unrelated tasks;
- changing room condition, reservation/check-in/occupancy/financial/day/statutory truth;
- guest/contact/note/payment/statutory data in task payload or event;
- new table/event/dependency, polling, browser storage, local promotion, merge, push,
  deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** migration/capability/service/routes/scopes and exact contextual controls are absent first.
- **P1 authority:** fresh migrations1–32 expose only the exact owner capability; PUBLIC,
  direct login, direct capability and raw runtime task DML remain denied.
- **P2 admission:** only coherent due-in + assigned active room + dirty/pickup + exact
  `room_not_ready` + active staff truth can create; hostile and foreign paths conceal.
- **P3 duplicate containment:** one existing assigned/in-progress exact-room housekeeping
  task is returned; every other task shape is ignored without mutation and cannot be adopted.
- **P4 replay/concurrency:** exact replay is stable, changed reuse conflicts and twenty
  contenders converge to one task/fact/outbox.
- **P5 rollback:** injected fact/outbox failure rolls back task, evidence and idempotency;
  retry then succeeds once.
- **P6 HTTP/UI:** no-store authority, strict input, stale matrix, retained retry key,
  locked controls, authoritative refresh, task-detail continuity and accessibility pass.
- **P7 standing:** Order200/201/202/217/220/226/227 regressions, type/boundary/licence/
  audit/full suite, exact schema and fresh referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact arrival room-cleaning task creation is atomic and executable.
- [ ] Authority, duplicate containment, rollback, replay and convergence are proved.
- [ ] The human blocker-to-task journey is stale-safe and usable.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
