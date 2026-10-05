# Order 684 — Unified collapsible vertical navigation ribbon

DELIVERED BOUNDED RIBBON — 2026-09-24; see receipt684. Founder reiterates food-menu-style collapsible sidebar, icon
control and a thin vertical divider. The rail must visually belong to the same
application canvas, not a separate floating card/panel. Existing routes and labels
remain functional. Reservation defect683 remains release priority.

## Exact scope

- `frontend/yellow/src/ui/OperatorHeader.tsx`
- `frontend/yellow/src/ui/reference-theme.css`
- `frontend/yellow/src/styles.css` only existing shell/nav rules if necessary
- `tests/order684-navigation-ribbon.test.ts`
- This order, `handoff/receipts/684-navigation-ribbon.md`,
  `handoff/reviews/684-navigation-ribbon-independent.md`, ledger/project-status
- generated frontend assets under coordinated build/release681/683 only

Keep desktop a collapsible vertical icon ribbon with expanded labels and section
groups, same background/surface, subtle dividing line, clear selected state and
short reduce-motion-aware transitions. Preserve mobile usable drawer/rail behavior,
44px touch controls, accessible names/expanded state/focus, shared universal search
and no viewport overflow. Do not redesign modules, add dependencies, alter hotel
permissions, change routes or remove departments. Actual desktop/mobile browser
proof and scoped tests/typecheck before promotion. No simultaneous root/agent
editing of shared source sections; coordinate with681/683.
