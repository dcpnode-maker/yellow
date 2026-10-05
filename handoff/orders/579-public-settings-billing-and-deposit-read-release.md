# Order 579 — public Settings, billing entry and deposit-read release

## Objective

Promote the exact independently accepted Order577 frontend and Order578 read-only
backend to the single public Yellow app without changing public hotel or financial
records.

## Scope

- Docker build and app-only recreation from the sole D: serving source.
- Read-only local/public health, asset, responsive Settings/performance/reservation
  billing navigation and unavailable deposit-service checks.
- `handoff/orders/579-public-settings-billing-and-deposit-read-release.md`
- `handoff/reviews/579-public-settings-billing-and-deposit-read-release.md`
- `handoff/LEDGER.md`

## Required proof

1. Build from the exact Order577 R3 and Order578 R3 accepted hashes with the existing
   valid 40-character build revision; retain a rollback image and recreate only app.
2. Preserve PostgreSQL, Valkey and tunnel identities and data.
3. Verify local/public health HTTP 200, exact reviewed JS/CSS assets and compiled
   backend source identity.
4. Actual public 375px and desktop proof: Settings is reachable and populated from
   current GETs; performance headers/cells align; reservation-board Cashier opens the
   exact Finance reservation with correct current/pre-arrival context. Do not confirm
   or submit primary-folio creation or any financial action.
5. Since hosted deposits remain intentionally disabled and the automatic public
   session intentionally lacks `financials.payments:read`, verify the actual public
   route fails at the earlier scope boundary without leaking or fabricating deposit/
   instrument data; independently inspect the running app flag as disabled and retain
   Order578's accepted absent-service unavailable proof. Do not add a grant merely to
   force the later boundary.
6. Independent reviewer verifies all 129 public-table fingerprints unchanged before
   and after.

## Exclusions

- No folio opening, deposit/payment/provider activation, application, transfer,
  posting, configuration write, migration, seed or public operational mutation.

## Recorded proof correction — 2026-09-21

The independent reviewer proved the actual public demo principal receives the
expected `403 auth/scope_missing` before service resolution because it has no payment
read grant. That is the stronger and correct public boundary. No already-approved
payment-read public principal exists, and creating one would violate this release's
no-grant/no-database-mutation scope. The running disabled flag plus Order578's
reviewer-executed absent-service proof establish the later boundary without weakening
authorization or fabricating a credential.

## Outcome — independently accepted 2026-09-21

- Retained `yellow-public-demo-app:pre-order579`, built exact accepted Order577/578
  source and recreated only the app.
- Public assets `index-BPW7uegm.js` and `index-CIPsAHTT.css`, compiled backend bytes,
  valid build revision, rollback image and local/container/public parity passed.
- Actual public 375px/1440px proof reached populated Settings, aligned the complete
  performance matrix and opened exact Finance context from a live board row without
  submitting any folio or financial operation.
- The actual public principal correctly received `403 auth/scope_missing` from the
  deposit read route; the running feature flag is disabled and the accepted Order578
  absent-service proof remains the later boundary. No data or instrument metadata
  leaked.
- PostgreSQL, Valkey and tunnel identities stayed unchanged; all 129 public-table
  fingerprints matched retained aggregate
  `9eb12c723a3e9b049a39e993ae16ba4349a784913bfcfe4544fbf99fd4c158b5`
  before and after.
