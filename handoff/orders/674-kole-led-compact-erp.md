# Order 674 — Kole-led compact ERP interaction system

Status: DELIVERED — bounded shared UI slice on24September2026, after founder approval, executable/independent/browser verification. Receipt674-implemented-workspace-ui records exact behavior, source coverage, rollback and remaining gaps. No backend scope is implied by mockup approval.

## Destination
Extend accepted Property Setup / Business Mix / All theme, not a new app. Kole Jain's grouping, visual hierarchy, white selected capsule, continuity, disclosure and feedback concepts drive a compact professional ERP. Preserve existing commands, data authority, unsaved edits, authorization and recovery locks.

## Scope (actual serving source D:/Yellow/git-live-order611-source-v2)
- frontend/yellow/src/table-query.ts
- frontend/yellow/src/ui/TableControls.tsx
- frontend/yellow/src/ui/TableColumnMenu.tsx (new)
- frontend/yellow/src/ui/table-controls.css (new)
- frontend/yellow/src/ui/FolioStatementTable.tsx
- frontend/yellow/src/ui/BusinessMappings.tsx
- frontend/yellow/src/ui/business-mappings.css
- frontend/yellow/src/hotel-search.ts
- frontend/yellow/src/ui/HotelSearch.tsx
- frontend/yellow/src/ui/hotel-search.css
- frontend/yellow/src/ui/reference-theme.css
- frontend/yellow/src/ui/SegmentedRibbon.tsx
- frontend/yellow/src/ui/OperatorHeader.tsx (new), ui/OptionsDrawer.tsx, ui/RibbonPanel.tsx; frontend/yellow/src/styles.css (header/nav/movement containment only), frontend/yellow/src/today-workspace.ts (movement sort keys only), per Q674-approved-navigation-scope.
- frontend/yellow/src/App.tsx (active movement view, table controls and shared header/navigation composition only; never commented legacy duplicates)
- frontend/yellow/src/reservation-board.ts
- frontend/yellow/src/workspaces/TodayGlassDashboard.tsx
- frontend/yellow/src/workspaces/today-glass.css
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx (active movement UI only, Q674 parity admission)
- frontend/yellow/src/ui/MovementTableControls.tsx, frontend/yellow/src/movement-table-query.ts (shared adapters if needed)
- frontend/yellow/src/workspaces/OperationalHub.tsx, EcosystemHub.tsx, MarketIntelligenceLab.tsx (compact heading composition only)
- tests/order674-*.test.ts (new), relevant existing order668/671/673 table/search tests if expectations genuinely superseded
- tests/yellow-today-workspace.test.ts (supported-sort inventory expectation only, Q674-approved-navigation-scope)
- docs/design/KOLE-INTERACTION-SYSTEM.md (new)
- this order and serving-source pointer; handoff/reviews/674-*.md, handoff/receipts/674-*.md, handoff/LEDGER.md in coordination tree.

## Deliverables
1. Astra-defined reusable compact design rules grounded in public reference and accepted screens.
   Read and trace existing ecosystem relationships/journeys before finalizing navigation; record cross-module dependencies and working versus planned capabilities. After UI verification, continue the existing ecosystem roadmap through separate scoped orders.
2. Shared working header sort/filter menu, removable/reorderable custom levels. Remove arbitrary 3-sort/5-filter restriction; duplicate sort fields are not useful. Preserve exact bigint comparisons and fail-closed unsupported fields. Adopt folio, business mappings and movement views within the scope.
3. In-place arrivals/in-house/departures selection with stable shell, cached data, sensible keyboard/touch affordances and compact ribbon.
4. Compact universal-search metadata and destination/module disambiguation over existing authorized data only. Do not claim every module is indexed or room history is complete.
5. Focused executable proof, independent non-implementer review of integration, desktop/mobile browser verification, and update the single existing review app only after green gates.

## Exclusions and safety
No schema/backend/financial writes, APIs, new provider, installation, subscription, newsletter enrollment, credentials, spending, new runtime or source rewrite. No copying inaccessible source or bypassing resource gates. No bulk git staging or destructive cleanup of the dirty tree. Serving app remains yellow-public-demo-app-1 on3010. Preserve previous image as rollback. No performance SLA, entire-app completion, Git publication or production claim without proof.

## Evidence
Session state.ps1 points to historical September13 Phase7 orders/default Compose project; receipt673 and actual yellow-public-demo runtime identify serving source. Existing table-query.ts caps five filters/three sorts. These limits are superseded by this founder request.

Acceptance: pure query/search tests, root/frontend type checks, boundaries, Vite build; real header filter/sort interaction and 4+ sort levels; in-place movements; search metadata;375px containment, reduced motion, no relevant console errors. Independent review executes tests itself. Record exact limitations; one live cutover with rollback.

## Historical mockup-first checkpoint (superseded by implementation receipt)
Three GPT-6 Astra agents were actually used: kole_design_lead (ecosystem/design/movement audit), kole_table_controls (draft shared primitives), kole_search_context (draft search metadata). No claim that the calling task's model changed.

Generated review-only desktop and mobile images are recorded in receipt674. Not accepted visual specs yet; illustrative sample data, not implemented or verified capability. Preserve current live deployment673.

Drafts already saved, UNVERIFIED: table-query.ts, TableControls.tsx, TableColumnMenu.tsx, table-controls.css; hotel-search.ts and HotelSearch.tsx. No Folio/BusinessMappings integration. Search stylesheet unchanged. No types/tests run for those drafts. tests/order674-movement.test.ts is an intentional RED scaffold importing a not-yet-created movement-table-query module; do not count it as green or deploy the working tree without finishing/removing the scaffold by an explicit follow-on decision. No agent committed or deployed.

## Approved implementation checkpoint
Founder accepted exec-2e613d3c-997a-44fa-b3f2-48da93494e6a.png as visual direction and requests collapsible navigation, expanding food-menu-style ribbon, drawer/slide menu and transitions. Preserve all current live data and commands; no sample mockup values may substitute for missing bindings. Root owns shared shell/ribbon and research; design lead owns both active movement grids and movement helpers; table-controls agent owns shared query/menus, FolioStatementTable and BusinessMappings; search agent owns search only. Scope additions require a recorded question before edits. No whole-ecosystem or all-resource completion claim from this slice.
