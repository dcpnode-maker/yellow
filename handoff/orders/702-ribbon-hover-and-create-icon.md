# Order702 — movement hover preview and compact creation control

Founder25September requests Today Arrival/In house/Departure wrapper to follow
hover and compact meaningful creation icon beside reservation ribbon. Extend
approved neutral capsule system; no new visual theme or dependencies.

Scope: frontend/yellow/src/ui/SegmentedRibbon.tsx;
frontend/yellow/src/ui/movement-ribbon.css;
frontend/yellow/src/workspaces/TodayGlassDashboard.tsx (movement preview only);
frontend/yellow/src/workspaces/ReservationWorkspace.tsx (creation button only);
frontend/yellow/src/workspaces/reservation-journey.css (creation button only);
tests/order702-ribbon-hover.test.tsx; tests/order696-movement-ribbon.test.ts;
tests/order700-compact-shell.test.ts (obsolete exact label/size oracles only);
this order, handoff/receipts/702-ribbon-hover.md,
handoff/reviews/702-ribbon-hover.md; root status/ledger/requirement register;
public/yellow-next/** root generated release only.

Hover/focus visually previews capsule without changing selected lane, aria-selected,
URL, counts or fetching another table. Leave restores selected capsule; touch tap
and keyboard selection remain. Clear transient preview on collapse/selection/item
removal. Preserve layout-offset geometry, reduced motion and mobile44px sizing.
Create reservation uses recognizable calendar-plus SVG, accessible name and visible
hover/focus/touch help, stays within family container; click uses existing guarded
creation path. No reservation/API/database mutation implementation changed.

Write focused interaction tests, run adjacent tests/types/boundaries, independent
source/executable review and root actual hover/leave/click/keyboard/phone proof.
Combine with703 only after verified, app-only static deployment retaining7c28921
rollback. No whole-ecosystem completion or new guest creation proof claim.
