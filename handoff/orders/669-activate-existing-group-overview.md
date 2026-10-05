# Order 669 - Expose the existing group-block overview

2026-09-24. COMPLETE for read-only beta; receipt669 records proof and limits.
Owner: Codex. Founder requested continuation and activation
of built features. Read-only browser evidence confirms that the single serving
reservation board already renders two group blocks, room-type/day allotments,
pickup totals and linked rooming-list reservations. Surface that existing capability
in the ecosystem without claiming group sales/editing/contracts are complete.

## Exact scope

Source `D:/Yellow/git-live-order611-source-v2`:
- `frontend/yellow/src/ecosystem/capability-registry.ts`: add one beta read-only
  `groups-events.block-overview` capability; preserve existing group-sales entry.
- `frontend/yellow/src/workspaces/EcosystemHub.tsx`: map that key to reservations.
- `tests/order669-group-overview-activation.test.ts`: route and honest boundary proof.
- Generated `public/yellow-next` assets and this order's source pointer.
Coordination: this order, `handoff/receipts/669-group-overview-activation.md` and
`docs/FEATURE-ACTIVATION.md`.

No backend, policy, group/allotment mutation, new schema or data edits. Preserve
all pre-existing work. Can share the frontend deployment with 668 after checks.

## Acceptance

Ecosystem beta card opens the existing reservation board with group/allotment and
pickup data; one linked reservation opens correctly. Full group-sales/contracts
remain visibly unimplemented. Focused tests, typechecks, independent read-only
review and browser proof. One existing app, no additional app instance.
