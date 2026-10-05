# Order694 independent review — shared navigation and table affordances

Reviewer: order679_independent_review (did not implement). 25 September 2026.

## Source review

- Nested Housekeeping routes use the existing `operations` (Room status) and `housekeeping` (Cleaning & inspection) destinations. The dead Inventory top-level destination is absent. Front desk remains the backed operations alias. Current-route expansion now follows workspace changes; the mobile nested child selector has a specific 46px target rule. The quick dock has explicit labels/tooltips, safe-area offsets and disabled navigation while locked. I flagged and verified correction of its false Housekeeping `aria-current=page` state on Operations.
- Header sort/filter controls still call the existing query functions and label choices as loaded-row values; active sort priority/filter state is explicit. No new server query or permission was introduced.
- `CopyCellButton` writes only the caller's displayed cell string on explicit click, reports clipboard unavailability/denial without throwing, and stops click and keydown propagation so a copy action does not open the reservation row. Both the current and legacy movement-grid renderers pass the same guest/room/status/text value they visibly render. No hidden row fields are copied and no clipboard read occurs.

## Personally executed proof

- `bun test tests/order684-navigation-ribbon.test.ts tests/order686-reservation-navigation.test.ts tests/order694-navigation-table.test.ts`: **13 pass, 0 fail, 104 assertions**. The legacy SSR map-label assertion is now feature-flag-safe; it does not require the native map in an off-build.
- `bun run typecheck`: pass (server and frontend); `bun run boundaries`: pass, 208 TypeScript files.

## Post-mounted-review amendment

Astra/root mounted review found collapsed desktop rail duplication, Ask Yellow overlap on phone, parent-versus-child capsule confusion, and an inherited header-span padding that made the column trigger taller than its grid row. On the builder's frozen CSS snapshot I inspected: collapsed aside has zero width and is hidden while the separate quick dock remains; the active parent is neutral when expanded and the current child alone carries the white capsule; phone Ask Yellow is offset above the safe-area dock; first/last dock tooltips cannot extend past their edge; a higher-specificity rule restores the mobile dock's `display:flex`; header child spans reset inherited padding, and outer header cells use 2px vertical padding around a 36px desktop or 44px coarse-pointer trigger. This is source review of the fixes; root owns the final mounted recheck.

Personally reran the same three focused suites on that snapshot: **13 pass, 0 fail, 113 assertions**. Whole-repository `bun run typecheck` and `bun run boundaries` (208 files) passed again. No additional backend or permission change.

Root's final mounted header inspection still found 4.6px overflow from the higher-specificity generic row rule. I inspected root's final scoped correction in `reference-theme.css`: `.movement-grid-head.movement-grid-row > span[role="columnheader"]` now wins that cascade and applies 2px vertical padding, while the trigger is exactly 44px border-box; together they fit the 48px header. Personally reran Order684/686/694 tests on this final source: **13 pass, 0 fail, 115 assertions**; `bun run typecheck` and `bun run boundaries` (208 files) both pass. This is source/test approval of the root-owned correction; root is measuring the rebuilt UI separately.

Independent source/test review: **approved for scoped Order694 integration**. Root owns mounted desktop/phone dock, nested menu, header sorting/filtering, copy-click/denial and final public cutover QA; this review does not claim those browser checks were personally executed.
