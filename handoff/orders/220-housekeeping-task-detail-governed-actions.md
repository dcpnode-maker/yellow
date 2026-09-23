# Order 220 — Housekeeping-task detail governed actions

**Status:** BUILT-UNREVIEWED-D584
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/housekeeping-task-detail-governed-actions`
**Base:** `205b5af` (built-unreviewed Order219)
**Risk tier:** 2 — human composition of the existing Order201 governed transition
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

The exact Order217 housekeeping-task detail becomes operational: it presents at most
one server-authorized Start, Complete or Verify action and submits only through the
existing Order201 governed transition. No lifecycle meaning or mutation authority is
added.

## Fixed contract

- The exact detail response carries a frozen `allowedActions` array derived from the
  same canonical task/condition/assignment truth and exact property grants already
  used by the Order201 board. It contains zero or one of `start|complete|verify`.
- Detail never infers permission. Start/Complete require the existing property work
  grant; Verify requires the distinct existing inspect grant. The command endpoint
  remains the final authority and revalidates status, condition, timestamp, actor and
  property inside its existing transaction.
- A semantic action is emitted only from successfully validated current detail truth.
  Before submission, recheck property, routed task, detail task/status/condition/
  timestamp/action, request generation, exact nested path and connected visible
  panel/action. Stale identity is inert.
- Submit the existing exact body and actor-bound idempotency key to the existing
  transition endpoint. Retry of an unchanged draft retains its key; a 409 discards the
  key and refreshes authoritative detail/condition truth.
- Start and Complete refresh exact detail, board and condition truth. Verify exits the
  now-ineligible detail to the existing board, refreshes authoritative truth and
  restores safe focus. No optimistic lifecycle claim is painted.
- The action is at least 44px, Android 48px, wraps at 375px/200% zoom and has visible
  focus, forced-colour and reduced-motion containment across all six appearances.

## Exact scope

- this order and its intentional-red test;
- the existing housekeeping detail read projection in `src/http/operator.ts` and
  focused browser composition in `src/http/operator/operator.js` / `operator.css`;
- focused detail authority, transport, stale/idempotency/history and six-appearance
  tests plus existing Order201/217 regressions;
- `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No command/domain/context behavior, HTML, contract/security, schema/migration/seed,
dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** detail response/action submit helpers are absent.
- **P1 authority:** exact zero-or-one server-derived action and distinct grants.
- **P2 transport:** existing endpoint/body/idempotency only; command still revalidates.
- **P3 containment:** every property/task/status/condition/timestamp/path/panel/action/generation mismatch is inert.
- **P4 refresh:** success/409/verify yield authoritative detail/board/condition truth and safe focus/history.
- **P5 UX:** six appearances, 375px/200% zoom, focus, forced colours and reduced motion.
- **P6 standing:** Orders201/217 plus type/boundary/licence/audit/JS/diff/schema/referee green.

## Definition of done

- [x] Intentional red preceded implementation.
- [x] Exact detail emits only its current server-authorized action.
- [x] Existing governed transition remains the sole mutation authority.
- [x] Stale, idempotency, refresh, history, focus and six-appearance proof is green.
- [x] Standing gates are green and result is recorded built-unreviewed.

## Built evidence

- Focused integrated proof: 37 passed, 0 failed, 375 assertions across eight files.
- Standing proof: 547 passed, 629 environment skips, 0 failed, 6,057 assertions;
  1,176 tests across 210 files.
- Typecheck, 82 import boundaries, 23 dependency licences, zero-vulnerability audit,
  JavaScript syntax and diff checks are green.
- Fresh migrations 1–29 produced the canonical 93-table schema and the referee passed
  11/11. The stale setup wrapper still expects 89 tables; only that obsolete count was
  bypassed for the direct canonical schema/referee proof.
- The disposable `yellow-order220-build` containers, volumes and networks were removed.
- Independent product review remains deferred by the founder's build-first direction.
