# Order 587 — guided Yellow checkout

## Objective

Turn the existing named-checkout preparation into a truthful, mobile-first guided
checkout journey that shows authoritative progress, the itemized folio, exact
blockers and separately confirmed actions, while extending the approved ribbon and
layered-card visual language without inventing operational completion.

## Source authority

- Begin from the exact current public serving source at
  `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Work only in an isolated candidate directory. The current public app remains
  unchanged until a separate release order.
- Reuse the already-approved reservation, checkout-readiness, folio-statement,
  primary-folio, folio-status and checkout contracts. PostgreSQL and the server
  remain authoritative.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/yellow-api.tsx`
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `frontend/yellow/src/styles.css`
- Focused static/browser tests for this journey.
- `handoff/orders/587-guided-yellow-checkout.md`
- `handoff/reviews/587-guided-yellow-checkout.md`
- `handoff/LEDGER.md`

## Required behavior

1. An explicit named checkout opens one dedicated lazy-loaded checkout journey,
   rather than only the generic reservation record.
2. The journey rereads reservation detail, checkout readiness and every owned folio
   before presenting progress or permitting a write.
3. It shows compact operational steps for stay identity, room/occupancy, recorded
   departure services, itemized billing/settlement and final room release. Missing
   minibar, damage inspection or luggage evidence is labelled not recorded; no
   synthetic completion is shown.
4. Every folio window exposes status, exact canonical balance and itemized posting
   lines. A missing primary folio may be created only behind its own confirmation.
5. A zero-balance open folio may be settled only behind a separate confirmation
   using the existing governed status endpoint and a retained idempotency key. A
   non-zero folio never offers fake settlement; it shows the exact balance and a
   route into Finance.
6. Checkout itself has a distinct final confirmation, rereads authoritative state,
   and verifies the resulting checked-out reservation before claiming success.
7. Raw blocker codes are translated into concise operational language. Uncertain
   write outcomes retain the same key and direct the operator to retry verification.
8. The UI uses the approved sliding white ribbon, restrained selected yellow edge,
   and at most two pointer-inert depth cards behind the ribbon/primary work region.
   No LED dots, decorative status bulbs or unnecessary card nesting.
9. Mobile widths 240 and 375 CSS px and desktop 1440 px have no document overflow,
   clipped action, launcher collision or inaccessible confirmation.
10. AI remains silent unless explicitly invoked. The journey does not speak or take
    an operational action automatically.

## Required proof

- Focused source tests for route wiring, confirmation separation, retained
  idempotency, authoritative rereads, exact blocker copy and visual constraints.
- Typecheck, frontend build, package licence audit and applicable standing tests.
- Browser proof at 240, 375 and 1440 CSS px, including one blocked non-zero-folio
  case and one zero-balance preparation path without committing a public checkout.
- `view_image` comparison of the accepted ribbon/card references and the rendered
  journey, with a written fidelity ledger.
- Independent non-implementing review. Because the surface can invoke settlement and
  checkout state changes, the reviewer personally executes the relevant focused
  proof and confirms there is no broader financial or stay authority.

## Exclusions

- No migration, schema, seed, role, grant, permission, backend, payment, journal,
  posting, tax, fiscal, statutory, cashier, OTA, provider or worker change.
- No invented minibar posting, room-damage result, missing-item result, housekeeping
  message/escalation, luggage task or pickup scheduling contract.
- No automatic settlement, forced checkout, non-zero balancing, public-record
  mutation, public deployment, merge, push or whole-application completion claim.

## Implementation checkpoint — 2026-09-22

The isolated candidate is `D:\Yellow\temp\order587-guided-checkout-source`.
The running public source and public database were not changed by this order.

- `App.tsx` routes an explicit named checkout to one dedicated lazy-loaded journey.
- `yellow-api.tsx` keeps caller-owned folio-status and checkout idempotency keys and
  distinguishes uncertain transport/server outcomes.
- `ReservationWorkspace.tsx` presents five truthful stages, reads every current
  folio statement, separates primary-folio/zero-balance-settlement/final-checkout
  consent, reruns authoritative preflights and verifies final departure state.
- `styles.css` carries the approved grey ribbon, white selected pill, thin yellow
  edge/glow and exactly two pointer-inert depth cards, with forced-colour,
  reduced-motion and 240/375/1440 containment rules.

Frozen source hashes for independent review:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/App.tsx` | `e1ec1ed6029cfd2390c09dc062f4159a2f103ce2ff9a3abe7427eea3ecf8157d` |
| `frontend/yellow/src/yellow-api.tsx` | `8b2ce9e44f669fe076a634c0473ec25a321896c6439b8f935a5e729546db2aad` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `674338e6c0986528fd9a43902d5a3f1a3e1991543c0e3aa806ae540ffea17f8a` |
| `frontend/yellow/src/styles.css` | `7801611d096cdb70c59c998375ec41c9743f371bc6356c3980e4c1c835bd7f3c` |
| `tests/yellow-guided-checkout.test.ts` | `de24bce61e09e623f0d1b3272029fbde7b48807f3f85a70c626103e8db761caa` |

Root proof completed before independent review:

- Focused Order587: 6 passed, 0 failed, 48 assertions.
- Applicable checkout/readiness/settlement source surface: 34 passed, 16 explicit
  database-environment skips, 0 failed.
- Frontend strict TypeScript and Vite production build passed; app entry remains
  190.95 kB and the lazy Reservation workspace 104.23 kB.
- Import boundaries passed across 203 TypeScript files.
- Browser proof at 240, 375 and 1440 CSS px found document widths exactly bounded,
  five tabs, one selected tab and two inert depth-card nodes. Ella Clarke exposed
  the exact non-zero SAR 1.00 statement and Finance route; Rohan Kapoor exposed the
  missing-folio confirmation. The only automatic non-GET request was the existing
  synthetic demo-session entry. No folio, settlement or checkout request was made.
- The sole console message was the browser's request for absent local `favicon.ico`;
  no application/API response >=400 or failed request was observed.
- Four failures in the broad Yellow source suite were reproduced byte-for-byte on
  the unchanged current public source (46 pass, 4 fail) and are inherited stale
  monolithic-App assertions from the earlier workspace split, not Order587 changes.
- The package licence command retains the accepted pre-existing `tslib@2.8.1`
  0BSD-policy rejection; Order587 adds no dependency.
- `setup.sh --db-only` could not start on this Windows host because the bundled
  shell lacks required POSIX utilities (`chmod`) and WSL has no `/bin/bash`. No
  database or schema is changed by this frontend-only order; this is recorded as an
  unavailable pre-PR gate, not claimed proof.

## Outcome — independently approved 2026-09-22

Independent non-implementing reviewer `/root/order587_review` personally inspected
the frozen files and approved the bounded source/UI scope with no high-risk finding.
The reviewer reran 6/0/48 focused tests, 27/0 with 6 explicit DB-environment skips
across adjacent checkout/folio proof, strict frontend TypeScript, the 484-module
production build, 203-file boundaries and the 240/375/1440 no-write browser audit.
The signed result is `handoff/reviews/587-guided-yellow-checkout.md`. Public promotion
is governed separately by Order588; no operational action is part of this approval.
