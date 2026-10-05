# Q229 — Credit discovery fixture containment audit

**Status:** RESOLVED for read-only diagnosis/preparation and independently executed
post-audit. No test retry, cleanup, database mutation or broader exception.

Root personally executed Q228's frozen actual signed-session test. The application
proof passed **1/0/34 assertions**. The final containment helper then failed on
`global table tx_code differs`; do not call the entire wrapper green. Its earlier
checks proved every 1,375 prior row, catalogue, function, ledger, companion database,
outside role/settings state and application identity preserved. The target gained
199 rows (1,574 total) and two synthetic tenants; six of those rows are global
transaction-code definitions created by the existing nested fixture, not discovery.

Retain the original helpers, snapshots and failed log unchanged. Prepare a separate
private read-only post-audit under `.yellow/evidence/order448/` against the SAME
existing target, using the reviewed protected credential loader. No new server,
database, role, permission, migration, source change or execution retry is admitted.

The audit must reproduce the complete prior-row/catalogue/outside/companion checks,
match the exact retained after-snapshot and prove that all new direct tenant-owned
rows and role-permission joins belong only to the two newly created synthetic
tenants. Every other global table remains byte-identical except precisely the six
new tx_code rows already observed. Each new tenant must own exactly one fresh
O434 revenue code and one N434 CGST/SGST pair through its own tx_code_route and
account roles, with the exact fixture-defined column values, unique code identity
and no references from another tenant/property. Hash those complete rows and match
the six exact additions in the retained canonical row-multiset snapshot. Do not
allow arbitrary tx_code additions or exclude the whole table from preservation.

This records a missed fixture-side effect in the pre-registered helper, not a
retroactive claim that the original wrapper passed. Read-only follow-up evidence
may establish containment of the already executed synthetic fixture and the API's
separate zero-mutation assertion. No deletion or financial correction is needed or
authorized. The original application test must not be rerun merely to obtain green.

Root reads the full new helper before separately executing the post-audit. Record
both original failure and narrowly bounded follow-up evidence in Order448 review.

## Read-only post-audit source-pin correction

Root's first Q229 attempt, `20260908-030640-801-883e2f49`, stopped before
ownership SQL at the exact retained-after snapshot hash check. Preserve its private
Audit.log (SHA256 `acf60e94e0cb0d5a4fe11a54498f7aaf747ed488c2e3345c0b31eaca4ffc1ba5`)
and newly captured snapshot unchanged; this attempt is not a completed post-audit.

Root compared all fields, and a separate read-only file comparison reproduced the
same result: only `sourceHashes.tests/build-readiness.integration.test.ts` changed
from `90adfcd28ff86c1189a31e6133710f206dfab3d63febff553330b554cf52b3b5`
to the reviewed Q230 test hash
`59f514585a85dadff462bacd3d40066c9f422dc0b02225085e1442b7fe0385e7`.
Every database, row, catalogue, ledger, companion and outside-state field is exact.

Admit only that explicit source-pin substitution when constructing the expected
current snapshot. Pin its complete bytes to
`ee35062228047f656400e54ec2c62a2d5d061f67324f451ff5134cabbc814120`;
retain the original before/after evidence hashes and all existing database checks.
The checker must reject every other difference and report both source hashes in its
new evidence. No database state is rebaselined, and no API test is rerun. Root reads
the narrow checker change before a separate read-only execution; this admission
does not claim that the revised post-audit has passed.

The second read-only attempt031155-750-735fa68f reached the six-code selector after
complete live-row hashing, then failed because Bun bound a JavaScript array as a
comma-separated scalar rather than PostgreSQL text[]. Root changed only the two
read-only array selectors to bound JSON strings expanded by
jsonb_array_elements_text. The exact six hash/code sets and every preservation
check remain unchanged. Retain this failed log; no fixture/test/database write or
source-baseline reset occurred. A separate root read-only execution is admitted.
