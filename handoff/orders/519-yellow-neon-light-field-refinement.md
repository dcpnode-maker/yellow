# Order 519 — Yellow neon light-field refinement

## Objective

Refine Yellow's active AI state so it reads as a premium neon-yellow glow
generated live by the browser, never as a sunlight image, texture, video, or
ray graphic.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-ambient-ai-mode.test.ts`
- focused frontend verification and public visual smoke test
- `handoff/reviews/519-yellow-neon-light-field-refinement.md`

## Required behaviour

1. The active treatment uses only CSS-generated light, blur, opacity and
   transforms. No bitmap, SVG scene, video, canvas texture or remote image is
   permitted.
2. Remove every remaining ray/sunburst expectation and strengthen the glow at
   the workspace edges and command surface without tinting or obscuring PMS
   content.
3. Animate only transform and opacity for the ambient breathing state; retain a
   static `prefers-reduced-motion` fallback.
4. Preserve pointer access, text contrast, mobile reachability and the live PMS
   beneath the field.

## Exclusions

- No workflow, voice, model, API, database, reservation or financial changes.
- No generated mock or image asset is shipped.

## Verification

- Focused test proving procedural field markup, no ray/conic treatment and a
  motion-safe fallback.
- Strict TypeScript and production frontend build.
- Public desktop/mobile visual smoke test.
