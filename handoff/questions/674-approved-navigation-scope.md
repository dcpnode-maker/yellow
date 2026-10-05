# Q674 — approved navigation implementation scope

24September2026. Founder approved the concept then explicitly requested collapsible menus, food-menu-style expansion, drawers and transitions. Existing674 scope omits shared drawer/shell files and one movement-sort helper.

Resolved by primary coordination owner before code changes under D91: admit `frontend/yellow/src/ui/OperatorHeader.tsx` (new), `ui/OptionsDrawer.tsx`, `ui/RibbonPanel.tsx`, `styles.css` (only operator-header/nav/movement containment), `today-workspace.ts` (movement sort keys only), and App.tsx shared-header composition. No business commands or financial/tenant authority changes. Root owns header/ribbon/drawer/CSS; design agent owns today-workspace.ts and active movement integration. Preserve existing guarded navigation callbacks. New shell must support keyboard, Escape, focus return, mobile off-canvas modality, reduced motion and unchanged commands. No new dependencies. Existing current branch is retained to avoid disrupting the dirty shared integration tree; no commit/PR/merge in this unverified slice.

Missing rate-code/class/meal-plan backend projections remain a separate explicit follow-on, not admitted here.

Before proof repair: admit the exact supported-sort inventory assertion in `tests/yellow-today-workspace.test.ts` to list the six approved additional keys. Existing behavioral assertions remain unchanged. The old nine-key tuple also causes the root typecheck failure; this is an expectation update for an intentionally expanded read-only UI contract, not test weakening.
