# Order 508 — Procedural neon-yellow AI glow

## Objective

Replace the remaining ray-like Yellow activation treatment with a premium,
real-time neon-yellow light field generated entirely by the frontend. The live
PMS remains visible and usable beneath the active AI state.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- focused frontend verification
- `handoff/reviews/508-procedural-neon-yellow-ai-glow.md`

## Required behaviour

1. Yellow activation uses no bitmap, photograph, image URL, video, canvas
   texture, or pre-rendered sunlight asset.
2. Remove the conic ray/sunburst layer. Render a restrained neon-yellow bloom
   behind the white PMS using CSS gradients, blur, opacity and transforms.
3. The active field must visibly illuminate workspace edges and the command
   controls without reducing text contrast or blocking interaction.
4. Animation must be compositor-friendly and subtle, with a static
   `prefers-reduced-motion` fallback.
5. Desktop and mobile layouts must remain usable and performant.

## Exclusions

- No product-data, workflow, API, database, reservation, financial or voice
  behaviour changes.
- No generated mock image may be shipped as the live glow.

## Verification

- Search built sources for image-backed glow assets and removed ray selectors.
- TypeScript typecheck and production frontend build.
- Browser smoke test of inactive and active Yellow states.
