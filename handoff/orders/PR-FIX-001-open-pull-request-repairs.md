# PR-FIX-001 — Existing public pull-request repairs

Founder authority: fix all six open Yellow pull requests. The full scoped order
and original inventory are preserved in PR97 commit d708ff29, at the same path.
This checkout now works on PR86, not PR97. Scope for this slice: reconcile the
existing main base, retaining both dated records in docs/PROJECT-STATUS.md,
this order, handoff/reviews/PR-FIX-001.md and the merge's already-reviewed base
changes. No applied migration edits, new production behavior, forced push,
draft removal or own merge. Original dirty checkouts remain untouched.

Verification: diff/conflict-marker checks, focused profile/workspace tests,
types/boundaries, database referee and exact-head GitHub checks. Historical
acceptance must not be presented as current exact-head proof.

## Reproduced CI scope amendment - 2026-09-29

The database job fails Order202 P7 in tests/review-seed.integration.test.ts: the
fixed 2026-09-18 synthetic stay precedes the generic launch profile's normal
insertion-time effective range. Admit a test-local, tenant-scoped hotel-profile
fixture covering that fixed stay and its exact identity assertion in this test.
Do not change scripts/seed.ts, generic profile defaults, production temporal
selection, applied migrations or live data. Preserve every existing side-effect
and eligibility assertion. Record red/green native proof and fresh exact-head CI.
