# Order 213 — Governed arrival pickup-task automation

**Status:** READY-D569 — intentional red committed before implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-reservation-travel-capture`
**Base:** `2114474` (built-unreviewed Order212)
**Risk tier:** 3 — owner-mediated task creation and travel linkage
**Owner:** Codex implementation; independent executable review remains required before approval

## Outcome

A current arrival travel row that still requests pickup and has an exact scheduled
instant automatically produces exactly one canonical transport guest-request task.
The automation links that task back to `travel_detail.pickup_task_id`, so retries,
duplicate source events and concurrent workers cannot create duplicate work.

## Fixed contract

- One durable consumer named `arrival-pickup-task` observes only
  `reservation.modified` and never trusts its minimized travel diff as command truth.
  It re-reads and locks the exact current reservation and arrival `travel_detail` row.
- It creates only when the reservation is `reserved|due_in`, arrival pickup remains
  requested, `scheduled_at` is present and no pickup task is linked. False, absent,
  unscheduled, already-linked, foreign, terminal and unrelated event truth is a no-op.
- The canonical existing Task primitive is used without a new kind or table:
  `kind='guest_request'`, `status='open'`, `subject_type='reservation'`, exact
  reservation subject, `department='transport'`, `due_at=scheduled_at`, no assignee,
  default priority 3, and minimized payload `{"requestType":"arrival_pickup"}`.
- Migration 0029 supplies one fixed-search-path SECURITY DEFINER capability. It binds
  exact runtime role, tenant context, property, reservation, current state and travel
  association, locks in deterministic order, atomically inserts one task and links it
  to the arrival row, and returns the current linked identity. Raw app-role task and
  travel DML remain denied.
- Consumer marker, task creation/linkage, one `task.created` fact and one outbox event
  commit in the same transaction. Evidence reuses the source actor and correlation id,
  records the source event as causation, and exposes no travel note, Party/contact,
  vehicle, parking, financial or statutory data.
- Stale source events converge on current truth. Before linkage a newer pickup=false
  or missing schedule is a no-op; a later qualifying modification can create. After
  linkage Order212 remains fail-closed: this slice never edits, cancels, reassigns,
  detaches or deletes the task and never changes travel truth.
- The workbench starts this consumer with one explicit environment-controlled worker
  and records its enabled state in project status. No new operator route or form is
  needed: canonical reservation detail already shows requested versus linked truth.

## Exact scope

- this order plus intentional-red and focused Order213 tests
- `migrations/0029_governed_arrival_pickup_task.sql` and mechanically generated
  `tests/schema/expected.sql`
- new `src/contexts/stay-operations/pickup-task-automation.ts` plus focused exports
- focused wiring/status in `src/server.ts` and `src/project-status.ts`
- focused runtime-DML, SECURITY-DEFINER, migration, consumer and reservation-detail
  proof only where required by this contract
- Order213 sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`, `docs/SECURITY.md`,
  `docs/STATE-MACHINES.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only for a real scope correction

No baseline edit, new table/task kind/status/event/dependency, task board or lifecycle
change, HTTP mutation, manual creation screen, assignment/routing policy, cancellation,
post-link edit, notes, vehicle/parking/occupancy/financial/statutory effect, second
local, merge, push or deployment is admitted.

## Required work

1. Commit intentional red before implementation.
2. Add and prove the bounded owner capability while raw app-role DML remains denied.
3. Add one durable current-truth consumer with atomic marker/task/link/evidence.
4. Prove no-op, one-shot, replay, duplicate-event, concurrency and rollback behavior.
5. Wire one bounded worker without changing existing consumer behavior.
6. Regenerate schema truth mechanically and pass complete standing/referee gates.

## Pre-registered proof

- **P0 red:** migration, consumer and worker/status wiring are absent.
- **P1 authority:** raw DML fails; only exact runtime/tenant/property/reservation/current
  arrival truth may call the capability; hostile associations fail closed.
- **P2 automation:** exact qualifying truth creates and links one minimized task;
  unrelated/false/unscheduled/terminal/already-linked truth is no-op.
- **P3 durability:** marker, task, link, fact and outbox are atomic; duplicate events,
  restart and concurrent workers converge to one task; publication failure retries.
- **P4 containment:** source actor/correlation/causation are exact and no unrelated
  reservation, travel, Party, occupancy, financial or statutory state changes.
- **P5 standing:** focused, migration/schema, type/boundary/licence/audit/JS/diff,
  full suite and fresh referee 11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [ ] Qualifying current arrival pickup truth creates and links exactly one task.
- [ ] Raw DML and every unrelated or stale path fail closed or no-op as contracted.
- [ ] Focused, standing and referee proofs are green.
- [ ] Result is recorded built-unreviewed; independent Tier-3 execution remains pending.
