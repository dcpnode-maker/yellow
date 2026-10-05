# Order 540 — Yellow neon edge light

## Objective

Replace the pale full-screen wash in Yellow's active AI state with a premium,
browser-rendered neon-yellow edge light that keeps the PMS white, responds to
listening/thinking/result state, and never uses a photograph, video, bitmap,
canvas asset or simulated sunlight image.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-stateful-neon-bloom.test.ts`
- focused frontend verification, desktop and 375px browser proof
- `handoff/reviews/540-yellow-neon-edge-light.md`

## Required behaviour

1. Keep the page centre materially white and legible; light is concentrated at
   viewport edges and selected surface boundaries rather than tinting the whole UI.
2. Use only CSS pseudo-elements, shadows, filters and transforms. No image URL,
   data URL, SVG background, canvas, video, WebGL texture or new asset.
3. `ready`, `listening`, `thinking` and `result` retain distinct intensity and
   timing. Listening is visibly energetic without flashing.
4. Motion is compositor-friendly, pointer-transparent and disabled by
   `prefers-reduced-motion`; forced-colours mode removes decorative glow.
5. The effect cannot intercept controls, create document overflow or reduce text
   contrast at desktop or 375px.

## Exclusions

- No information architecture, PMS workflow, copy, assistant behaviour, API,
  database, voice, image generation or external dependency change.
- No claim that a static screenshot proves animation quality.

## Verification

- Intentional test red, then focused glow and adjacent surface tests green.
- Strict frontend TypeScript and production Vite build.
- Browser visual and interaction proof at desktop and 375px, including computed
  absence of image/canvas/video and no horizontal overflow.

