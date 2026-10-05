# Order 571 — reservation card and actionable check-in continuity

## Objective

Replace the fragmented public reservation-detail stack with one mobile-first
reservation card whose arrival-readiness area turns canonical blockers into safe,
immediate next actions instead of exposing internal error codes or a dead end.

## Implementation authority

The serving source is
`D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
This order changes that source and its focused tests; it does not create another app.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-reservation-actionable-readiness.test.ts`
- `tests/yellow-reservation-operational-details.test.ts`
- `handoff/orders/571-reservation-card-actionable-checkin.md`
- `handoff/reviews/571-reservation-card-actionable-checkin.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Present the stay as one premium white/yellow reservation sheet with a compact
   identity/status header and grouped operational sections. Remove equal-height card
   padding that makes mobile look like disconnected configuration blocks.
2. Operational fields are entered by selecting the displayed field itself; there is
   no separate top-level `Edit operational details` action. Existing comparison,
   confirmation, idempotency and authoritative refresh rules stay unchanged.
3. Never render raw check-in blocker codes as the primary operator message.
   `dirty_room_override_unauthorized` becomes a room/HK readiness step explaining
   the current condition and offering the existing Yellow guided arrival flow plus
   Housekeeping. It does not override or mutate room condition.
4. `primary_folio_not_open` becomes a confirmation-gated `Open primary folio`
   action only when it is the sole blocker and current room/identity evidence meets
   the existing Order496 predicate. Refresh detail and readiness after every result.
5. The reservation route can open the existing Overwatch arrival journey in place,
   so room assignment, cleaning-task preparation, supervisor inspection, folio
   preparation and final check-in continue conversationally from the named stay.
6. The screen must remain keyboard accessible, use labelled state/tone rather than
   colour alone, keep 44px touch targets, and fit a 375px viewport without horizontal
   overflow.

## Exclusions

- No dirty-room check-in bypass, automatic physical-clean/inspection declaration,
  new room reassignment authority, direct database write or optimistic success.
- No Post Master, city-ledger, OTA receivable, settlement, transfer, accounting or
  fiscal semantics. Those require a separate finance design and independent proof.
- No schema, migration, credential, seed, guest-data or API change.

## Verification

- Focused reservation/readiness/voice tests pass.
- Strict frontend TypeScript and production build pass.
- 375px browser proof shows no horizontal overflow and the route can activate the
  existing named-arrival Yellow journey.
- Independent non-implementing review before public completion is claimed.

## Outcome — independently accepted and publicly promoted 2026-09-21

Implemented in the single serving D: source and accepted by `/root/astra_review`
after two truthfulness/accessibility repair rounds. Final independent proof is
50 passed/0 failed/415 assertions, strict frontend TypeScript, Vite 469 modules,
hostile extracted folio refresh/retry checks, and rendered 375/1440 containment.
The public container now serves `index-BRRF7kpA.js`; root postflight confirms a
healthy container, friendly Housekeeping copy with no raw dirty-room code, a 46.44px
mobile inline-edit target, no horizontal overflow, and a working named
`Resolve with Yellow` transition. No Post Master/city-ledger or new finance semantics
were included.
