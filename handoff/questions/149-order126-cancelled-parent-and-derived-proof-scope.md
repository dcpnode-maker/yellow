# Question 149 — Order-126 cancelled segment and derived proof scope

**Status:** RESOLVED BY D-390 — CORRECTION READY
**Order:** 126 · occupancy caller tenant binding
**Branch:** `phase-5/occupancy-caller-tenant-binding-approved-final`
**Approved Base:** `3e387eb6139621354cd7bc5e87370aee0f312b92`
**Admission:** `977196f47f30af780d4e2f0881e7440993ad8120`
**Stopped executable:** `9c1284a1e6e22ff9b7d94450ffe8c626f52b8d41`
**Related decisions:** D-377, D-383, D-386, D-388, D-389, D-390

## Static-review stop

The coordinator reported an independent static-review stop before Order 126 builder
evidence. The stopped executable is not review-ready and none of its passing builder
commands is approval evidence. Two product/proof defects and one omitted derived-proof
path are exact.

### 1. Cancelled reservation segments remain accepted

`migrations/0014_bind_occupancy_caller_tenant.sql:107` currently admits:

```sql
AND rs.status IN ('booked', 'in_house', 'cancelled')
```

That contradicts D-383's final strict rule. Approved Order 144 restores the locked
cancelled segment parent to exact live `booked` status transaction-locally before the
occupancy claim; rollback and concurrency restore it to cancelled with zero claim.
After that predecessor, a standalone `cancelled` segment is stale and cannot authorize
new occupancy. Accepting it would bypass the approved lifecycle sequencing rather than
preserve compatibility.

The focused file has no cancelled-parent canary. Its only valid segment fixture is
created as `booked` at
`tests/occupancy-caller-tenant.integration.test.ts:195-198`; the invalid-parent matrix
tests inactive/released holds, unknown ids and wrong kinds, but never a same-tenant,
otherwise exact cancelled segment.

The correction remains inside the four admitted implementation paths:

1. first add an exact same-tenant cancelled-segment test to
   `tests/occupancy-caller-tenant.integration.test.ts` and prove the stopped migration
   returns success/creates occupancy, so the test is red for the intended reason;
2. change migration 0014's segment predicate to only `booked` and `in_house`; and
3. require exact `P0003`, zero before/after occupancy, and an unchanged cancelled
   parent, without weakening tenant, typed-parent, rollback or race assertions.

The stopped candidate has not been integrated or applied to a shared product database,
so this is correction of the unapproved forward migration, not mutation of an applied
migration.

### 2. Exact schema mirror was omitted from scope

`tests/schema/expected.sql` remains byte-identical to the approved Base at blob
`04db66de80c8437bf0760b943f8eed6950dbf5a9`. Its
`record_occupancy` definition at lines 171–220 still writes caller-selected `p_tenant`
without authority or typed-parent validation, and its `release_occupancy` definition
at lines 227–239 still performs the old direct delete. Migration 0014 replaces both
function bodies, so the required exact schema-drift gate deterministically cannot match
this pre-0014 snapshot.

Order 126 requires exact schema drift but did not admit the generated mirror. This is
the same mechanical scope omission resolved for Order 77 by Question 126. The minimal
new path is exactly:

- `tests/schema/expected.sql`, regenerated from a fresh disposable database migrated
  through the final corrected 0014, with an inspected diff limited to the two existing
  function bodies. Function signatures, owner, safe search paths and ACLs must remain
  exact; no unrelated schema text may change.

### 3. Deployment acceptance ledger was omitted from scope

`tests/database-acceptance.integration.test.ts:7-73` hardcodes
`EXPECTED_MIGRATIONS` through version 13, then equality-checks the complete ordered
`public.schema_migration` ledger at lines 102–111. Any legitimate 0014 entry therefore
makes the required acceptance gate fail even if the migration is otherwise correct.
The minimal second new path is exactly:

- `tests/database-acceptance.integration.test.ts`, changed only to append version 14,
  filename `0014_bind_occupancy_caller_tenant.sql`, and the final corrected file's raw
  SHA-256. All six deployment/role/ownership/seed assertions remain unchanged.

A repository search for the 0013 filename, fixed migration counts/manifests,
`EXPECTED_MIGRATIONS`, version-14 expectations and the new 0014 filename found no
other product/proof path requiring correction. The version-12 and version-13 focused
tests in `app-role-nonlogin.integration.test.ts`,
`business-day-seal-authority.integration.test.ts`, and
`migrate.integration.test.ts` inspect those individual migrations rather than assert
that the complete ledger ends there. The schema generator and migration runner discover
the new migration dynamically. No third scope path is justified by this audit.

## Existing strict fixtures remain necessary and immutable

The scope correction does not remove or revert the two strict-compatibility fixture
blobs already admitted by D-389:

- approved-Base availability blob `702320f...` directly records a fabricated
  `segment` plus `hold` slots with no authoritative parents. Final blob
  `e3c849d938770f4e2a19d2c8f62963080d93026a` adds the exact booked
  reservation-segment and active-hold parents/cleanup required for strict 0014 and the
  unchanged 6/6 assertions;
- approved-Base composite segment blob `4671648...` directly records an arbitrary
  `oooSlot` with no `ooo_oos` parent. Final blob
  `e4f8640f43b1466a9fa02e551eac6fc2757bcaca` is exactly nine additions and zero
  deletions: it creates and removes that exact typed OOO parent while preserving all
  approved Order-143 content and the unchanged 7/7 assertions.

Reverting either file would deterministically restore a strict-parent `P0003` fixture
failure. D-390 therefore retains both exact blobs in the six-path final composition but
permits no further correction edit to either file.

## Evidence preserved before the stop

The exact approved-base 0013 database reproduced hostile app-role record/release:
tenant-B hostile occupancy changed 0→1 and its victim changed 1→0, while direct DML
remained `42501`, PUBLIC execute remained false, app role remained NOLOGIN and both
search paths remained safe.

On stopped executable `9c1284a` before the cancelled-parent finding was known:

```text
strict focused tenant/typed-parent paths    5 green; first 50-client run timed out
exact fresh 50-client rerun                 1/1 in 397.83 ms
availability projection                    6/6
Order-143 composite segment changes        7/7
Order-144 lifecycle                        6/6
Order-145 operational/security fixtures    7/7 + 3/3
reservation commit / HTTP                  5/5 + 5/5
Order-129 initial parents                  7/7
fixture-seeded holds / inventory           9/9 + 6/6
unique-prefix phase matrix                 19/19
Windows unchanged migration suite          16/17; known symlink-only EPERM
native-WSL migration restart               stopped after 15 green cases on this ruling
acceptance / schema / referee / standing   not run or not claimed
```

One parallel setup attempt encountered PostgreSQL `tuple concurrently updated` while
two fresh databases altered the same cluster role; serial continuation applied
0012–0014 successfully. Initial holds/inventory attempts used the wrong seed path;
fresh databases loaded with the canonical test fixture passed. These setup results are
disclosed and are not product failures.

All `yellow_o126f_*`, automatic matrix and completed `yellow_migrate_*` databases were
removed. The interrupted WSL process left one exact generated `yellow_migrate_*`
database, which was also verified and removed. The shared PostgreSQL/Valkey stack was
not stopped or reconfigured.

## D-390 ruling and required sequence

D-390 re-admits the existing Order 126 correction without a predecessor order. Before
any further product/proof edit, its governance commit must:

1. commit a governance amendment that records the stopped `9c1284a` as historical,
   changes status to correction-ready, and adds exactly
   `tests/schema/expected.sql` and
   `tests/database-acceptance.integration.test.ts` to the existing four implementation
   paths;
2. record D-390 in that governance commit;
3. commit the cancelled-parent canary red against the stopped migration;
4. correct migration 0014, then append its exact final raw SHA-256 to the acceptance
   manifest and regenerate the schema mirror from a fresh corrected-0014 database;
5. machine-prove the acceptance diff is one appended ledger object and the schema diff
   contains only the two authorized function bodies; and
6. restart P0–P4 from the exact approved Base on one new immutable executable. Reuse no
   stopped-candidate green result as final evidence, and obtain fresh independent
   non-implementing Tier-3 review.

The final composition is exactly six paths: the four originally admitted implementation
paths plus the schema mirror and acceptance manifest. Correction edits are limited to
migration 0014, its focused test, the schema mirror and the acceptance manifest; the
availability and segment fixture blobs above remain immutable.

Do not change production source, relax another parent rule, claim BUILT-UNREVIEWED,
merge, push, deploy or close the Cyber occurrence until the governance amendment is
committed and the complete corrected proof is green.

## RESOLVED

Resolved by D-390 and its exact six-path correction sequence.
