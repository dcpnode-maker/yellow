# Order 600 — Operator interface runtime regression repair

## Objective

Restore the accepted native interface gallery, projected-depth controls, compact
mobile navigation disclosure, and compositor-safe flagship motion that are currently
masked or overridden in the classic operator runtime.

## Scope

- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-flagship-motion.test.ts`
- `tests/operator-layout-composition.test.ts`
- `tests/operator-workspace-layout.browser.test.ts`

## Required behavior

1. The interface gallery, skin and motion controls remain available with measurable
   geometry and preserve the eight accepted interface choices and spatial-depth
   presentation from D-1446 through D-1449.
2. Desktop navigation is revealed by default; compact/mobile navigation initializes,
   resets, and responds to media changes as a closed disclosure until the operator
   opens it.
3. No broad CSS hiding override may suppress the gallery or its controls.
4. Flagship ambient motion uses compositor-safe opacity/transform behavior only; no
   `filter` keyframe animation remains, including in currently hidden decorative
   elements.
5. Reduced-motion and forced-colors behavior remains deterministic and accessible.
6. Existing routes, controls, permissions, drafts, guarded mutations, and hotel
   workflow composition remain unchanged.

## Acceptance evidence

- The three focused source suites pass.
- The repository Chromium/CDP browser proof passes at desktop and compact/mobile
  widths under normal and reduced motion.
- Strict TypeScript, import boundaries, and the cumulative suite are rerun with any
  unrelated remaining failures disclosed.

## Exclusions

- No React workspace, backend/API, database, migration, seed, credential, generated
  asset, public deployment, or interface redesign.
- No stale reservation-performance or neon-locator oracle repair.
