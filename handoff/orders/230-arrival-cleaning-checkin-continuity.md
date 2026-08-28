# Order 230 — Arrival cleaning-task check-in continuity

**Status:** BUILT-UNREVIEWED-D605
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/arrival-cleaning-checkin-continuity`
**Base:** `d378006` (built-unreviewed Order229)
**Risk tier:** 2 — UI-only composition of existing governed task and readiness truth
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

An operator who opens the exact Order229 cleaning task from a blocked arrival can
perform the existing governed task actions and return directly to the same canonical
check-in preparation journey. After cleaning, the existing server readiness read—not
browser inference—determines whether check-in is available.

## Fixed policy

- Only task detail opened by the current exact Order229 existing-task or create-task
  result may carry arrival-return context.
- The frozen descriptor binds property, reservation, confirmation, due-in status,
  `dirty_room_override_unauthorized`, assigned room, original room condition,
  canonical check-in path, exact cleaning task identity and current navigation generations.
- Generic Housekeeping board/detail navigation never gains arrival meaning because a
  room or task identity happens to match.
- Contextual detail presents **Back to arrival** while work remains. Exact authoritative
  `done` plus `clean` may relabel it **Continue check-in preparation**, but the browser
  never claims readiness or invokes check-in.
- Deliberate activation returns through existing canonical reservation detail with
  `workbench=check-in`, refetches reservation and readiness, then restores exact blocker
  action focus if unresolved or the safe check-in heading if resolved.
- Start, Complete and Verify retain their existing endpoint, body, idempotency,
  authority and refresh behavior. No transition or navigation is automatic.
- Browser Back keeps the existing detail-to-Housekeeping-board behavior. Refresh and
  Forward may reconstruct only valid contextual detail. Verify exit preserves the
  arrival-return descriptor on the board.
- Property, reservation, blocker, room, task, route, history state, active view,
  detail data, request generation, action and connected-DOM mismatches are inert.
- Direct Housekeeping and direct task-detail routes remain unchanged.

## Exact scope

- this order and focused intentional-red/navigation/UI tests;
- `src/http/operator/operator.js`;
- `src/http/operator/index.html` only if the existing contextual return control cannot be reused;
- focused `src/http/operator/operator.css` only if detail placement requires styling;
- only truly superseded Order220, Order226 and Order229 navigation expectations;
- `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

No TypeScript server, API, domain/context, permission, contract/security, migration,
schema, seed, dependency, event or local-promotion file is admitted.

## Forbidden

- deriving readiness from task status or room condition in the browser;
- automatic check-in, automatic task transition or optimistic condition/readiness;
- adding or changing an endpoint, payload, scope, permission or lifecycle rule;
- adopting generic Housekeeping tasks as arrival tasks;
- polling, browser storage or copied reservation/task truth;
- local promotion, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** contextual task-detail arrival descriptor/action is absent first.
- **P1 admission:** exact Order229 existing-task and created-task paths admit the
  descriptor; generic board/detail openings do not.
- **P2 containment:** every property/reservation/blocker/room/task/path/view/
  generation/history/DOM mismatch suppresses or disables the action.
- **P3 lifecycle continuity:** assigned→in-progress→done refreshes authoritative task,
  board and condition truth without losing the descriptor; errors and 409s stay put.
- **P4 return truth:** one deliberate activation reopens canonical check-in
  preparation, executes existing reservation/readiness reads and restores exact or
  safe focus without issuing check-in.
- **P5 history:** detail refresh and Forward restore valid context; browser Back and
  Escape preserve board-first behavior; Verify exit retains board-to-arrival continuity.
- **P6 compatibility:** direct Housekeeping, generic task detail, Order220 actions,
  Order226 return and Order229 task creation remain exact.
- **P7 authority:** no new request or mutation transport; existing GET and governed
  transition endpoints only.
- **P8 UX:** semantic 44px controls, Android 48px, six appearances, 375px/200%,
  keyboard/focus, forced colours and reduced motion.
- **P9 standing:** focused Order200/201/217/220/226/229 regressions plus typecheck,
  boundaries, licence, audit, JavaScript, full suite, schema and referee remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact Order229 task context survives task detail and governed actions.
- [x] One deliberate return refetches authoritative check-in truth.
- [x] Direct Housekeeping and every stale/history/accessibility boundary pass.
- [x] Standing gates are green and the result is recorded built-unreviewed.

## Build evidence

- Intentional-red commit `ccc6297` proved the missing contextual task-detail return
  before implementation (`0/2` intended failures).
- Focused Order230 navigation and presentation proof passes `17/17` with `182`
  assertions; adjacent Order217/220/226/229/230 continuity passes `36/36` with
  `467` assertions.
- The full repository suite passes `695`, skips `657` environment-gated cases and
  fails `0` across `1,352` tests in `244` files with `7,525` assertions.
- Typecheck, `84` import boundaries, `23` dependency licences, dependency audit,
  JavaScript syntax and diff hygiene are green.
- A fresh database-only setup/referee passes `11/11`. This UI-only order changes no
  schema; Order229's exact schema and migration evidence remain inherited.
- Independent product review remains deferred under the founder's build-first
  direction. This is built-unreviewed, not approved or promoted.
