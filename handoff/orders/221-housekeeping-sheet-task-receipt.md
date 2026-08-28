# Order 221 — Housekeeping-sheet task receipt

**Status:** READY-D585 — intentional red must precede implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/housekeeping-sheet-task-receipt`
**Base:** `3f80b50` (built-unreviewed Order220)
**Risk tier:** 2 — UI-only composition of an existing governed command receipt and task detail
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

After deliberate housekeeping-sheet generation, the operator sees the exact tasks in
the existing server receipt and can open each through the already-governed Order217/220
task-detail journey. The browser no longer discards a successful generation result.

## Fixed contract

- Accept only the existing exact generation response: canonical sheet, property/date/
  attendant continuity, bounded task count, unique canonical task/space identities,
  nonblank bounded room/profile values and only `daily|on_departure` cadence.
- Deep-freeze the validated receipt. `taskCount` must equal the task array length and
  every task belongs only to the current successful or replayed generation response.
- Render one transient, bounded receipt with one **Open task** action per task. It makes
  no new request until deliberately activated and never claims persistent sheet history.
- Before navigation, recheck property, sheet date, attendant, receipt generation,
  task/space/cadence, exact visible connected panel/action, active Housekeeping view and
  current path. Stale identity is inert.
- Reuse the existing canonical housekeeping-task detail route/read and Order220 action
  authority. The task endpoint refetches current truth; terminal/ineligible/changed tasks
  retain its existing concealed/not-found behavior.
- Clear the transient receipt on property/date/attendant/draft changes, new preview,
  conflict/error or leaving the relevant journey. No polling or browser storage.
- Back/Forward/refresh/direct-route and focus behavior remain bounded and accessible.
  The receipt and actions support all six appearances, 375px/200% zoom, visible focus,
  forced colours and reduced motion.

## Exact scope

- this order and its intentional-red test;
- `src/http/operator/operator.js` and focused `operator.css` styles;
- focused generation-receipt validation, stale/history/focus/navigation and
  six-appearance tests plus existing Orders202/217/220 regressions;
- `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, contract/security, schema/migration/seed,
dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** receipt parser/navigation/presentation are absent.
- **P1 validation:** exact frozen bounded response, taskCount equality and unique canonical identities.
- **P2 containment:** property/date/attendant/generation/task/path/view/panel/action mismatches are inert.
- **P3 transport:** deliberate action reuses only the existing task-detail GET/route; no mutation.
- **P4 lifecycle:** success/replay display; draft/property/date/attendant/error/conflict changes clear stale receipt.
- **P5 UX:** bounded list, focus/history and six appearances at 375px/200%, forced colours and reduced motion.
- **P6 standing:** Orders202/217/220 plus type/boundary/licence/audit/JS/diff/schema/referee green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact generation receipt is validated and retained only while current.
- [ ] Every task action reuses the authoritative existing task-detail journey.
- [ ] Stale/history/focus and six-appearance proof is green.
- [ ] Standing gates are green and result is recorded built-unreviewed.
