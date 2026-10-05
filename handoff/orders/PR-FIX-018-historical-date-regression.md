# PR-FIX-018 - Preserve the exact historical profile lookup date (PR97)

Founder authority: repair existing public PRs. PR-FIX-016 scopes the pinned
PR86 profile fixture. Starting PR97 source is d708ff29e2e44df74a5c1a12e58a8cf656b14c8d.
Inspection found the incomplete backport still queried transaction_timestamp()
despite inserting a test-owned profile bounded to September17-20.

## Scope

- `tests/review-seed.integration.test.ts`: complete the already-scoped query
  backport using the exact public PR86 September18 instant. Remove its now
  misleading launch-time comment; production seed semantics remain unchanged.
- `tests/historical-profile-fixture.test.ts`: paired static regression for the
  exact UUID, tenant, bounded historical profile and date-specific query.
- This order, paired question and repair receipt; ignored finite proof output.

Do not replace the whole integration file, alter permissions, production seeds,
migrations, runtime clocks, live data or assertion strength. A static guard is
not database proof; fresh isolated CI and independent acceptance remain separate.
PR97's licence decision is not waived.

## Acceptance

Record the initial guard failure, corrected focused proof, strict typecheck and
full native suite. Confirm protected production source is unchanged by this
correction. No own GitHub merge, live promotion or app-complete claim.
