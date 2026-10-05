# Order 560 — Yellow neon reduced-motion specificity

## Objective

Close the inherited accessibility defect found during Order559 postflight: when
Yellow is in result state, the procedural neon field must not animate for a browser
that requests reduced motion.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-stateful-neon-bloom.test.ts`
- app-only build and promotion for Docker Compose project `yellow-public-demo`
- `handoff/reviews/560-yellow-neon-reduced-motion-specificity.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Under `prefers-reduced-motion: reduce`, every Yellow neon-field state including
   result computes to no animation and no transform-driven motion.
2. Normal ready/listening/thinking/result states retain the reviewed procedural
   neon edge light, image-free implementation and distinct motion.
3. Forced-colours still removes the decorative glow; the field stays
   pointer-transparent and cannot create desktop or 375px overflow.
4. No PMS, assistant, API, database, migration, data, provider or credential
   behaviour changes.

## Verification

- Intentional source-contract red before the specificity repair.
- Focused neon/ambient tests, strict frontend TypeScript and Vite469 build.
- Independent browser proof for normal and reduced-motion result states at 375px
  and desktop, including computed animation, image absence and containment.
- Recreate only the public app after independent source acceptance; PostgreSQL,
  Valkey and tunnel identities remain unchanged.
