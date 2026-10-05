# Order 522 — Yellow inline named cashier

## Objective

Render a uniquely named guest's current cashier/folio workspace inside Yellow
AI mode instead of navigating away, while preserving every existing financial
posting gate.

## Scope

- `frontend/yellow/src/App.tsx`
- `tests/yellow-voice-routing.test.ts`
- focused frontend verification and public browser proof
- `handoff/reviews/522-yellow-inline-named-cashier.md`

## Required behaviour

1. A unique named bill/folio request opens the existing cashier workbench inline
   with that reservation selected.
2. The request performs no posting, settlement, transfer, invoice or other
   financial write.
3. Existing transaction-class, amount, folio-window and explicit confirmation
   controls remain unchanged.
4. Generic cashier requests continue to open the same existing workspace.

## Exclusions

- No financial API, journal, posting, folio, invoice, reservation or database
  logic changes.
- No automatic financial action.

## Verification

- Focused routing/static UI tests, strict TypeScript and production build.
- Public named-bill proof with URL stability and unchanged posting gate.
- Phone geometry/reachability proof.
