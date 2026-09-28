# Historical seed profile fixture - implementation proof

Original PR86 head74168104 CI36487325291 database job109147958973 fails25-test
review-seed proof at Order202 P7. PR94's repair0ae54a6e CI36489714685 also fails
that shared database lane. Exact native reproduction on disposable
yellow_pr_seed_0929: 24pass1fail113 assertions, no eligible profile on2026-09-18.

Generic seed profiles intentionally receive insertion-time effective ranges.
Changing scripts/seed.ts or weakening temporal selection would be incorrect.
The repair instead adds one exact tenant-scoped synthetic hotel profile covering
the fixed historical stay. The historical query binds its exact ID and tenant,
active state, date and daily cadence. All other assertions remain unchanged.

Reusing the red database reproduces a different first-insert-oracle failure
(created false instead of true). That is retained, not hidden by relaxed tests.
Fresh database yellow_pr_seed_green_0929 at unchanged migrations1-81:
25pass0fail113 assertions, including the exact-no-op and hostile secret/release
cases. Type check and183 import boundaries pass. Both synthetic databases are
retained in the owned yellow-pr94-referee-0929 volume; live demo data is untouched.

The original isolated referee proofs remain11/11 with unchanged runtime/migration
source. Fresh GitHub CI is still required. This is implementer-executed test-only
evidence, not independent high-risk acceptance or whole-PR completion.
