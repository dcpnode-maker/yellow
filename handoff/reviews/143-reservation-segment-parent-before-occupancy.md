# Independent Tier-3 review — Order 143 segment parents before occupancy

**Verdict:** APPROVED

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

**Exact red:** `850c36d3815cc5f464bba0468d694c51d0662a7e`

**Exact corrected executable:** `4e06d4b7580e68af5a716a3bfb6d9ec93994e692`

**Builder evidence parent:** `cc4bdf1b075127f3c686145f1c184dac24cc6991`

**Approved base:** `a3c91bc410a4bcc943c57b5ae5d3b89e6a2c29d4`

No implementation, ordering, rollback, compatibility, occupancy, tenant-isolation,
scope, schema, protected-file or proof-strength finding was found. This approval is
limited to Order 143. It does not merge, push or deploy the branch, approve Order 126,
or close any Cyber finding.

## P0 — exact real-path red and rollback

The reviewer created a detached worktree at exact red `850c36d`, installed frozen
dependencies, freshly migrated `yellow_o143r_red`, and ran the guarded full segment
suite with `YELLOW_REQUIRE_RESERVATION_SEGMENTS=1`. Result: 1 passed, 6 failed and 19
assertions. Both static ordering observations were false and the two real public
commands raised exact test-only SQLSTATE `P0143`: changed departure attempted the new
period against the old parent, and room move attempted the new segment id before its
parent existed.

Direct database readback independently proved transactional rollback. Each affected
reservation retained exactly its one original segment and exact original occupancy
claim; no sequence-two/new-id parent or claim existed; and no segment-change/move
fact, outbox or idempotency result survived. Only setup's reservation-commit evidence
remained. The temporary exact-red database and detached worktree were removed.

## P1–P3 — ordering, compatibility, atomicity and concurrency

The reviewer inspected both production paths at the corrected executable:

- `changeDeparture` keeps validation and locking first, releases through inventory,
  compare-and-swap updates the exact locked segment period, then calls
  `claimForSegment` and verifies returned unit type and exact period before evidence;
- `moveRoom` keeps validation and locking first, releases the old claim, performs the
  inventory-owned read-only `prepareClaimForSegment` compatibility check, inserts the
  exact next-sequence in-house destination parent, and calls `claimForSegment`;
  acquisition independently re-resolves the now-visible parent before the old segment
  is departed and evidence is written.

The entire sequence remains inside the existing `PostgresIdempotency` transaction.
There is no reservation-owned occupancy DML, compensating cleanup, caller bypass or
new public request/result/event shape. The destination precheck preserves the existing
cross-type lifecycle error while acquisition still revalidates after parent insertion.

On fresh `yellow_o143r_segments`, the unchanged guarded suite passed 7/7 with 115
assertions. It observed exact parents for departure extension/shortening and room move;
proved occupied and out-of-order conflicts plus injected fact/outbox failures restore
parents, claims and evidence exactly; and passed twenty contenders, replay/conflict,
tenant/property/state/latest/stale/shape/clock, foreign/cross-type/composite/positional/
same-space and invalid-destination compatibility cases.

## P4 — least change and affected regressions

`git merge-base --is-ancestor` passed for Base → red → corrected executable → builder
evidence. Base-to-executable has exactly six paths: two implementation paths and four
admitted governance paths. The implementation blobs are:

```text
src/contexts/reservations/segments.ts                 8f46f1ad6ac19828017967c398e46e4645865ed8
tests/reservation-segment-changes.integration.test.ts 4671648a03407f97b7843e93a5b7898efba20e1b
```

There is no migration, schema, function, ACL, RLS, dependency, state or event change.
Fresh isolated affected results were:

```text
reservation segment changes  7/7   115 assertions
reservation commit           5/5   106 assertions
reservation HTTP commit      5/5    61 assertions
reservation lifecycle        5/5    62 assertions
holds                         9/9    32 assertions
inventory occupancy          6/6    30 assertions
Order-129 typed parents       7/7    45 assertions
```

## P5 — independent database and static gate

The reviewer ran `bun run test:phase3-gate` against the shared PostgreSQL service with
an isolated admin URL and reviewer password: 19/19 suites passed and the runner removed
all of its databases. Order-069 P8 passed in 10.203 seconds. The unchanged migration
suite passed 17/17 with 95 assertions under native WSL, including symlink safety. The
Windows run passed 16/17; only host `EPERM` while creating the test's temporary symlink
failed before product code.

Fresh migration/seed acceptance passed 6/6 with 13 assertions and exact schema drift.
A separate fresh protected typed-parent run passed 5/5 with 58 assertions, including
its embedded referee 11/11. A separately recreated, fixture-seeded, app-never-started
database passed `python tests/run_invariants.py` 11/11 with 85 public tables and 75/75
RLS tables/policies. The shared application container was never started.

Static and standing results:

```text
bun install --frozen-lockfile  23 packages, no change
bun test                       173 passed, 422 skipped, 0 failed, 1,982 assertions
typecheck                      PASS
import boundaries              PASS, 64 TypeScript files
licences                       PASS, 23 packages
bun audit                      PASS, no vulnerabilities
container image pins           PASS
```

Protected SHA-256 values recomputed by the reviewer:

```text
migrations/0001_init.sql  fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923
tests/run_invariants.py   2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d
tests/seed_fixture.sql    bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62
tests/schema/expected.sql a5ffe526138e0c87365f58bbf1f0a08f51f531418aefe6ebe414ffda7e51d59a
```

## Reviewer command corrections and cleanup

The reviewer disclosed and corrected four harness/setup mistakes rather than treating
them as product results: an initial nonexistent red workdir, omitted creation of the
red database before migration, omitted fixture seed on the first holds/inventory
attempts, and Windows console encoding on the first standalone-referee print. Repeating
the referee without recreating its database predictably found zero new TC-12.1 winners;
the reviewer discarded that contaminated repeat, recreated/migrated/seeded the database,
set UTF-8 output, and obtained the valid 11/11 result above. A later mistyped migration
script alias left a newly recreated database empty; schema creation was required to
succeed before the final seed/referee run.

All eleven exact `yellow_o143r_*` databases and every test-owned `yellow_migrate_*`
database were confirmed absent after forced cleanup. The shared PostgreSQL and Valkey
services were deliberately left healthy on ports 5442 and 6389 for coordinator cleanup.
