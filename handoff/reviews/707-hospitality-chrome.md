# Order707 independent source and executable review

2026-09-25 — `/root/movement_hover_review`, non-implementing reviewer. **Approved for the bounded source change, with rendered/live acceptance remaining coordinator-owned.** I read the order and inspected the final240px source, accessible markup, CSS selector interactions and existing dock contract. I edited only this review record; no implementation/test edit, browser operation, deployment or hotel-data action was performed.

## Inspection

The final mobile drawer stays on the left at240px with `max-width: calc(100vw - 32px)`, border-box sizing, smaller wrapper/group spacing,14px labels and18px icons. Mobile parent/child navigation, property choices and close control retain at least44px targets. The mobile navigation selectors have equal specificity and later source order than their desktop counterparts; nested-child and selected-state selectors remain compatible. Existing scrolling, hidden nested groups, dialog/inert/focus behavior and reduced motion are retained.

The actual icon dock continues through the separate `WorkspaceDock` component and `.operator-workspace-dock[data-placement="left"|"bottom"]` rules. The new sidebar icon sizing is scoped beneath `.operator-navigation` and does not match the dock. Existing dock placement, drag threshold, cancellation, keyboard alternative and storage behavior remain covered by the personally executed Order703 proof. No expanded-sidebar repositioning capability is introduced or approved.

The three hospitality SVGs have distinct door/arrow/occupied-bed shapes, currentColor strokes and `aria-hidden`/nonfocusable decoration. Visible movement labels and existing accessible button names still carry meaning. App movement definitions retain the same three navigation callbacks. The existing706 pill transform, pointer/focus feedback and click path survive the focused regression suite.

Header cell styling now targets direct-child spans, avoiding inherited cell padding on nested sort/filter indicators. The new sort arrow SVG, priority, filter count and chevron remain inside one native trigger; accessible names retain direction/priority/filter count and disabled semantics. The existing query helpers, menu portal, apply/clear callbacks and copy controls remain. The inherited desktop header44px rules in reference-theme.css are not a707 edit: an initial scope concern was resolved by the coordinator identifying those pre-existing rules and distinguishing the cumulative dirty-tree diff from this order's changes. New header presentation is in table-controls.css/styles.css and TableColumnMenu markup. No blocking source finding remains.

## Reviewer-personal execution

From `D:/Yellow/git-live-order611-source-v2`:

```text
bun test tests/order707-hospitality-chrome.test.tsx tests/order707-mobile-navigation.test.ts tests/order694-navigation-table.test.ts tests/order702-ribbon-hover.test.tsx tests/order706-today-pill.test.tsx
18 pass; 0 fail; 173 expect() calls; 5 files; exit0

bun run typecheck
tsc --noEmit && tsc --noEmit -p frontend/yellow/tsconfig.json
exit0

bun run boundaries
Import boundaries OK: 208 TypeScript files scanned; exit0

# Final240px source plus the existing dock regression suite:
bun test tests/order707-hospitality-chrome.test.tsx tests/order707-mobile-navigation.test.ts tests/order694-navigation-table.test.ts tests/order702-ribbon-hover.test.tsx tests/order706-today-pill.test.tsx tests/order703-workspace-dock.test.tsx
26 pass; 0 fail; 247 expect() calls; 6 files; exit0
```

Final reviewed SHA256 identities:

| File | SHA256 |
| --- | --- |
| `frontend/yellow/src/ui/HospitalityIcon.tsx` | `ADAAFC0C16994AAD7D04F19FF69BE479E229F30E24AFC3FECC15A5A03B4B1E75` |
| `frontend/yellow/src/App.tsx` | `E96D98D1D8747AFE4219EC4F1CA8DB65ECD751A13CCD039AB2E2850AC00ECAB2` |
| `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx` | `A31C94BDC6EDAF0E7FFEF693A4E0646B23A14B74A48E37B82EECF08309E4A8C9` |
| `frontend/yellow/src/styles.css` | `D9B0BCA8B071BA67CCF03B509EFD873F6790B33B393E84BCC95D6887BC367DD1` |
| `frontend/yellow/src/ui/TableColumnMenu.tsx` | `4D72B216656FBF2C1B0A4E072CE88A83FD001A3A2C5074455A83BACA06F3C8B4` |
| `frontend/yellow/src/ui/table-controls.css` | `E40E2534F11BFFF92A46C187AEC7D42666B623D04D4FB5C0A96791789CC9BF99` |
| `frontend/yellow/src/ui/reference-theme.css` | `FFF2577865701A4ADA3D31686536E194B2A0388EC147D9E6EA27AC380C696F59` |

## Evidence limits

The tests execute pure behavior, SSR and source assertions; they do not compute browser layout or prove real pointer/keyboard journeys. The width checks are source/formula checks, not rendered320px/390px measurements. The dock suite exercises the controller but does not establish physical phone drag behavior. I did not personally execute a build, live health checks or a database-ledger comparison.

Coordinator acceptance must cover rendered desktop/390px/320px drawer containment and navigation, icon legibility, existing left/bottom dock behavior, Today hover, and table header sort/filter open/apply/clear plus keyboard/disabled states. Native phone hardware remains unverified without access. This approval does not claim live release completion, full application completion or a clean-Git/CI release.
