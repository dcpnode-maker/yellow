# Order 227 — Governed initial room-condition ingress

**Status:** BUILT-UNREVIEWED-D598
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-room-condition-initialization`
**Base:** `bd4f246` (built-unreviewed Order226)
**Risk tier:** 3 — owner-mediated room-condition truth, actor evidence and event atomicity
**Owner:** Codex implementation; independent high-risk approval remains deferred by founder build-first direction

## Outcome

An authorized operator following an exact `room_condition_missing` check-in blocker can
inspect one server-owned missing-condition candidate, deliberately record its first
canonical condition, and return through authoritative Housekeeping and check-in truth.
Existing conditions can never be overwritten through this ingress.

## Fixed policy

- The read target is one exact active physical room inside the granted property whose
  canonical `unit_condition` row is absent. Existing, inactive, foreign and wrong-
  property targets are concealed.
- Initial values are exactly `clean`, `dirty` and `pickup`. `inspected` is excluded
  because it remains evidence produced only by the governed verification transition.
- Candidate GET requires `housekeeping.tasks:read`; initialization requires the new
  exact-property least-privilege `housekeeping.conditions:initialize` grant. The
  server returns the exact allowed literals; no broader generic write scope exists.
- The command accepts only `{ expectedRoomCondition: null, roomCondition }`. Tenant,
  property, room, actor, updater, time, prior state and authority are server-owned. An
  Idempotency-Key header is mandatory.
- Migration 0030 may expose one fixed-search-path owner-mediated insert-only
  capability. It locks/revalidates tenant context, active actor, exact property and
  active physical room, proves the condition row is absent, inserts once, and never
  upserts, updates or deletes.
- The same transaction records exactly one `unit.condition_changed` fact and outbox
  event with `previous_condition: null`; no new event or table is introduced.
- The browser never infers absence from the paged condition list. Only the exact
  candidate GET can emit an initialization form, and only for the current contextual
  `room_condition_missing` assigned space.

## Exact scope

- this order and its intentional-red/focused PostgreSQL, HTTP and UI tests;
- `migrations/0030_governed_unit_condition_initialization.sql`;
- `src/contexts/housekeeping/tasks.ts`, `src/contexts/housekeeping/index.ts`;
- minimal composition in `src/http/operator.ts`, `src/app.ts`, `src/server.ts` only
  if constructor wiring requires it;
- `src/http/operator/index.html`, `src/http/operator/operator.js`, and focused
  `operator.css` presentation;
- `scripts/seed-review.ts` only for the exact review-user scope and one deliberately
  absent active-room condition fixture;
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

`migrations/0001_init.sql`, reservation/check-in/occupancy/task/folio truth and
dependencies remain unchanged.

## Required work

1. Commit intentional red before implementation.
2. Add migration 0030 with exact function owner/signature/search path/ACL and parent-
   space locking that serializes first writes while retaining raw runtime DML denial.
3. Add exact candidate and actor-bound idempotent initialize methods. The callback
   performs the capability call plus one minimized fact and one outbox event in one
   transaction; publication failure rolls everything back.
4. Add no-store exact-room candidate GET and POST routes. Strict UUID/query/body/header
   parsing, exact property grants, 404 concealment, 409 conflict, 201/replay and
   correlation headers are mandatory.
5. Add one inline semantic initialization disclosure only inside the current missing-
   condition Housekeeping return context. No default literal, optimistic row, storage
   or polling. Success/conflict refetches candidate, condition board and check-in
   readiness before exact-or-safe focus.
6. Preserve all six appearances, 44px controls (Android 48px), 375px/200% containment,
   keyboard/focus, forced colours and reduced motion.

## Forbidden

- changing or deleting any existing `unit_condition` row, generic condition CRUD,
  bulk initialization, upsert, `inspected` initialization, automatic defaulting or
  browser-derived absence;
- task creation/transition/assignment, reservation/check-in/occupancy/OOO/OOS,
  financial/day/statutory mutation or inferred readiness;
- new table, event, dependency, polling or browser storage;
- local promotion, second local, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** migration/function/service/routes/scope and semantic controls are absent first.
- **P1 authority:** fresh migrations 1–30 expose only the exact governed capability;
  PUBLIC/direct-login/raw runtime condition DML remain denied.
- **P2 ingress:** every allowed literal records exact actor/time and one row; existing,
  hostile and foreign targets write nothing and conceal foreign truth.
- **P3 replay/concurrency:** exact replay is stable, changed reuse conflicts, and 20
  contenders on one absent room converge to one row/fact/event.
- **P4 rollback:** injected fact/outbox failure rolls back condition, evidence and
  idempotency; retry succeeds once.
- **P5 HTTP:** strict read/initialize property authority, minimized no-store JSON,
  concealment/conflict and replay headers are exact; `inspected` is rejected.
- **P6 UI:** exact stale matrix, unchanged retry key, authoritative success/conflict
  refetch, Order226 safe-return focus and six-appearance accessibility are executable.
- **P7 standing:** Order200/201/208/226 regressions, type/boundary/licence/audit/full
  suite, schema and fresh referee 11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Absence-only room-condition initialization is atomic and executable.
- [x] Authority, hostile boundaries, rollback, replay and convergence are proved.
- [x] The exact missing-condition operator journey is usable and stale-safe.
- [x] Standing gates are green and the result is recorded built-unreviewed.
