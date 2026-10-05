# Question 136 — Order 100 fresh hold-proof database

Order 100's P0 intentionally executed the complete Order 055 suite against
`yellow_order100_red`, leaving successful hold, occupancy, fact, outbox and idempotency
evidence. The first post-correction attempt reused that consumed database: corrected P7
passed, but P1/P2/P3/P6 failed their explicit initially-empty/first-publication
preconditions on P0 artifacts.

May the complete seven-case proof restart on a newly migrated isolated database with the
same correction and password? No assertion, product, seed or fixture changes are proposed;
the consumed-database run remains recorded.

## Answer

Yes. Order 100 pre-registers fresh PostgreSQL for the final proof, and Order 055 is not a
repeat-on-consumed-fixture suite. Recreate a distinct isolated database, restart all seven
cases from P1, and retain both results. Rejected: deleting P0 artifacts to simulate a fresh
database; weakening initial-empty or first-publication assertions; claiming the partial
rerun as product failure.

## RESOLVED

Resolved by Order 100's distinct fresh-database 7/7 proof recorded in
`handoff/LEDGER.md`; the consumed intentional-red evidence remains preserved.
