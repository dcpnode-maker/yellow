# Review 610 — reservation cancel, reinstate and no-show surface

## Status

Preflight complete — implementation has not started.

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
