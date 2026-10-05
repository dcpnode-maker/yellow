# Order696 independent review — guest movement selector

Reviewer: order679_independent_review (did not implement). 25 September 2026.

The scoped change measures the selected tab using `offsetTop`, `offsetLeft`, `offsetWidth` and `offsetHeight` relative to the positioned ribbon rail. This avoids transformed screen rectangles and rail-border drift. A `ResizeObserver` updates on layout changes; the existing Arrow/Home/End selection and focus behavior remains. The movement-only phone rule gives all three tabs flexible widths and at least 44px height without changing query/API state.

Personally ran `bun test tests/order673-ribbon.test.ts tests/order696-movement-ribbon.test.ts`: **6 pass, 0 fail, 45 assertions**. Personally ran frontend TypeScript check (`bunx tsc --noEmit -p frontend/yellow/tsconfig.json`), whole-repository `bun run typecheck`, and `bun run boundaries` (208 files): pass.

Independent source/test review: **approved for scoped Order696 integration**, conditional on root's mounted desktop/phone capsule-bounds and all-three-tab QA. No live-query failure was established; this is a presentation repair, not a data/API correction.
