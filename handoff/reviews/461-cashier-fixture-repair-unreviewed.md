# Order 461 — cashier fixture repair (unreviewed)

## Discovery

On 2026-09-20 root used the public automatic synthetic-demo entry, opened
Cashiers, searched `Devika`, and selected the only current in-house result
`PARKING-REVIEW`. The read-only detail request returned HTTP 409 rendered as
`Stored reservation data is incoherent`; no drawer, folio, charge, payment,
document, confirmation or other mutation was attempted.

Read-only PostgreSQL inspection of the selected synthetic stay found one
`in_house` reservation segment but zero `space_occupancy` rows and zero `folio`
rows. Source inspection also found that `provisionVehicleExamples` created the
parking reservation/segment but omitted its primary `reservation_guest` row.
The result was a fixture that could appear in the in-house cashier search but could
not satisfy the authoritative reservation-detail reader nor reach its bill.

## Candidate repair

Within the newly explicit Order 461 synthetic-fixture scope, the candidate updates:

- `scripts/seed-review.ts` — creates/verifies exactly one primary guest link, one
  exact segment occupancy via `record_occupancy`, and one empty, open primary folio
  on the already-existing guest account for `PARKING-REVIEW`.
- `tests/review-seed.integration.test.ts` — asserts one primary guest, exact
  occupancy, open primary folio, expected account binding and zero posting lines.

The candidate creates no journal, posting line, payment, document, provider call,
external channel action or real identity data. It does not modify an existing
financial history.

## Root checks

```powershell
bun run typecheck
# passed after the fixture change

bun test tests/review-seed.integration.test.ts
# without database variables: 1 passed, 26 explicit database skips, 0 failed
```

## Fresh isolated proof

Root recreated the exact disposable database `yellow_fixture_proof` only (the
temporary `yellow-fixture-proof` compose project on `127.0.0.1:56532`), provisioned
its local roles, and applied migrations `0001` through `0091`. No public container,
database, image, tunnel or production-shaped fixture was modified.

```powershell
YELLOW_REQUIRE_REVIEW_SEED=1 bun test tests/review-seed.integration.test.ts
```

The first fresh rerun exposed three stale assertion oracles: a profile query used a
historic instant although the launch profile becomes effective at the seed
transaction, and two assertions retained pre-rename synthetic placeholder names.
The assertions were corrected to the actual seed contract (not waived), then a new
fresh isolated database run produced **27 passing / 0 failing / 117 assertions**.
The directly relevant checks passed:

- Order 236 P6 proves one primary guest, one exact exclusive segment claim made by
  `record_occupancy`, one open primary folio on the existing guest account, and zero
  posting lines for `PARKING-REVIEW`.
- P3 proves an identical reseed is an exact no-op.
- P5 proves the active synthetic Room 203 stay makes that room non-bookable; the
  other five real rooms stay bookable. This corrects the previously incoherent
  zero-occupancy fixture rather than masking a double-sell condition. The stay ends
  thirty-one days from its seed transaction so this proof cannot change result at a
  same-day thirty-day clock boundary.
- Canonical financial configuration and all pre-existing no-posting/no-payment
  guards exercised by the seed suite passed.

An independent nonimplementing reviewer has been asked to inspect and personally
execute the fixture proof. Until that review and the remaining red test failures are
resolved, the public database, public app image and tunnel remain unchanged and the
cashier billing path is not ready for release.

## Independent review — approved

On 2026-09-20, the independent nonimplementing reviewer completed the review on a
separate fresh PostgreSQL 16.15 container and approved the frozen candidate. They
personally applied all 91 migrations, ran the review-seed suite (**27 passed, 0
failed, 117 assertions**), and separately ran the canonical invariant battery
against another fresh database seeded from `tests/seed_fixture.sql` (**11 passed,
0 failed**). Their read-only census confirmed exactly one primary guest matching the
reservation party, one exact exclusive Room 203 segment occupancy with `[0,)`, one
empty open primary folio, and zero journals, posting lines, payments or documents.

Reviewed source hashes:

- `scripts/seed-review.ts`: `A394A3201B62515ADE9A2A134D4967080451B3447EE1941854428F603D8B80D4`
- `tests/review-seed.integration.test.ts`: `A57B6465EACB077B46ACE7109506628A5F49F2EFEDEF3910F0DEEF4D0E64A8DF`

The reviewer also found and the implementation corrected the original thirty-day
clock-boundary issue by extending the fixture one day beyond the availability test
horizon. Only after this review, the public synthetic-only demo database was
recreated from the reviewed source. Live read-only verification confirms
`PARKING-REVIEW` now has one primary guest, one occupancy, one open primary folio,
zero posting lines and Room 203 assignment.
