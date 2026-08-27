# Order 201 — Governed housekeeping task lifecycle and inspection workbench

**Status:** READY-D543 — intentional red and implementation required
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-housekeeping-task-lifecycle`
**Base:** `96573e1b8126` (built-unreviewed Order200)
**Risk tier:** 3 — room-readiness truth and owner-mediated task/condition transitions
**Owner:** Codex implementation; independent high-risk proof deferred under founder build-first direction

## Outcome

An authorized housekeeping operator can open one property task board and perform the
existing canonical lifecycle one action at a time: start an assigned task, complete an
in-progress dirty/pickup room task so the room becomes clean, and independently verify
a done clean-room task so the room becomes inspected. The server owns current task and
room truth, allowed actions, actor, tenant, property and inspection authority.

## Fixed policy

- Consume the existing task lifecycle unchanged: `assigned -> in_progress -> done ->
  verified`. This slice creates no task and admits no reopen, cancel, assignment or
  skipped state.
- Start changes only task status. Complete requires authoritative dirty/pickup and
  atomically changes it to clean. Verify requires authoritative clean and atomically
  changes it to inspected.
- Only `kind='housekeeping'`, `subject_type='space'` tasks attached to one active
  physical space in the granted property are eligible.
- Every command binds the exact expected task status, room condition and room
  `updated_at`; stale browser state conflicts without mutation.
- `unit_condition.updated_by/updated_at`, task completion time, fact actors/times and
  outbox events retain completion/inspection evidence. No PII is returned.
- Exact property scopes are `housekeeping.tasks:read`, `housekeeping.tasks:work` and
  `housekeeping.tasks:inspect`; verification requires the distinct inspect grant.
- Direct runtime task or condition DML stays denied. Migration 0026 may add only one
  bounded yellow-owner runtime capability over the existing tables.

## Exact scope

- `handoff/orders/201-governed-housekeeping-task-lifecycle.md`
- `migrations/0026_governed_housekeeping_task_transition.sql`
- `src/contexts/housekeeping/tasks.ts`, `src/contexts/housekeeping/index.ts`
- minimal composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/housekeeping-task-lifecycle.intentional-red.test.ts`,
  `tests/housekeeping-task-lifecycle.integration.test.ts`,
  `tests/operator-housekeeping-workbench.integration.test.ts`, focused additions to
  `tests/review-seed.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`, and `tests/schema/expected.sql`
- housekeeping-only sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable preflight requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

`migrations/0001_init.sql` remains byte-identical. No new table, state, dependency or
extension type is admitted.

## Required work

1. Commit P0 intentional red before implementation.
2. Add migration 0026 with one fixed-search-path, owner-mediated, exact-tenant
   capability that locks/revalidates task, room condition, active actor and property,
   applies only the three fixed adjacent actions and remains unavailable to PUBLIC,
   direct login and raw app-role DML.
3. Add an actor-bound idempotent domain service that lists a bounded property board and
   executes one action with same-transaction task/condition changes, fact(s) and
   outbox event(s).
4. Add no-store property-granted read/action routes. The handler derives work versus
   inspect authority and never accepts actor, tenant, property, target state or room
   readiness from the browser.
5. Add a Housekeeping workspace with task/room/status/condition evidence, one permitted
   primary action per row, inline blocker/retry, authoritative refetch, retained-key
   transport retry, stale property/view/request guards, deep-link/back, keyboard/focus,
   reduced motion and all existing appearances.
6. Seed deterministic assigned dirty and done clean housekeeping tasks without applying
   a transition, creating a task sheet, mutating occupancy or changing Order200 examples.

## Forbidden

- task creation, assignment, cancellation, reopen, generic task CRUD or new task states
- cadence evaluation, sheet generation, attendant allocation, credits or discrepancies
- automatic departure/stayover tasks, queue, travel, vehicle, key or messaging behavior
- reservation/segment/occupancy/OOO/OOS mutation, account/folio/money/day mutation
- checkout, tax/fiscal/document/statutory submission or external calls
- local promotion, second local, merge, push or public/production deployment

## Pre-registered proof

- **P0 red:** migration, service, routes/workbench and exact markers are absent first.
- **P1 authority:** fresh migrations 1–26 expose only the exact governed capability;
  PUBLIC/direct login/raw runtime task-condition mutation remain denied.
- **P2 lifecycle:** assigned start preserves condition; dirty and pickup completion each
  become clean; done clean verification becomes inspected with exact actor/time and
  expected task/condition/updated-at guards.
- **P3 atomic evidence:** task and condition changes, fact(s), outbox event(s) and
  idempotency commit together; injected publication failure rolls all back.
- **P4 hostile boundaries:** wrong state/condition/kind/subject, missing condition,
  inactive actor, foreign tenant/property/space/task and client authority write nothing
  and conceal foreign truth.
- **P5 concurrency:** exact replay is stable, changed reuse conflicts, and twenty
  distinct contenders converge to one transition/evidence effect.
- **P6 operator/seed:** scopes/grants/concealment, server actions, stale guards,
  retained retry, keyboard/focus/deep-link and six appearances pass; deterministic
  task fixtures rerun byte-equivalently and preserve Order200 arrivals.
- **P7 standing:** migration/schema/acceptance/runtime authority, type/boundary/licence/
  audit/full suite and fresh referee 11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Governed task and room-condition transitions are executable and atomic.
- [ ] Authority, hostile boundaries, rollback, replay and convergence are proved.
- [ ] Human housekeeping workbench and deterministic review tasks are usable.
- [ ] Result is recorded built-unreviewed without claiming sheets, checkout, Phase6 or app completion.
