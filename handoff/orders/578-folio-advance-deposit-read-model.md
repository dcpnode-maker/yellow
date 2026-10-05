# Order 578 — folio advance-deposit read model

## Objective

Give Yellow one authoritative, refreshable read model for advance deposits and safe
eligible payment-instrument choices on an exact reservation folio, so a future stay
can show requested, captured, applied and remaining deposit truth after reload without
pasting request or instrument UUIDs.

## Scope

- `src/contexts/financials/hosted-deposits.ts`
- `src/contexts/financials/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `tests/hosted-deposit-workbench.integration.test.ts`
- `tests/hosted-deposit-http.integration.test.ts`
- `handoff/orders/578-folio-advance-deposit-read-model.md`
- `handoff/reviews/578-folio-advance-deposit-read-model.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Add a read-only service method for one exact tenant/property/folio. Fail closed
   unless the folio, its guest account and owner Party are coherent in that property.
2. Return a bounded, deterministic latest-first list of hosted deposit statuses for
   the folio using the existing canonical materializer: request/operation identities,
   amount/currency/generation/expiry/state and captured/applied/remaining exact minor
   units. Never reconstruct status client-side.
3. Return only active tokenized instruments owned by the folio Party and supported by
   the current deposit service (`card_network_token` or `upi_vpa`). Expose only UUID,
   kind, brand, last4, expiry and PSP; never token, bearer, hashes or raw provider
   credentials. Bound and deterministically sort the list.
4. Expose `GET /api/v1/properties/:property/folios/:folioId/hosted-deposits` under the
   existing `financials.payments:read` scope plus exact property grant. A foreign
   tenant/property/folio is indistinguishable from not found.
5. The endpoint is enabled only when the existing hosted-deposit service is present;
   otherwise retain the current explicit unavailable response. It performs zero
   writes and grants no create/apply/refund/capture authority.
6. Response parsing and serialization use the existing exact canonical JSON boundary,
   canonical decimal strings and bounded arrays.

## Exclusions

- No migration, payment/deposit application, provider callback, bearer issue,
  instrument creation/update, refund, chargeback, settlement, real PSP, UI or public
  deployment.
- No token/PAN/CVV/bearer/hash leakage and no generic payment-instrument search.

## Verification

- Fresh isolated PostgreSQL proof with real migrations and synthetic token-only data.
- Exact in-scope list/status/instrument response and empty-state proof.
- Tenant, property, folio, Party and scope hostility; inactive/unsupported instrument
  exclusion; bounded-ordering; no sensitive fields.
- Repeatable-read before/after fingerprints proving zero database changes.
- Existing hosted-deposit integration/HTTP tests, root TypeScript, boundaries and an
  independent non-implementing financial/security review.

## Outcome — independently accepted 2026-09-21

- Added the exact read-only folio deposit workbench and governed GET route without a
  migration or write authority.
- Independent review retained two rejected rounds: the first found an actual router
  parameter collision and instruments with missing token/PSP; the second found
  instruments still offered after folio/account closure.
- Final R3 reuses the existing folio `:reference` radix, mirrors PaymentService's
  property/currency/route/account/token/PSP eligibility, and returns no instruments
  for a closed folio or guest account while preserving historical deposit statuses.
- Reviewer-owned fresh PostgreSQL 16.15 migrations 1–97 and 32/0/175 tests, actual
  mounted routing and hostility, scoped TypeScript and 202-file boundaries passed.
  All 129 table fingerprints remained unchanged.
- This is a bounded read model only; no frontend, provider activation, real payment,
  application, deployment or public-runtime change occurred.

