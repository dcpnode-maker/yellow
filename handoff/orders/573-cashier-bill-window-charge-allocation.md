# Order 573 — cashier bill-window charge allocation

## Objective

Add the missing practical bill-window workflow to the published cashier so a hotel
operator can select complete governed charge groups, preview their exact movement,
and place them into an existing or newly named bill window without leaving the guest
account. This is the safe currently-supported part of the founder's itemised bill
splitting journey.

## Natural-solution test

Reuse the already reviewed folio statement transfer-group metadata, sibling-window
family, generation token, transfer preview and transfer commit endpoints. Do not add
tables, journals, allocation arithmetic, partial-line semantics or a second balance
model. One selectable item is one complete canonical charge group (including its
linked correction when present); an amount or quantity cannot be partially split by
this order.

## Implementation authority

The sole serving source remains
`D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-cashier-bill-window-allocation.test.ts`
- `tests/yellow-next-finance-workspace.test.ts`
- `handoff/orders/573-cashier-bill-window-charge-allocation.md`
- `handoff/reviews/573-cashier-bill-window-charge-allocation.md`
- `handoff/LEDGER.md`

## Required behaviour

1. The open cashier folio shows complete charge groups from the authoritative
   statement, clearly distinguishing selectable, already-routed and ineligible rows.
2. The operator can select one or more eligible complete groups and choose either an
   existing open sibling window or a new named window. Source and destination may
   never be the same.
3. Preview calls the canonical endpoint with the exact source folio, selected group
   IDs, statement generation and reason, then displays source/destination before and
   after balances, conserved stay total and each moved member in exact currency.
4. Commit requires a separate visible confirmation and stable idempotency key. Before
   the first commit it refreshes source truth and repeats the canonical preview; any
   generation/group/balance/revision drift clears consent and requires review again.
5. Success is claimed only after authoritative source and destination statements
   reconcile to the returned IDs, currency and exact after-balances while the stay
   total is unchanged. Ambiguous or malformed success becomes uncertain.
6. An uncertain commit locks the exact source/destination/groups/reason/body/key and
   offers only a same-key retry/reconciliation path while unrelated cashier and
   reservation actions remain blocked.
7. The interaction is usable at 375px and desktop with labelled >=44px controls and
   no horizontal overflow.

## Exclusions

- No partial amount, quantity or tax-line split; no arbitrary allocation arithmetic.
- No allowance, correction/reversal, payment, settlement, invoice, fiscal document,
  receivable transfer, drawer mutation, schema/migration or direct SQL.
- No public financial mutation during implementation or review.

## Verification

- Focused parser/state/idempotency/drift/receipt tests and existing finance UI tests.
- Strict frontend TypeScript and production build.
- Controlled actual mounted UI proof at mobile and desktop with network interception.
- Independent non-implementing reviewer personally executes the relevant canonical
  isolated PostgreSQL transfer proof before any public promotion.

## Outcome — independently accepted 2026-09-21

- Implemented complete governed charge-group selection, existing/new named bill
  destinations, exact canonical preview, separate confirmation, consent-fresh
  preflight, stable-key uncertainty recovery and two-statement reconciliation.
- R1 correctly rejected unsorted receipt keys, existing-window name matching and a
  masked malformed-success recovery gap. Those defects were repaired with direct
  actual-helper and mounted-effect regressions.
- Independent `/root/astra_review` accepted R2 after 16/0/189 focused assertions,
  strict frontend TypeScript, Vite469, actual mobile/desktop success/retry/drift
  browsers and isolated PostgreSQL transfer proof 8/0/47.
- Acceptance covers complete charge groups only. Partial amount/quantity/tax-line
  allocation and allowances remain explicitly unimplemented separate contracts.
