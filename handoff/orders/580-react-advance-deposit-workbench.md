# Order 580 — React advance-deposit workbench

## Objective

Show advance-deposit truth inside the exact reservation billing context and let an
authorized operator prepare a hosted deposit request or apply captured funds through
the existing governed services, with the same confirmation, idempotency and
reconciliation quality as Yellow's other financial actions.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-advance-deposit-workbench.test.ts`
- `tests/yellow-next-finance-workspace.test.ts`
- `tests/yellow-reservation-finance-entry.test.ts`
- `handoff/orders/580-react-advance-deposit-workbench.md`
- `handoff/reviews/580-react-advance-deposit-workbench.md`
- `handoff/LEDGER.md`

## Required behaviour

1. When the selected reservation has an exact open folio, load the accepted Order578
   read model. Render advance deposits with requested amount, state, captured, applied,
   remaining, expiry and generation. An empty list is an honest `No advance deposits`
   state; unavailable/forbidden/error states remain explicit and never become zero.
2. Render only server-returned eligible masked instruments. Never accept or expose a
   token, bearer hash, PSP credential or pasted instrument UUID.
3. Deposit request preparation accepts one canonical positive amount in folio currency
   and one server-returned instrument. Show exact guest/reservation/folio/instrument
   metadata, amount and audit reason; require separate visible confirmation.
4. Before `POST .../folios/:folioId/hosted-deposits`, fresh-read reservation, folio
   statement and deposit workbench. Any folio/currency/instrument/account/state drift
   cancels consent and performs no write. Use one actor/draft-bound stable idempotency
   key and shared parent/manual mutation lock.
5. On first success, display the one-time bearer handoff clearly, warn that it cannot
   be recovered and that creating a replacement revokes the prior active link. Never
   claim capture from browser return. Replays without a bearer are reconciled through
   the authoritative request status.
6. Poll/refetch only while a request is ready/processing. Stop polling for
   captured/declined/expired/revoked and while the Yellow layer is inactive.
7. Offer `Apply deposit` only for captured remaining funds and a positive authoritative
   folio balance. Amount is bounded by both; show exact before/after liability
   application and folio balance; require a new explicit confirmation.
8. Before application, fresh-read request status and folio statement. Commit only
   through the existing application endpoint with a stable key. Success requires the
   exact application receipt plus refreshed status and statement proving applied/
   remaining/balance changes. Uncertain outcomes retain the identical body/key and
   block unrelated work until same-key reconciliation or explicit safe cancellation.
9. Mobile375 and desktop keep 44px controls, exact-money readability and no document
   overflow. Indian English remains default; no new model call is required.

## Exclusions

- No schema/API/service/accounting change, instrument creation, raw card/UPI input,
  provider callback simulation, automatic capture/application, refund, chargeback,
  settlement, real PSP activation, public financial write or deployment.
- No application to a zero/credit/closed folio and no pre-application that creates a
  guest credit balance.

## Verification

- Controlled mounted request, status, replay, drift, malformed-success, 5xx and
  same-key recovery for create and apply with every mutation intercepted.
- Exact-money/currency/state and sensitive-field negative tests.
- 375px/desktop accessibility/containment proof.
- Existing cashier, folio, bill-window, reservation and voice regressions; strict
  frontend TypeScript and production build.
- Independent non-implementing financial/security review before promotion.

## Recorded scope correction — 2026-09-21

Mounting the deposit workbench changed the existing Finance-entry source contract, so
`tests/yellow-reservation-finance-entry.test.ts` is explicitly included. Its updated
assertion preserves the accepted reservation-to-Finance and recovery behavior; it does
not widen product authority.
