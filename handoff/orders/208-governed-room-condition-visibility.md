# Order 208 — Governed room-condition visibility

**Status:** BUILT-UNREVIEWED-D560 — implementation and executable proof complete; independent product review deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-room-condition-visibility`
**Base:** `f12fe18` (built-unreviewed Order207)
**Risk tier:** 2 — read-only tenant/property association and operational disclosure
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

The existing Housekeeping workbench exposes a bounded, filterable Room conditions
panel sourced directly from canonical active physical-room `space` and
`unit_condition` truth. Operators can see every loaded room condition even when no
housekeeping task exists, without inventing readiness, occupancy, task or guest
meaning.

## Fixed read policy

- Add `HousekeepingTaskService.listConditions` and exactly
  `GET /api/v1/properties/{property}/housekeeping/conditions`.
- Reuse `housekeeping.tasks:read`, exact property grant and transaction-local tenant
  context. Responses are `Cache-Control: no-store`.
- Read same-tenant, exact-property active physical-room `space` joined to
  `unit_condition`, ordered by `space.code COLLATE "C", space.id`.
- Default limit is 50, maximum 100. Optional literal
  `condition=clean|dirty|pickup|inspected`; a canonical opaque keyset cursor is bound
  to that exact filter.
- Return one deeply frozen result shaped exactly as
  `{ rooms: [{ spaceId, code, floor, condition, updatedAt }], nextCursor }`.
- Validate stored UUID, literal condition and canonical timestamp truth. Malformed
  stored truth fails closed.
- Do not expose updater identity, tasks/assignees, occupancy, reservation/guest,
  out-of-order/service, readiness, sources/reasons or any inferred room status.

## Exact scope

- `handoff/orders/208-governed-room-condition-visibility.md`
- `src/contexts/housekeeping/tasks.ts`, `src/contexts/housekeeping/index.ts`
- `src/http/operator.ts`, `src/app.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- new `tests/housekeeping-condition-board.intentional-red.test.ts`,
  `tests/housekeeping-condition-board.integration.test.ts`, and
  `tests/operator-housekeeping-condition-board.integration.test.ts`, plus isolated
  DOM/interaction assertions in
  `tests/operator-housekeeping-condition-board-ui.integration.test.ts`
- focused additions to `tests/review-seed.integration.test.ts` only if needed to
  prove existing deterministic condition fixtures; no seed mutation is admitted
- room-condition read-only sections in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No migration, dependency, permission, table, event, fact, outbox, task, occupancy,
reservation, financial, local or state mutation is admitted. Every migration and
`migrations/0001_init.sql` remain byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Implement exact keyset/filter semantics and deep validation/freeze in the existing
   housekeeping context while preserving the task lifecycle unchanged.
3. Add the one read-only operator/API route with strict query allowlisting,
   concealment and no-store behavior.
4. Add a bounded Room conditions panel to the existing Housekeeping workbench with
   filter, loaded-row count, paging, refresh/retry/loading/empty/error and stale
   property/view/request guards.
5. Preserve keyboard focus, 44px controls, 375px/200%-zoom containment,
   reduced-motion, forced-colour and all supported appearances.

## Forbidden

- condition mutation, task creation/transition/assignment, occupancy/reservation/
  guest association, readiness inference, OOO/OOS conflation or discrepancy meaning
- updater/source/reason disclosure, counts claimed as whole-property totals, global
  offset paging, broad grants, raw DML, migration, dependency or new permission
- local promotion, second local, merge, push, deployment, Phase-6 or app-complete claim

## Pre-registered proof

- **P0 red:** service method, exact route and human panel/stale guard are absent.
- **P1 exact read:** ordering, default/max limit, literal filter, cursor/filter binding,
  canonical bytes, validation and deep freeze are green.
- **P2 boundaries/no-write:** tenant/property/active-room containment, hostile and
  malformed truth rejection, minimized shape and repeated mutation-free reads.
- **P3 HTTP:** scope 403, grant/foreign 404, malformed/extra query 400, no-store and no
  condition-write route.
- **P4 operator:** loaded count, filtering, paging, empty/error/retry/loading/stale/
  focus/responsive/reduced-motion/forced-colour/appearances are green; task actions
  remain unchanged.
- **P5 fixtures:** existing deterministic condition truth is distinguishable and
  reseed remains an exact no-op with zero new evidence or mutation.
- **P6 standing:** fresh migrations1–27, acceptance/runtime-DML/definer/schema,
  type/boundary/licence/audit/JS/diff/full suite and referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Canonical room conditions are exact, minimized, paged and mutation-free.
- [x] Exact API authorization/concealment/query/no-store behavior is proven.
- [x] A human can filter, page and refresh the accessible Housekeeping panel.
- [x] Result is recorded built-unreviewed without claiming mutation, discrepancy,
  Phase-6/app completion, local promotion, merge, push or deployment.
