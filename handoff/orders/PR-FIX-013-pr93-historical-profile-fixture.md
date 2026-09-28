# PR-FIX-013 - Preserve historical seed proof without backdating launch data

Founder authority: repair public PRs. Starting source 15f4b38445a89da4320efccf5848a0c316bc7ea0.
Fresh CI36499476998 passes Windows, local-review, quality, ARM64 and container
smoke, but its isolated Phase3 database gate finds zero profiles effective on the
fixed historical housekeeping fixture's 2026-09-18 date.

## Scope

- `tests/review-seed.integration.test.ts`: import only the three focused historical
  profile-fixture hunks already public at PR86 ac58c91ce2a971a8e2c670edffeed3803417b0b2:
  exact UUID constant; test-owned tenant-specific bounded September17-20 profile
  copied from the canonical launch hotel content; exact UUID/tenant assertion.
- This order, paired question and receipt; ignored finite validation output.

Do not copy PR86's different fiscal permission set or overwrite the whole file.
Do not backdate production launch profiles, alter seeds/migrations, fabricate
housekeeping tasks, touch live DB, weaken the daily eligibility assertion or change
the immutable baseline. The test fixture stays inside the gate's disposable DB.

## Acceptance

Types/203 boundaries, protected source equality outside the scoped test, retained
native/browser/referee source evidence and fresh exact-SHA CI including the actual
27-test isolated seed proof. Review remains distinct from implementer evidence;
no own merge or live promotion.
