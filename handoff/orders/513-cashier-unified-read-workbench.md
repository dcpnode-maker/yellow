# Order 513 — Cashier unified read workbench

## Objective

Make the cashier billing desk immediately usable from guest, confirmation,
room or folio references and expose the complete itemized statement and sibling
windows before any governed posting action.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- focused frontend tests
- `handoff/reviews/513-cashier-unified-read-workbench.md`

## Required behaviour

1. Current-stay search matches guest, confirmation, assigned room and room type.
2. Selecting a stay automatically opens its first open folio, falling back to
   its first returned window; no redundant second selection is required.
3. Exact folio reference remains supported and opens the attached current stay.
4. Every returned immutable posting is visible, not only the last six.
5. Posting-class tabs derive only from returned server `kind` values and filter
   the statement without inventing accounting categories.
6. Sibling folio windows are selectable and show their own complete statement.
7. Read display uses formatted property currency rather than exposing raw minor
   units as the primary balance representation.
8. Existing charge posting remains unchanged and visibly confirmation-gated.
9. Mobile collapses the three workbench columns to one readable sequence.

## Exclusions

- No change to money conversion, posting payload, tax, journal, allowance,
  settlement, transfer or fiscal-document semantics.
- No inferred F&B/accommodation category where the server did not return one.

## Verification

- Focused frontend tests, typecheck and production build.
- Hosted browser smoke by guest/room and exact folio where current data permits.
