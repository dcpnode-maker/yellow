# Order 525 — Mobile vector navigation

## Objective

Replace device-dependent font glyphs in Yellow's mobile navigation and AI
launcher with one consistent inline vector icon system and accessible touch
targets.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-next-mobile-navigation.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/525-mobile-vector-navigation.md`

## Required behaviour

1. Today, stays, guests, finance and Yellow use a consistent stroke-based
   vector family with text labels and existing accessible names.
2. Mobile targets are at least 48 px high with visible active/focus states.
3. Mobile colours remain yellow, white and neutral black/grey; no blue UI.
4. Icons are inline UI vectors, not background images or sunlight artwork. The
   procedural neon field remains unchanged.

## Exclusions

- No navigation, workflow, voice, API, data or assistant-state change.
- No image, icon-font or third-party icon dependency.

## Verification

- Intentional failing focused test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public 375 px and landscape phone proof.

