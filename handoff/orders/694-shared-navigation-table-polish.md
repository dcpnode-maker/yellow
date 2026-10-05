# Order694 — shared nested navigation and table affordances

25 September2026. IMPLEMENTING. Founder asks vertical nested ribbon, clearer
header filter/sort, copyable table cells. Reuse approved Kole-informed neutral
design and known backed destinations; no new backend, permissions or tasks.

Builder reservation_workspace_research; root owns copy-cell integrations only;
order679_independent_review independently verifies. No other agent touches692
grid code while builder692 is active; root coordinates integration afterward.

## Scope

- frontend/yellow/src/ui/OperatorHeader.tsx; ui/reference-theme.css: reuse nested
  Reservations container style for Housekeeping with Room status (operations)
  and Cleaning & inspection (housekeeping). Remove broken inventory destination
  from top-level navigation. Keep existing Front desk entry; it is a contextual
  alias for the same operational board, not a new CRM. Retain all route locks,
  focus trap, keyboard controls, expanded/current states and reduced motion.
- Founder follow-up: when vertical ribbon is collapsed, render a compact bottom
  dock for existing Today / Reservations / Housekeeping / Cashier / All navigation.
  Reuse same guarded callbacks; visible custom tooltips on hover and keyboard
  focus, aria labels for all icon controls, >=44px touch targets, safe-area-aware
  positioning and enough page bottom padding. Full menu remains reachable; no
  fake macOS magnification or hover-only essential navigation. Existing department
  parent+child surfaces must be neutral capsule tracks rather than flat links.
- frontend/yellow/src/ui/TableColumnMenu.tsx; ui/table-controls.css: refined
  consistent sort/filter glyphs, active indicators and keyboard target states;
  retain actual query semantics, loaded-row caveat and multilevel controls.
- frontend/yellow/src/ui/CopyCellButton.tsx and cell-copy.ts: explicit user-click
  copy of visible cell display text only; accessible icon/label, honest copied/
  failed status, no hidden data/automatic clipboard access or permission prompt.
- Root-only integrations: frontend/yellow/src/App.tsx and workspaces/ReservationWorkspace.tsx
  MovementGrid data cell renderer, preserving existing content/actions and
  stopping copy click from opening the row. Coordinate after692 releases grid.
- tests/order694-navigation-table.test.ts; tests/order684-navigation-ribbon.test.ts;
  tests/order686-reservation-navigation.test.ts for intentional label assertions only.
- Founder clarification admitted after initial order: `tests/order684-navigation-ribbon.test.ts`
  must also replace its now-obsolete collapsed-icon-rail CSS oracle with an assertion
  that collapsed desktop navigation is inert/hidden and reclaims the former 68px rail
  for the bottom-dock layout. This is the explicit behavior change, not a silent scope
  expansion.
- This order, reviews/694-navigation-table.md, receipts/694-navigation-table.md,
  handoff/LEDGER.md, docs/PROJECT-STATUS.md, generated public/yellow-next/**.

No fake CRM requests destination: general service tracking remains separately
unfinished. Acceptance requires mobile/desktop nested menu, collapse/current
state/navigation, header menu sorting/filtering, explicit copy without row-open,
clipboard-denial feedback, full typecheck and focused regressions. Root deploys
once with692/693 to the sole app, native map retained, exact rollback.
