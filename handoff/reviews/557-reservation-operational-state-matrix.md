# Order 557 review — reservation operational-state matrix

## Outcome

Accepted for the defined PMS04 read-projection acceptance. This does not approve a
reservation lifecycle write, a complete check-in flow, or the whole PMS.

## PostgreSQL proof

- Created a disposable isolated `postgres:16.15-alpine` container on loopback port
  55457 with tmpfs storage; the public application database was not used.
- Applied all 95 migrations, loaded `tests/seed_fixture.sql`, and ran the repository
  invariant referee with UTF-8 output: **11 passed, 0 failed**.
- Ran `tests/reservation-operational-state-matrix.integration.test.ts` against the
  deploy and runtime roles: **1 passed, 0 failed, 118 assertions**.
- The matrix covered 16 reservations across `Asia/Kolkata` and
  `America/New_York`: early and late due-in, early and late due-out, early and late
  checked-in-today, same-day in-house without a completed check-in fact, overnight
  stayover, checked-out-today, and historical checkout.
- Every result was reconciled to the stored reservation status, property-local stay
  dates, property-local today, and unsuperseded lifecycle fact business dates read
  back from PostgreSQL. Cross-tenant reads returned no rows and before/after row
  counts proved the board read was mutation-free.
- The disposable container was removed and verified absent; port 55457 was closed.

## Adjacent gates

- Existing board PostgreSQL plus reservation UI/voice/query suites: **61 passed,
  0 failed, 391 assertions**.
- Strict frontend TypeScript: exit 0.
- Root TypeScript: exit 0.
- Vite production build: **469 modules**, unchanged assets
  `index-D4gkmEEZ.js` and `index-HgZI0zi4.css`.

## Scope statement

The order added only a disposable integration test and governance evidence. It did
not change the public application, database, data, Docker runtime, API, reservation,
occupancy, guest, financial, provider, or schema state.
