# PR-FIX-016 - Keep PR97's historical seed proof eligible in its private DB

Founder authority: fix existing public PRs. PR97 retains the same fixed
September18 housekeeping fixture and insertion-time generic launch profiles that
failed PR93's fresh isolated CI. Reuse only the exact public PR86 ac58c91 three
fixture hunks, now also applied to PR93 by PR-FIX-013.

## Scope

- `tests/review-seed.integration.test.ts`: exact UUID constant, test-owned bounded
  tenant-specific September17-20 profile copied from canonical launch content,
  and exact UUID/tenant assertion for the historical fixture.
- This order, paired question and receipt; ignored finite proof output.

Preserve PR97's additional commercial permissions and other fixtures; no whole-file
replacement. No production seed backdating, migration modification, hotel data,
gate bypass, live DB use or current-profile relaxation. The fixture is confined
to the disposable Phase3 test DB. Root/static skips are not database evidence.

## Acceptance

Strict types/boundaries, all standing tests, exact protected source equality,
actual isolated seed/referee CI and independent review where required. PR97 remains
unaccepted while its separate licence decision and runtime evidence are pending.
