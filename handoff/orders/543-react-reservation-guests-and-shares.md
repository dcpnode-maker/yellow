# Order 543 — React reservation guests and shares

## Objective

Make the current Yellow reservation workspace able to maintain the canonical guest
party and sharer allocation before check-in, without leaving the live React PMS or
creating a second guest truth.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-guests.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-lifecycle-actions.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-next-checkout-confirmation.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/543-react-reservation-guests-and-shares.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/LEDGER.md`

## Required behaviour

1. The exact reservation workspace exposes one mobile-safe **Guests & shares**
   editor for server-reported editable states only: `reserved`, `due_in`,
   `in_house`, and `due_out`.
2. The server-owned primary Party and role are visibly read-only. Staff can search
   existing canonical Party profiles, add at most one occurrence per Party, choose
   `accompanying` or `sharer`, and remove only non-primary rows.
3. Accompanying guests carry no percentage. When any sharer exists, every sharer
   and the primary require canonical two-decimal percentages from `0.01` through
   `100.00`, calculated as integer basis points and totalling exactly `100.00`.
4. Saving requires a separate unchecked confirmation naming the reservation and
   showing the exact proposed allocation. The unchanged request retains one
   idempotency key across uncertain retries.
5. The existing governed `PUT .../reservations/:id/guests` endpoint is the only
   write authority. Success is claimed only after exact canonical reservation
   detail matches the proposed Party, role, and share allocation; uncertain results
   are refetched and reconciled.
6. Guest allocation shares the lifecycle/check-in/checkout/voice mutation lock.
   Successful writes invalidate the reservation board and refresh the same inline
   reservation detail and recorded history without changing URL.
7. Errors preserve the draft and provide actionable feedback. Closing, reservation
   change, or property change discards draft/search state and stale results.
8. Controls remain keyboard accessible and contain long names and Party IDs at
   desktop, 375px portrait, phone landscape, and 200% zoom.

## Exclusions

- No Party identity editing or new Party creation.
- No folio ownership, charge routing, invoice, payer, or financial split semantics.
- No schema, migration, permission, endpoint, event, occupancy, room, lifecycle,
  check-in, Gemini, voice-provider, or neon-field change.
- No fabricated identity evidence or automatic guest creation from speech.

## Risk and review

This exposes an existing audited reservation state command. A non-implementing
reviewer must inspect the final bytes and personally execute a bounded API/DB proof
covering replace, replay, conflict/no mutation, primary preservation, exact shares,
fact/outbox/idempotency evidence, and unchanged occupancy/financial fingerprints
before public deployment.

## Verification

- Record an intentional failing frontend contract before implementation.
- Focused frontend tests, adjacent reservation tests, strict root/frontend
  TypeScript, and production Vite build.
- Independent reviewer-owned canonical proof.
- Browser proof at desktop, 375px portrait, and phone landscape before promotion.
