# Order 226 — Check-in to Housekeeping continuity

**Status:** BUILT-UNREVIEWED-D596
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/checkin-housekeeping-continuity`
**Base:** `a752a54` (built-unreviewed Order225)
**Risk tier:** 2 — UI-only composition of existing authoritative reads
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

A due-in reservation blocked by exact server-owned `room_condition_missing` or
`room_not_ready` truth can review the assigned room in the existing Housekeeping
workspace and return to the same authoritative check-in preparation journey.

## Fixed contract

- Only exact current readiness blockers `room_condition_missing` or `room_not_ready`
  may expose **Review room in Housekeeping**. Every other blocker and ready state emit
  no action.
- The action requires the same current due-in reservation, exact property, canonical
  reservation path and check-in workbench query, connected action and current detail
  plus readiness generations. Every mismatch is inert.
- Opening reuses only the existing `/p/{property}/housekeeping` route, condition-board
  GET and current room truth. A minimized frozen descriptor retains property,
  reservation, confirmation, exact blocker, nullable assigned room/condition, origin
  path and current generations; no new request or server payload is admitted.
- Housekeeping may select only the exact recorded condition and focus an exact matching
  assigned-space card when authoritative room truth contains it, otherwise the safe
  room-condition heading. No task, occupancy or readiness meaning is inferred.
- Contextual **Back to arrival**, Escape and browser Back return through the canonical
  reservation detail with `?workbench=check-in`, refetch reservation and readiness
  truth, and restore exact action or safe check-in heading focus. Refresh and Forward
  reconstruct the same journey. Direct Housekeeping remains unchanged.
- Navigation is read-only: no POST/PUT/PATCH/DELETE, polling, browser storage,
  optimistic room truth, check-in command, task transition or authority change.
- Controls remain semantic, at least 44px (Android 48px), and work across all six
  appearances, 375px/200% zoom, visible focus, forced colours and reduced motion.

## Exact scope

- this order and its intentional-red/focused navigation/UI tests;
- `src/http/operator/operator.js`, `src/http/operator/index.html` only if a static
  contextual control is required, and focused `operator.css` styles;
- only truly superseded check-in/Housekeeping navigation expectations;
- continuity notes in `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No API/adapter/domain/context, contract/security, permission, schema/migration/seed,
dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** exact open/return/currentness helpers and contextual classes are absent.
- **P1 admission:** only the two exact room-readiness blockers emit the action.
- **P2 containment:** property/reservation/status/blocker/path/view/workbench/detail-
  generation/readiness-generation/action/DOM mismatches are inert.
- **P3 history:** one entry; Back/Escape/Forward/refresh refetch and restore exact or
  safe focus.
- **P4 Housekeeping truth:** only recorded condition/space may be selected or focused;
  no task, occupancy or readiness inference.
- **P5 compatibility:** direct Housekeeping and existing check-in/condition-board
  behavior remain exact.
- **P6 authority:** existing GET transport only; no mutation, polling or storage.
- **P7 UX:** six appearances, 44/48px, 375px/200%, focus, forced colours and reduced motion.
- **P8 standing:** check-in/Housekeeping/navigation plus static/full gates remain green.

## Definition of done

- [x] Intentional red preceded implementation and failed on absent continuity hooks.
- [x] Only exact current room blockers open existing Housekeeping truth.
- [x] History, authoritative refetch, compatibility and focus containment are exact.
- [x] Focused and standing gates are green and the result is recorded built-unreviewed.

## Built-unreviewed evidence

- Focused Order226 plus check-in/Housekeeping/Order219/Order208/Order201/Order217/
  Order209 and reservation-workspace compatibility: 69 passed, 0 failed; 962
  assertions across 12 files.
- Standing suite: 620 passed, 629 environment-skipped, 0 failed; 6,834 assertions
  across 1,249 tests in 227 files.
- `bun run typecheck`, 82-file import boundaries, 23-package licence policy,
  `bun audit` (0 vulnerabilities), JavaScript syntax and `git diff --check` are green.
- The diff changes no TypeScript server/API/domain/database/schema/migration/seed/
  dependency authority, so inherited schema and referee evidence remains exact.
- Independent product review remains deferred under the founder's build-first direction.
