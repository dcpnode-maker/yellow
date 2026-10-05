# Order 523 — Cashier explicit empty-folio state

## Objective

Replace the blank second cashier panel with an explicit, accessible reservation
summary and truthful no-folio explanation when the selected reservation has no
folio windows.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-next-finance-workspace.test.ts`
- focused frontend verification and public browser proof
- `handoff/reviews/523-cashier-explicit-empty-folio-state.md`

## Required behaviour

1. A loaded reservation remains visibly identified by guest, confirmation and
   state even when it is not present in the current in-house search list.
2. A reservation with zero folio windows renders a specific no-folio state, not
   an empty panel and not a fabricated zero balance.
3. The posting panel explains that a folio window is required; it exposes no
   charge controls in the empty-folio state.
4. Screen-reader status semantics and phone reachability are preserved.

## Exclusions

- No folio creation, drawer creation, posting, checkout or financial mutation.
- No API, database, schema, reservation-state or ledger changes.

## Verification

- Intentional failing focused test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public named-folio proof and 375 px phone geometry proof.

