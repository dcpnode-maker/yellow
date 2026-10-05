# Order 534 — Yellow stateful neon bloom

## Objective

Replace the painted-sunlight appearance of Yellow AI mode with a procedural,
image-free neon-yellow light field that reads as illumination behind the live
white PMS surface.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-stateful-neon-bloom.test.ts`
- focused verification and mobile browser proof
- `handoff/reviews/534-yellow-stateful-neon-bloom.md`

## Required behaviour

1. Use no raster, SVG, video or remote background asset for the AI light.
2. Use procedural CSS light sources, blur and layered shadow bloom only; do not
   draw literal sun rays.
3. Preserve the live white PMS as the primary readable surface.
4. Give ready, listening, thinking and result states visibly distinct but
   restrained neon intensity and motion.
5. Animate only compositor-safe transform and opacity properties.
6. Disable ambient motion under `prefers-reduced-motion: reduce`.
7. Preserve mobile interaction, safe-area clearance and document containment at
   375px.

## Exclusions

- No image generation, WebGL/Three.js payload, microphone or assistant logic
  rewrite, API/database/schema change, or deployment claim.
- No blue PMS theme and no literal sunlight/ray artwork.

## Verification

- Focused source contract proves image-free stateful neon markup/styles.
- Strict frontend TypeScript and production Vite build.
- Browser proof at 375px in normal and reduced-motion modes.
