# Order 228 — Governed arrival pickup-task dispatch

**Status:** READY-D599
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-arrival-pickup-task-dispatch`
**Base:** `0a11bb6` (built-unreviewed Order227)
**Risk tier:** 3 — owner-mediated task lifecycle, staff assignment and event atomicity
**Owner:** Codex implementation; independent high-risk approval remains deferred by founder build-first direction

## Outcome

An authorized operator can dispatch the exact currently linked arrival pickup task to
an active staff Party, start it, and complete it from canonical reservation pickup-task
detail. Every step revalidates authoritative reservation, travel, task and assignment
truth and records one same-transaction lifecycle fact and outbox event.

## Fixed policy

- The only target is the exact current arrival `travel_detail.pickup_task_id` for the
  exact-property reservation, with the complete canonical Order213 shape:
  `kind='guest_request'`, `subject_type='reservation'`, exact reservation subject,
  `department='transport'`, arrival schedule as `due_at`, priority 3 and payload
  exactly `{"requestType":"arrival_pickup"}`.
- Legal adjacent transitions are exactly `assign: open -> assigned`,
  `start: assigned -> in_progress`, and `complete: in_progress -> done`. Assignment
  requires one same-tenant active Party with an exact `staff` role. Reassignment,
  reopen, cancel, verify and non-adjacent transitions are rejected.
- Candidate/detail read remains under `reservations.lifecycle:read`. Assignment needs
  new exact-property `stay-operations.pickup-tasks:dispatch`; start and complete need
  `stay-operations.pickup-tasks:work`. These scopes confer no generic task authority.
- Commands accept only the exact task id, expected task status, expected nullable
  assignee Party id and, for assign only, staff Party id. Tenant, property,
  reservation, arrival link, actor, clock, canonical shape and resulting state are
  server-owned. Every command requires an actor-bound `Idempotency-Key`.
- Migration0031 may expose one fixed-search-path owner-mediated transition capability.
  It locks and revalidates actor, property, reservation, arrival link, canonical task
  and active staff truth, applies one adjacent compare-and-set transition and sets
  `completed_at` only on completion. Raw runtime task DML remains denied.
- Each changed transition records exactly one minimized `task.status_changed` fact and
  one outbox event in the same transaction. Replay emits no second task/fact/event;
  evidence publication failure rolls back the task transition.
- The nested pickup-task panel renders only the zero-or-one current server-authorized
  action. Assign reuses the existing detached staff Party search without copying
  contact data; start and complete need explicit semantic controls. Success and
  conflict refetch exact canonical detail before focus restoration.

## Exact scope

- this order and committed intentional-red/focused PostgreSQL, service, HTTP and UI tests;
- `migrations/0031_governed_arrival_pickup_task_transition.sql` and mechanically
  generated `tests/schema/expected.sql`;
- one focused `src/contexts/stay-operations/pickup-task-dispatch.ts` plus exports from
  `src/contexts/stay-operations/index.ts`;
- minimal adapter/route/composition changes in `src/http/operator.ts`, `src/app.ts`
  and `src/server.ts` only as constructor wiring requires;
- `src/http/operator/operator.js` and focused `operator.css` presentation;
  `index.html` only if executable preflight proves a static shell hook is required;
- `scripts/seed-review.ts` only for exact new role scopes and one deterministic
  linked open pickup task with active staff candidate;
- focused authority/schema maintenance in `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, and `tests/schema/expected.sql`;
- pickup-task-only notes in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, and
  `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log`, and `handoff/LEDGER.md`.

`migrations/0001_init.sql`, generic task APIs, travel capture/automation, reservation,
occupancy, vehicle, parking, finance, business-day and statutory truth remain unchanged.

## Required work

1. Commit intentional red before implementation.
2. Add migration0031 with exact function owner/signature/search path/ACL, canonical
   link/task locks, staff validation and adjacent CAS transitions.
3. Add actor-bound idempotent service commands. The callback performs the capability
   call plus one minimized fact and outbox event in one transaction.
4. Add three strict no-query POST actions under the existing exact pickup-task route.
   UUID/body/header/property scopes, 404 concealment, 409 stale/illegal state,
   200/replay and correlation headers are mandatory.
5. Add one stale-safe assignment disclosure and zero-or-one start/complete action to
   the current nested detail. No optimistic status, polling or browser persistence.
6. Preserve all six current appearances, 44px controls (Android 48px), 375px/200%
   containment, keyboard/focus, forced colours and reduced motion.

## Forbidden

- generic task CRUD/board, arbitrary guest-request mutation, reassignment, cancel,
  reopen, verify, batch dispatch, notes, payload, due time, priority or travel edits;
- Party/contact disclosure, driver/vehicle/parking/queue/message/occupancy/check-in,
  financial/day/statutory mutation or inferred transport outcome;
- new table, task status, event, dependency, polling or browser storage;
- local promotion, second local, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** migration/function/service/routes/scopes and semantic actions are absent first.
- **P1 authority:** fresh migrations1–31 expose only the exact owner capability;
  PUBLIC/direct-login/raw runtime task DML and foreign actor/property/tenant paths fail.
- **P2 lifecycle:** exact open/assigned/in-progress truth advances only one adjacent
  step; inactive/non-staff/foreign assignees and hostile linked task shapes write nothing.
- **P3 replay/concurrency:** exact replay is stable, changed reuse conflicts, and
  concurrent same-evidence contenders converge to one transition/fact/event.
- **P4 rollback:** injected fact/outbox failure rolls back task status/assignment/
  completion time and idempotency; exact retry succeeds once.
- **P5 HTTP:** strict scope/grant/body/header/query/identity containment and minimized
  no-store response/error mapping are exact.
- **P6 UI:** current-state action matrix, detached staff selection, in-flight locking,
  stale identity, authoritative refresh and history/focus containment are executable.
- **P7 standing:** Orders213–215 regressions, type/boundary/licence/audit/full suite,
  schema and fresh referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact arrival pickup task assignment/start/completion is atomic and executable.
- [ ] Authority, hostile boundaries, rollback, replay and convergence are proved.
- [ ] The exact human dispatch journey is accessible and stale-safe.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
