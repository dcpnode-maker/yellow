# Review 610 — reservation cancel, reinstate and no-show surface

## Status

Built by `/root` — pending independent non-implementer transition proof.

## Source authority

`D:\Yellow\temp\order610-reservation-transitions-source` is a mechanical copy of
the independently accepted Order609 candidate. Order609 R2 personally passed the exact
focused suite (37/0/152), root and frontend TypeScript, 203-file boundaries, actual React
Chrome at 240/375/1440, external Vite build, and retained-public zero drift.

## Verified command and state authority

- `POST /api/v1/properties/:property/reservations/:reservation/cancel` and
  `ReservationLifecycleService.cancel` are the only operator cancellation authority.
- `POST /api/v1/properties/:property/reservations/:reservation/reinstate` and
  `ReservationLifecycleService.reinstate` are the only operator reinstatement authority.
- `no_show` is a canonical reservation state and may be reinstated through the existing
  command.
- There is **no operator mark-no-show command**. The state machine admits
  `due_in -> no_show` only for `arrival_day_roll_completed`. Order610 therefore must
  show a no-show action as unsupported/disabled and non-mutating; it may not synthesize
  that transition through PATCH, cancellation, direct SQL or a browser state table.
- Existing detail actions already expose cancel for `reserved|due_in` and reinstate for
  `cancelled|no_show`, but they do not yet provide one complete authoritative action
  matrix, reason/consequence proposal, mounted Overwatch parity, hostile receipt checks,
  or actual-app browser proof.

## Frozen closed file list

No product edit may begin until this list is treated as the complete writer scope.
A required file outside it stops into `handoff/questions/`.

1. `frontend/yellow/src/App.tsx`
2. `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
3. `frontend/yellow/src/yellow-api.tsx`
4. `frontend/yellow/src/voice.ts`
5. `frontend/yellow/src/styles.css`
6. `src/overwatch/index.ts`
7. `tests/yellow-reservation-lifecycle-actions.test.ts`
8. `tests/jarvis.test.ts`
9. `tests/order610-reservation-transitions.test.ts` (new)
10. `tests/order610-reservation-transitions.browser.test.ts` (new)
11. `handoff/orders/610-reservation-cancel-reinstate-no-show-surface.md`
12. `handoff/reviews/610-reservation-cancel-reinstate-no-show-surface.md`

Generated public assets remain byte-identical to the accepted release and are built only
to an external temporary directory for this order. Order614 owns coherent release asset
generation and public promotion.

## Required proof

- executable state/action evidence for every displayed status, with no client-created
  permission to transition;
- required bounded cancellation reason, explicit consequence, separate finite consent,
  preflight drift invalidation, stable same-key retry, malformed/hostile receipt failure,
  and matching authoritative reread;
- manual and Overwatch surfaces share the same operation lock and typed canonical API;
- mounted `createApp` proof keeps guidance zero-write and invokes only the existing cancel
  or reinstate routes; no mark-no-show request exists;
- actual built React route in Chrome at 240/375/1440 proves containment, touch usability,
  disabled illegal/unsupported actions and zero mutation before explicit confirmation;
- root/frontend TypeScript, boundaries and external Vite build;
- independent non-implementing reviewer personally executes the transition proof.

## Builder evidence

### Implemented surface

- The real reservation workspace now renders one governed lifecycle action card with
  three explicit choices: cancel, reinstate and mark no-show.
- Cancel and reinstate availability comes only from `detail.data.actions.canCancel`
  and `detail.data.actions.canReinstate`.
- Mark no-show is deliberately disabled/non-mutating because no operator no-show
  command exists; the copy names property day-roll as the server authority.
- Manual and Overwatch routing share the real `ReservationWorkspace`, operation lock
  and typed canonical API client.
- Cancel captures a bounded reason, separate checkbox confirmation, a pre-write
  authoritative reread, stable idempotency key, typed canonical receipt validation and
  post-write authoritative reread.
- Reinstate uses the same confirmation/reread/key/receipt/reread pattern.
- Deterministic 4xx lifecycle failures stay rejected; network, 5xx and malformed 2xx
  outcomes are treated as uncertain and reconcile only by authoritative refreshed
  reservation state.

### Commands personally run by implementer

1. `bun test tests/order610-reservation-transitions.browser.test.ts`
   - **PASS** — 1/0, 45 assertions.
   - Actual Vite build inside the test; Chrome/Edge CDP proof at 240, 375 and 1440
     CSS px.
   - Proves cancel has zero mutation before reason plus checkbox confirmation, exactly
     one canonical `/cancel` POST after confirmation, stable `yellow-reservation-lifecycle-*`
     idempotency key, preflight drift blocks with zero POST, reinstate has exactly one
     canonical `/reinstate` POST after confirmation, no invented `/no-show` request,
     three action cards, disabled no-show, viewport containment and screenshot bytes.

2. `bun test tests/order610-reservation-transitions.test.ts tests/order610-reservation-transitions.browser.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/jarvis.test.ts`
   - **PASS** — 36/0, 188 assertions.
   - Covers typed action evidence, hostile receipts, replay evidence, uncertain
     outcomes, lifecycle voice routing, mounted Overwatch zero-write guidance,
     canonical cancel/reinstate route delegation and invented no-show 404.

3. `bun run typecheck`
   - **PASS** — strict TypeScript.

4. `bun run boundaries`
   - **PASS** — `Import boundaries OK: 203 TypeScript files scanned`.

5. `bunx vite build --config frontend/yellow/vite.config.ts --outDir C:\Users\astha\AppData\Local\Temp\yellow-order610-build-e6da6334cc1a4b3eb946ae450121b36c --emptyOutDir`
   - **PASS** — 484 modules transformed; production artifacts written outside the
     repository/generated public tree.

### Builder notes

- Browser plugin was not available in this Codex session, so the browser proof uses
  the existing repository CDP/Chrome pattern in a committed Order610 test.
- The proof serves built React from a temporary directory and injects a deterministic
  in-page API. No Docker, database, public tunnel, migration, seed, schema, backend
  command or domain transition file was changed.
- Generated public assets remain outside this order; Order614 owns coherent public
  release promotion.

## Independent non-implementer review — 2026-09-23 09:36 +05:30

Reviewer: `/root/order610_independent_review` (non-implementer).

Disposition: **accepted** for Order610's high-risk reservation state-transition
surface proof.

I personally read `PROJECT.md`, `AGENTS.md`, this order and this review record before
running proof. `bash ./state.sh` could not execute in this Windows review shell because
WSL `/bin/bash` is unavailable, so I ran the project PowerShell equivalent:
`powershell -ExecutionPolicy Bypass -File .\state.ps1`. It reported this source tree
clean, services down, phase 7 active, and the expected referee command as
`.\setup.ps1 -DbOnly -> 11 passed, 0 failed of 11`. This source copy is not a Git
checkout (`git status --short` and `git log --oneline -10` both returned
`fatal: not a git repository`), and there is no root `DECISIONS.log` in this copy, so
diff/decision-log inspection was replaced by direct file/text inspection.

Commands personally executed:

1. `bun test tests/order610-reservation-transitions.test.ts tests/order610-reservation-transitions.browser.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/jarvis.test.ts`
   - **PASS** — 36/0, 188 assertions.
   - Includes the actual built React browser proof at 240, 375 and 1440 CSS px.
   - Covers authoritative action evidence, bounded reason and confirmation, drift
     invalidation, replay/uncertain recovery, hostile/malformed receipts, Overwatch
     mounted zero-write guidance, canonical cancel/reinstate route delegation and the
     invented no-show endpoint returning non-authority.

2. `bun run typecheck`
   - **PASS** — strict TypeScript via `tsc --noEmit`.

3. `bun run boundaries`
   - **PASS** — `Import boundaries OK: 203 TypeScript files scanned`.

4. `bunx vite build --config frontend/yellow/vite.config.ts --outDir C:\Users\astha\AppData\Local\Temp\yellow-order610-review-build-055d2ab810844ef9ac1e46fe5a369f2e --emptyOutDir`
   - **PASS** — 484 modules transformed; production build written outside the
     repository/public runtime tree.

Direct boundary inspection:

- `rg` inspection of `src`, `frontend/yellow/src`, `tests`, the order and review found
  the existing canonical reservation lifecycle HTTP routes only at
  `/api/v1/properties/:property/reservations/:reservation/cancel` and
  `/api/v1/properties/:property/reservations/:reservation/reinstate`.
- No product operator `/no-show`, `/no_show`, mark-no-show mutation endpoint or
  synthesized no-show API route was found. The only `/no-show` request found is the
  negative Order610 test assertion.
- Existing backend authority remains in `ReservationLifecycleService.cancel` and
  `ReservationLifecycleService.reinstate`; existing state-machine text still identifies
  `due_in -> no_show` as `arrival_day_roll_completed`, with reinstatement from
  `cancelled/no_show` through availability recheck.
- Product no-show UI/voice/Overwatch references resolve to the reservation workspace
  as disabled/non-mutating guidance; manual and Overwatch paths share the typed
  canonical cancel/reinstate client boundary and operation lock exercised by the tests.

Why this satisfies the high-risk proof: Order610 is a state-transition surface over
existing reservation lifecycle authority. The executed focused suite proves the UI and
Overwatch surfaces do not mutate before explicit confirmation, use only canonical
cancel/reinstate routes after authoritative reread and stable idempotency, fail closed
on drift and malformed receipts, refresh to matching authoritative state after success,
and leave no-show disabled because the backend has no operator command. The static
gates prove the TypeScript/import-boundary shape, and the external Vite build proves
the route compiles without promoting generated public runtime assets. With the direct
source search finding no invented no-show endpoint and no new backend command/schema
surface, I find no blocker for the bounded Order610 scope.
