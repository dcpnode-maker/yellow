# Order 683 — Repair final reservation creation and detail/check-in handoff

DELIVERED BOUNDED FIX — 2026-09-24; receipt683 records proof and limitations. Founder reproduced Review → Offer with false changed-offer
message rather than a created reservation/booking ID. This takes priority over
681 promotion; calendar implementation may proceed in separate file sections.

## Required outcome

Reproduce actual availability responses, identify why fresh evidence is rejected,
and fix only the proven cause. Preserve changed-price/policy/inventory rejection,
explicit confirmation, server-owned allocation, exact idempotency on unknown
outcomes, and authoritative receipt reconciliation. Never weaken these guards just
to make a success message appear. A successful creation displays booking ID and
closing that success view opens the created reservation, not the offer step.

Expose the existing eligible check-in/room-assignment flow from reservation detail.
The ready-room chooser may filter by room number and appear as an accessible
dialog, but only existing server candidate/assignment/check-in commands have
authority. Future-arrival/state/readiness blockers stay explicit. No automatic
check-in or fake ready-room state.

## Exact scope

- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` create/detail/check-in
  sections only (681 frontend owns calendar/board sections; coordinate handoff)
- `frontend/yellow/src/yellow-api.tsx` offer/commit helpers only (681 owns calendar)
  Amendment683a: also existing check-in/room-assignment HTTP error classification
  for safe exact-request popup reconciliation; no server authority changes.
- `frontend/yellow/src/reservation-create.ts` new pure helpers if needed
- `frontend/yellow/src/workspaces/reservation-create.css` new scoped styles if needed
- `tests/order683-reservation-create.test.ts`, `tests/order683-reservation-create-api.test.ts`
- `tests/order609-reservation-create-edit.browser.test.ts` fixture-only compatibility update: add the now-required canonical commercial-evidence fields to its synthetic offer payload; keep its existing confirmation, mutation, and layout assertions unchanged.
- `tests/fixtures/order683/**`, `scripts/order683-reservation-proof.ts` isolated
  actual-app browser fixture if needed; no simulated fixture represented as live DB proof
- This order, `handoff/questions/683.md`, `handoff/receipts/683-reservation-create.md`,
  `handoff/reviews/683-reservation-create-independent.md`, ledger/project-status
  plus a status-pointer-only update in the non-serving C: coordination checkout.
- generated `public/yellow-next/**`, isolated delta build recipe `D:/Yellow/temp/order683-*`

No backend command/schema/seed/permissions/payments/occupancy mutation or live test
booking authorized by this order. Any required backend fix stops to documented
scope amendment. No production guest data sent to third-party tools.

## Proof

First capture real read-only search evidence and a failing regression. Exercise
unchanged re-quote, genuine changed quote, transient timestamp/reference variations,
same-key uncertain retry and success-to-canonical-detail behavior. Independently
execute relevant existing booking DB/HTTP proof on disposable synthetic data.
Mounted actual UI desktop/mobile, intercepted mutation for browser proof, and
independent review must pass before the single app is promoted. Preserve679rollback.
