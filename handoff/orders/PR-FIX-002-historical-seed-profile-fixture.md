# PR-FIX-002 - Clock-independent review-seed fixture

Founder request: fix all current public Yellow pull requests. Original exact-head
CI/native proof fails Order202 P7 after 2026-09-18 because the launch profile's
insertion-time default does not cover the fixed historical synthetic stay.

Scope: tests/review-seed.integration.test.ts, this order and the paired review
receipt. Apply the same narrow test repair to affected PR86/94/96, and other
current PRs only where the exact failing fixture is present. Do not alter live
runtime, production seed/default profile periods, domain eligibility, migrations
or financial/occupancy authority. No PR merge, forced push or independent approval.

Use a fixed test-owned tenant profile covering the historical stay. Assert its
exact identity, tenant, effective period, status and daily cadence; preserve all
other fixture/reseed/no-side-effect assertions. Execute on a fresh owned synthetic
database, retaining the red database and all previous receipts. Reusing that red
database would invalidate first-insert assertions and is not a valid green proof.
