# Order 217 — Housekeeping-task exact detail

**Status:** READY-D577 — intentional red must precede implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/housekeeping-task-detail`
**Base:** `2963bfc` (built-unreviewed Order216)
**Risk tier:** 3 — tenant/property-sensitive operational-task and room-condition read
**Owner:** Codex implementation; independent executable review remains deferred by founder build-first direction

## Outcome

An operator can open one exact eligible housekeeping task from the existing bounded
Housekeeping board, use a direct link, and return to the same board position. The
detail is read-only recorded truth and creates no generic task authority.

## Fixed contract

- Exact endpoint: `GET /api/v1/properties/:property/housekeeping/tasks/:task`. It
  accepts no query and requires existing `housekeeping.tasks:read` plus its exact
  server-derived property grant.
- `HousekeepingTaskService.get` accepts only lowercase tenant, property and task
  UUIDs. One tenant transaction admits only `kind='housekeeping'`,
  `subject_type='space'`, status `assigned|in_progress|done`, one active physical room
  in the exact property and one canonical room-condition row. Missing, foreign,
  wrong-property/kind/subject/status or inactive-room identity is concealed as 404;
  hostile stored shapes fail closed without partial disclosure.
- Output is exactly `{task:{taskId,taskStatus,spaceId,spaceCode,floor,roomCondition,
  roomUpdatedAt,assigned,dueAt,priority,completedAt}}`. Payload, notes, credits,
  sheet/assignee/Party/contact/updater/reservation/guest/occupancy/discrepancy truth and
  inferred readiness, workload, SLA, urgency or room availability remain absent. The
  result is deeply frozen, no-store and mutation-free.
- Canonical human route is `/p/{property}/housekeeping/tasks/{task}`. Each board card
  exposes one semantic **Open details** action. Direct link, refresh, Back, Forward
  and Escape work; close restores the exact board URL and focus when its source
  remains connected. Property/task/request-generation guards make stale paint inert.
- The detail contains no transition, create, assign, cancel, reopen, delete or other
  mutation and no polling. Existing board lifecycle actions remain unchanged. Apple
  iOS, Android, Windows 95/98, glassmorphism, neomorphism and ERP receive dedicated
  accessible presentation; text carries status meaning, while 375px/200% zoom,
  forced colours and reduced motion remain contained.

## Exact scope

- this order and its committed intentional-red test;
- `src/contexts/housekeeping/tasks.ts` and its existing index export only if needed;
- focused adapter/route wiring in `src/http/operator.ts` and `src/app.ts`;
- exact housekeeping route/detail integration in `src/http/operator/operator.js` and
  focused styles in `src/http/operator/operator.css`; `index.html` only if executable
  preflight proves a static shell is required;
- focused service, HTTP, route/history/focus, theme/accessibility and Order201 board
  regression tests;
- Order217 sections in `docs/CONTRACTS.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`,
  `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only for a real scope correction.

No migration/schema/seed, new scope/event/table/status/dependency, generic task API,
task mutation, notes/payload/credits/assignee identity, reservation/guest/occupancy or
discrepancy inference, polling, second local, promotion, merge, push or deployment is
admitted.

## Required work

1. Commit intentional red before implementation.
2. Add exact tenant/property/task/active-room/condition containment and canonical row mapping.
3. Add exact HTTP authority, validation, concealment, no-store and bounded errors.
4. Add stale-safe nested board detail with direct-link/history/Escape/focus restoration.
5. Add dedicated six-appearance, small-viewport, zoom, forced-colour and reduced-motion presentation.
6. Run focused real-database, HTTP/UI, standing and fresh referee proof.

## Pre-registered proof

- **P0 red:** exact service, endpoint and nested human route are absent.
- **P1 read truth:** assigned/in-progress/done examples return only the declared
  deeply frozen row; literal timestamps and repeated byte-equivalent no-write reads hold.
- **P2 containment:** malformed plus foreign/wrong-property/kind/subject/status and
  inactive-room targets conceal; hostile stored shapes fail closed with no disclosure.
- **P3 transport:** adapter is no-store, query-empty and property-bound with only
  declared validation/not-found/conflict outcomes.
- **P4 human route:** board action, direct link, refresh, Back/Forward/Escape/focus and
  every stale identity boundary are exact; board return intent survives.
- **P5 UX:** six appearances, 375px/200% zoom, visible focus, forced colours and
  reduced motion are explicit; no mutation affordance exists in detail.
- **P6 standing:** focused, Order201 regressions, type, boundary, licence, audit,
  JavaScript, diff, schema, full suite and fresh referee remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Service and endpoint return only exact eligible housekeeping-task truth.
- [ ] Human detail route is stale-safe, accessible and read-only across six appearances.
- [ ] Existing board actions and governed transitions remain unchanged.
- [ ] Focused, standing and referee gates are green.
- [ ] Result is recorded built-unreviewed; independent Tier-3 execution remains pending.
