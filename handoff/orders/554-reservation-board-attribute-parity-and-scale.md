# Order 554 — reservation-board attribute parity and scale

## Objective

Complete the next bounded PMS03 acceptance slice by making recorded party/travel
attributes first-class advanced reservation filters in the manual and Yellow views,
publishing one explicit capability inventory, and measuring the existing virtualized
table/filter engine at large-property scale.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/today-workspace.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-today-workspace.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-query.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-board-attribute-performance.test.ts`
- `handoff/reviews/554-reservation-board-attribute-parity-and-scale.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. One typed `MovementQuery` drives manual controls and deterministic Yellow reads for
   minimum adults, children present/absent, direction-specific travel recorded/absent
   and pickup requested/not requested, in addition to existing state/source/assignment/
   room-type/rate-plan/property-date/search rules.
2. Voice follow-ups can set and clear those exact filters without a Gemini call;
   ambiguous or invalid adult counts fail closed. Previous compound context is retained.
3. The advanced filter UI exposes the same finite options with accessible labels and
   clear-all behavior; active-filter count stays accurate. No missing travel evidence is
   inferred as a positive state.
4. Export an explicit immutable reservation-board capability catalogue and permanently
   verify that every supported structured filter and sort is represented.
5. A deterministic 10,000-row benchmark exercises the combined filter and stable
   multi-key sort within a generous local interaction budget, while the React source
   continues to render only a viewport slice with overscan.
6. Desktop and 375px layouts remain contained; all touch controls stay at least 44px.

## Exclusions

- No API, schema, migration, database, reservation, guest, voice-provider or public-data
  mutation. No invented market/source/financial fields absent from the canonical board.
- This does not complete PMS03 until public rendered proof and independent review pass,
  and does not claim complete PMS acceptance.

## Verification

- Intentional red for new attribute filters/catalogue/scale proof.
- Focused Today/query/board tests, adjacent voice/query suites, strict frontend/root
  TypeScript and Vite production build.
- Independent reviewer inspects manual/voice parity, missing-data semantics, scale proof
  and 375px public candidate before promotion.
