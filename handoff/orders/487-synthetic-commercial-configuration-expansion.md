# Order 487 — Synthetic commercial configuration expansion

## Objective

Make the existing, current-date Yellow House Mumbai colleague property feel like
a configured hotel without creating a second property or presenting invented
financial performance.  Add a small but realistic, entirely synthetic set of
base rate plans and typed future pricing that the current commercial workspace
can read from the authoritative rate configuration and rate-price services.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/scripts/provision-colleague-current-date.ts`
- focused scenario and commercial-configuration tests in the corresponding
  runtime `tests/` directory
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `handoff/reviews/487-synthetic-commercial-configuration.md`

## Required behaviour

- Retain the same Yellow House Mumbai property, property id and scenario
  namespace from Order 486; do not duplicate the property or reservation
  scenario.
- Retain only synthetic/contact-free identities and never import provider,
  guest, payment or customer data.
- Retain the existing reviewed BAR plan as the baseline plan and add typed,
  active INR flexible, advance-purchase and corporate/direct plans. Every plan
  created by this order has explicit, valid cancellation/deposit/guarantee
  references through the existing create-only configuration contract. The
  legacy BAR row is neither edited nor misrepresented as policy-linked: rate
  plan policy updates are not part of the existing typed command contract.
- Add exact bigint-safe rate prices for the configured room types across a
  bounded future date range through `RatePricingService`; no raw `rate_price`
  DML, no update-in-place, no decimal or floating money.
- Every configuration and price write must have the service-owned fact and
  outbox event in the same transaction.  Replay must verify the exact
  canonical configuration and perform no write.
- Present the plans and their availability in the existing commercial summary
  without turning the scenario prices into ADR, RevPAR, actual revenue or a
  forecast.
- Independently verify idempotence, tenant isolation, no duplicate property,
  exact price representation, audit/outbox evidence, and current public
  property state before public deployment.

## Exclusions

- No real guest or OTA data, no rate publication, no OTA/channel connection,
  no package/promotion/meal-plan engine, no payment, no financial posting, no
  sellability/availability override, no early-check-in or late-checkout sale,
  no schema migration, and no public deployment before independent review.

## Follow-on boundary

Early-arrival and late-departure sales remain a separate authoritative command.
It must revalidate the reservation, current room readiness, active OOO/OOS,
physical availability, configured ancillary policy, approved price and
confirmation/payment requirement in one tenant transaction.
