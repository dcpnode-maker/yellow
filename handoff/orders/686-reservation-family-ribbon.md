# Order686 — one Reservations family

IMPLEMENTING — founder priority 24 September2026. Coordinator owns integration.

Use the already-approved gray/white Kole-informed ribbon design, not a new theme.
Reservations is a collapsible parent with Individual / Groups / Calendar children.
Selection stays in one SPA work area and is reflected in the URL/back history.
Keep the universal search, contextual reservation table and pending-command guards.
Compact search/filter/sort/column controls; one editor at a time, active indicators,
unlimited supported user-added rule levels, accessible labelled icons and column
menus. Do not fake a group creation action; order687 owns that command/workspace.

Exact scope: frontend/yellow/src/ui/OperatorHeader.tsx, frontend/yellow/src/ui/reference-theme.css,
frontend/yellow/src/workspaces/ReservationWorkspace.tsx (board view composition
and tool presentation only), existing shared table controls and their styles
(name exact paths in an amendment before editing), new reservation-navigation.ts,
tests/order686-reservation-navigation.test.ts, docs/design/KOLE-INTERACTION-SYSTEM.md,
this order and receipt/review686, handoff/LEDGER.md, docs/PROJECT-STATUS.md.
App.tsx routing integration is root-owned and must be explicitly coordinated.

No backend, DB, permissions, group mutation or reservation lifecycle changes.
Preserve dirty tree. Main acceptance: expanded/collapsed rail, same-page sibling
selection, deep-link/back, desktop/mobile keyboard/focus, advanced table controls
and zero loss of existing reservation actions. Existing images are the design
spec; this is a scoped correction inside that design system, not fresh concepting.

## Exact shared-control and route amendment after audit

Worker scope also includes frontend/yellow/src/ui/{MovementTableControls.tsx,
TableControls.tsx,table-controls.css}, tests/order684-navigation-ribbon.test.ts
and tests/reservation-workspace-routing.test.ts. Do not change query semantics:
consolidate Filter/Sort/Columns with Stay criteria inside Filter and preserve
existing per-column actions, arbitrary supported filter levels and ordered sorts.
One disclosure/editor visible at a time, active count and clear/reset available.
Root owns only the App.tsx workflow route patch (reservations:list|groups|calendar);
send the exact patch to root. Retain concise inner ribbon for orientation and
mobile; align labels Individual / Groups / Calendar with the left-menu children.
Changing sibling views cannot silently drop an active new-reservation draft or
unresolved mutation. Keep recovery guard and give a clear return-to-draft path.

The repository's existing shell stylesheet is `frontend/yellow/src/ui/reference-theme.css`
(not `frontend/yellow/src/reference-theme.css`); shared controls are the three
`frontend/yellow/src/ui/{MovementTableControls.tsx,TableControls.tsx,table-controls.css}`
paths listed in the exact shared-control amendment above.

Browser QA admission: tests/fixtures/order685/server.ts may return synthetic empty
group list and valid empty room-calendar responses for the integrated built UI.
No writes, production forwarding or browser test data persisted to live Yellow.
