# Order 165 — Reservation-create usability unblock

**Status:** READY — founder-observed booking blocker
**Phase:** 5 · human-testable application
**Branch:** `phase-5/reservation-create-usability-unblock`
**Base:** `fe8662a` (Order164 candidate; review/promotion remains a prerequisite)
**Risk tier:** 2 — browser defaults and narrow HTTP error classification
**Owner:** Codex implementation; independent non-implementing review before local replacement

## Outcome

Make the existing approved Party → offer → optional hold → reservation flow usable by
a normal operator without manually repairing blank dates or receiving a misleading 503
for a stay outside the governed booking window. This is the immediate unblock while
the separate reservation board/read-model and deep-linked drawer orders proceed.

## Scope

- `src/http/operator/operator.js`;
- `src/http/operator.ts`;
- `tests/operator-assets-security.test.ts`;
- `tests/operator-founder-reservation-journey.integration.test.ts` only for the exact
  served canonical search/error regression;
- this order, additive D-432, `handoff/LEDGER.md`, and one additive review.

No HTML/CSS, route, service/domain algorithm, schema, migration, seed, permission,
credential, event, financial behavior, dependency or local runtime replacement is in
scope. If another path is required, stop and write a question.

## Required behavior

1. `initializeDates()` populates the reservation booking form's required UTC `from`
   and `to` controls with a near-future positive stay using the existing canonical UTC
   input formatter. The values remain editable and in-memory only.
2. Existing Availability, rate, block and builder defaults remain byte-equivalent in
   meaning; sign-out/property changes keep clearing reservation selections and holds.
3. The exact governed rate-evaluation booking-window failure becomes an actionable
   no-store HTTP 400. Other rate evaluation or infrastructure failures remain generic
   503 and no internal error text is exposed.
4. A served login and UI-shaped canonical request using the initialized dates returns
   bookable server evidence. No client success or inventory promise is invented.

## Proof

- exact blank-date Base regression and initialized candidate values;
- focused static/asset and fresh PostgreSQL served journey tests, including current
  valid search 200 and exact out-of-window 400 while unrelated injected failures stay
  503;
- standing tests, typecheck, boundaries, licences, audit and protected hashes;
- fresh app-never-started referee 11/11 and independent review.

## Forbidden

- Hard-coded 2030/review dates, client-derived availability, weakened booking window,
  broad `RateEvaluationError` disclosure, mock success, embedded credentials, UI
  redesign, merge, push, deployment, self-review or self-merge.

## Definition of done

- [ ] A human can reach bookable offer selection from the existing reservation form.
- [ ] Invalid-date feedback is actionable without leaking internals.
- [ ] Full gates and independent proof pass before local promotion.
