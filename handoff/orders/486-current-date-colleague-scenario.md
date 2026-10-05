# Order 486 — Current-date colleague scenario

## Objective

Add a deterministic, entirely synthetic current-date hotel operating scenario
for colleague review without altering the long-lived proof fixtures that
exercise check-in, checkout, parking, fiscal and invariant behaviour.

## Scope

- A dedicated idempotent scenario provisioner under `scripts/`
- focused scenario-contract tests under `tests/`
- a review record under `handoff/reviews/`

## Required scenario

- Use invented guest identities and contact-free profiles only; no real guest,
  OTA, PriceLabs, PMS, payment or document data.
- Use a separately identifiable synthetic property or isolated scenario
  namespace, current property-local dates, and a practical mixture of arrivals,
  departures, in-house guests, future bookings, room types, rate plans,
  housekeeping conditions/tasks, an OOO/OOS example, a cashier drawer and
  repeat-stay history.
- All occupancy is created only via `record_occupancy()`; all financial facts
  use the existing governed commands/seed patterns; no insert-only table is
  updated.
- The operator receives the exact property grant through the existing governed
  identity/grant pattern.
- The provisioner must be idempotent and validate its own target before a
  write. It must not reseed, delete, alter, or change the existing review
  fixtures.
- An independent non-implementing reviewer must execute the scenario proof and
  verify tenant isolation, occupancy, event/audit evidence and current-date
  lane counts.

## Exclusions

- No real-data ingest; no production customer data; no provider/OTA access;
  no payment collection; no schema migration; no modification of the existing
  test fixture property; no public release until independent review passes.
