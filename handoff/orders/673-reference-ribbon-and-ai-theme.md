# Order 673 — Reference ribbon and shared AI-aware theme

Status: DELIVERED — 2026-09-24. Scoped shared theme/ribbon update reviewed, checked in browser and deployed to the single existing review app. Exact frame-for-frame video reproduction and every bespoke legacy control are not claimed.

## Intent and reference limits
Apply the supplied neutral white/grey theme across the existing operator app. Reproduce the photographed compact label, expanding rounded ribbon, white moving selection and soft dissolve. Preserve two restrained backing cards where already opted in. Extend the existing AI-mode styling across common app surfaces without changing commands or inventing AI capability. Founder supplied https://www.youtube.com/watch?v=EcbgbKtOELY during implementation. Read its exported auto-generated English transcript in full and visually inspected the grouping/white capsule at 0:15 and 0:20. The 0:08–0:42 section establishes grouping, selected versus inactive states and interaction feedback; later sections cover hierarchy, whitespace, typography, color, shadows and feedback. Exact frame-by-frame timing is not asserted from still-frame inspection.

## Exact scope
Serving source D:/Yellow/git-live-order611-source-v2:
- frontend/yellow/src/ui/SegmentedRibbon.tsx
- frontend/yellow/src/ui/RibbonPanel.tsx
- frontend/yellow/src/ui/reference-theme.css
- frontend/yellow/src/main.tsx
- frontend/yellow/src/styles.css (only existing ribbon/AI selectors if needed for compatibility)
- frontend/yellow/src/workspaces/OperationalHub.tsx
- frontend/yellow/src/workspaces/EcosystemHub.tsx
- frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx
- frontend/yellow/src/App.tsx (only shared ribbon adoption in PropertySettingsWorkspace and visual AI-state classification)
- tests/order673-*.test.ts
- tests/yellow-shared-ribbon-depth.test.ts (update superseded visual expectations only)
- handoff/orders/673-reference-ribbon-and-ai-theme.md (pointer)
- public/yellow-next/** (normal Vite output)
Coordination: this order, handoff/reviews/673-reference-ribbon-and-ai-theme.md, handoff/receipts/673-reference-ribbon-and-ai-theme.md, append-only handoff/LEDGER.md.

## Boundaries
Presentation only. No financial/domain state transitions, backend/schema/data, permission, provider, model or worker changes. No speculative Rust/Go/vector rewrite. Never remount a form just to animate it; preserve dirty-state confirmation and uncertainty/recovery guards. Do not expand search capability or imply all table grouping/filter requirements are complete. Existing CSS color-status semantics, focus visibility and exact values remain. No duplicate app or unrelated Git cleanup.

## Acceptance and proof
Shared ribbons support compact/expanded navigation, moving white pill, immediate interaction, keyboard arrows/Home/End, 44px targets and local overflow. Content dissolve does not clone interactive content or reset form state. Shared neutral surfaces replace ambient yellow in normal mode; AI mode adds ambient surface/edge color while preserving readable content. Continuous motion is limited to actual listening/processing; ready/result states are static. Reduced motion and forced colors disable decorative motion/glow. Inspect desktop and mobile/landscape, settings unsaved-edit guard, operations/ecosystem, current Today/finance theme, and AI open/close plus a read-only command. Execute targeted regressions, frontend/root typechecks, boundary check and build. Independent reviewer executes focused proof. Publish only existing yellow-public-demo app, retain rollback, record observed result and gaps.
