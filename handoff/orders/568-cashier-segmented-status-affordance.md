# Order 568 — cashier segmented status affordance

## Objective

Make the already-governed public cashier posting workflow immediately legible on
mobile and desktop: grouped charge classes behave like the supplied segmented-control
reference, current status is expressed by labelled colour containers, and the screen
states clearly that folio posting does not require a configured physical cash drawer.

## Implementation authority

The serving source for this order is
`D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
This order does not create a second application or copy data.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-next-finance-workspace.test.ts`
- `handoff/reviews/568-cashier-segmented-status-affordance.md`
- `handoff/LEDGER.md`

## Requirements

1. Preserve the existing canonical charge endpoint, server-owned transaction-code
   catalogue, idempotency key and visible confirmation gate.
2. Add compact accessible icon-and-label segmented controls for charge groups. Active
   state must use shape, check mark and `aria-pressed`, not colour alone.
3. Status badges remain labelled and gain explicit semantic tone containers.
4. Explain that physical drawer configuration governs cash custody, not non-cash folio
   posting, so an empty drawer list is not presented as a posting failure.
5. Preserve 44px touch targets, horizontal scrolling and reduced-motion behaviour.

## Exclusions

- No migration, ledger mutation, new transaction code, settlement, correction,
  fiscal-document action or cashier-session bypass.
- No production commercial-attribution migration; Orders 564/567 remain its separate
  architecture and proof gate.

## Verification

- Focused frontend source tests pass.
- Frontend typecheck and production build pass.
- Existing Yellow voice-routing tests pass, including Indian-English default and
  confirmation-gated cashier posting.

## Outcome — 2026-09-21

Implemented and independently accepted. The live cashier uses six accessible 44px
icon-and-label charge groups with pressed-state shape/check feedback, semantic status
containers, and explicit separation of cash-drawer custody from ordinary governed
folio posting. Independent review caught and required repair of an inherited CSS
cascade that briefly gave inactive group pills a dark action-button background. Final
proof passed 41 tests/344 assertions, strict frontend TypeScript, Vite 469-module build
and isolated 375px/desktop rendering. The posting endpoint, idempotency and confirmation
gate were not widened; no database or operational write occurred.
