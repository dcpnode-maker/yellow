# Independent Tier-3 review — Order 126 occupancy caller tenant binding

**Verdict:** APPROVED

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

**Approved Base:** `3e387eb6139621354cd7bc5e87370aee0f312b92`

**Cancelled-parent red:** `a6df5e22361c0df287f4aa55809c27ce7e9b457b`

**Corrected executable:** `16b48bdfb559dcc9ce0a417a427f3cc5b5d6b1fb`

**Builder-evidence head:** `af12217b2a4bdc0168f5c021dcb3ce658dff9581`

No implementation, tenancy, typed-parent, occupancy, rollback, concurrency, migration,
schema, ACL, scope, provenance, protected-file or proof-strength finding remains.
Approval is limited to Order 126 and occurrence `occ_2f4ca8c2e6f1d7352ba849c8`. It does
not approve Order 127, merge, push, deploy, claim a live mutation or close any sibling
Cyber occurrence.

## Identity, scope and immutable composition

The reviewer verified the exact ancestry
`3e387eb -> dd2a0de -> a6df5e2 -> 16b48bd -> e263c6d -> af12217` and a clean
worktree. Base-to-evidence contains exactly six implementation paths and the four
admitted governance paths. Question 149 was initially absent from the order's
governance allowlist; the reviewer stopped before database execution and independently
verified metadata-only commit `e263c6dd6366139386fa58498be9702ac4a476d5`
added exactly that path before builder evidence.

Final implementation blobs are:

```text
a9cee230b9ae339e21c87a6f917c39c28ff909ef  migrations/0014_bind_occupancy_caller_tenant.sql
fb557f8db1105a9689450ba6971ae56749850012  tests/occupancy-caller-tenant.integration.test.ts
e3c849d938770f4e2a19d2c8f62963080d93026a  tests/availability-projection.integration.test.ts
e4f8640f43b1466a9fa02e551eac6fc2757bcaca  tests/reservation-segment-changes.integration.test.ts
3137c9048713f295fa3aac314fa835b497093fd0  tests/schema/expected.sql
188e4146b6751acc01643d03279571841ec455b5  tests/database-acceptance.integration.test.ts
```

Availability and composite-segment fixture blobs remain exact to D-390. Migration
0014 is the sole next migration, contains only the two authorized replacement
functions, and its raw SHA-256 is
`706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a`.
The acceptance change is one appended version-14 object carrying that checksum. The
schema delta is confined to the existing record/release bodies. `git diff --check`
passed.

## P0 — independently reproduced reds

On a fresh database migrated from exact Base through 0013, the reviewer ran only the
hostile focused case under app-role tenant-A context. It failed green expectations for
the intended reason: tenant-B hostile occupancy changed `0 -> 1`, its victim changed
`1 -> 0`, and record/release returned without `42501`. Direct occupancy DML still
returned `42501`; PUBLIC execution remained false; app-role remained NOLOGIN; and both
function search paths remained safe.

On a separate fresh database migrated from exact red `a6df5e2`, the cancelled-parent
canary also failed for the intended reason: an otherwise exact cancelled segment
returned success and occupancy changed `0 -> 1` while its parent stayed cancelled.
Both red databases and detached worktrees were removed before corrected proof.

## P1-P2 — strict green and affected behavior

Fresh corrected focused proof passed 7/7. It covered hostile cross-tenant record and
release with exact `42501` and zero mutation; missing/mismatched authority; invalid,
unknown, wrong-kind and stale typed parents; empty/unbounded periods; the permanent
cancelled-segment `P0003`/zero-mutation canary; exact legitimate release; mixed-mode
exclusion; a 50-client exclusive race with one winner; and a 40-client positional race
with six winners.

Every affected suite ran on a fresh isolated database:

```text
availability projection              6/6    45 assertions
reservation segment changes          7/7   115 assertions
reservation lifecycle                6/6    65 assertions
operational blocks                    7/7    43 assertions
security-definer containment          3/3    22 assertions
reservation commit                    5/5   106 assertions
reservation commit HTTP               5/5    61 assertions
Order-129 reservation parents         7/7    45 assertions
fixture-seeded holds                  9/9    32 assertions
fixture-seeded inventory              6/6    30 assertions
```

This preserved parent-before-claim ordering, lifecycle restore, OOO behavior,
publication rollback, exact retries, exclusion truth, tenant isolation and all
registered concurrency winners without assertion weakening.

## P3 — migration, catalogue and exact schema

On a fresh migrated/seeded database, ledger versions 11-14 and checksums were exact.
Catalogue inspection found one overload each for record/release, both owned by
`yellow`, SECURITY DEFINER, with exact
`search_path=pg_catalog, public, pg_temp`. App-role retains only intended EXECUTE,
PUBLIC has none, and app-role is NOLOGIN, non-superuser, non-BYPASSRLS, has zero
memberships and no INSERT/UPDATE/DELETE on `space_occupancy`. There are 85 public
tables and neither function body contains `cancelled`.

Fresh deployment acceptance passed 6/6 with 13 assertions and exact version-14
ledger. Schema drift matched `tests/schema/expected.sql` byte-for-byte. Protected
typed-parent proof passed 5/5 with 58 assertions, including its embedded referee
11/11. A separate app-never-started migrated/fixture-seeded database independently
reported 85 tables, 75 RLS tables, 75 policy-covered tables and referee
`11 passed, 0 failed of 11`.

## P4 — cumulative, migration and standing gates

A reviewer-local serial runner remapped all cumulative databases to unique
`yellow_o126f_review_mNN` names. It migrated each through corrected 0014, ran the
registered suite with mandatory environment variables, and dropped it immediately.
Result: 19/19. Order-069 P8 passed in 9.509 seconds.

The unchanged migration suite ran under native WSL so the symlink proof executed on a
supported filesystem: 17/17 with 95 assertions. Final gates passed:

```text
bun install --frozen-lockfile   23 installs, no changes
bun test                        174 pass / 429 skip / 0 fail, 1,983 assertions
typecheck                       PASS
import boundaries               PASS, 64 TypeScript files
licence policy                  PASS, 23 packages
bun audit                       PASS, no vulnerabilities
container image pins            4/4, 7 assertions
```

Protected SHA-256 values independently recomputed:

```text
fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923  migrations/0001_init.sql
2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d  tests/run_invariants.py
bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62  tests/seed_fixture.sql
```

## Reviewer command corrections and cleanup

Three environment/harness mistakes are disclosed rather than counted as product
results:

- an initial local `docker compose up` found port 5442 already owned by the healthy
  shared stack; only newly created stopped empty containers/network/volume resulted,
  and the reviewer removed those exact artifacts before using the shared stack;
- a catalogue command attempted to cast its output alias in `ORDER BY`, so psql
  stopped before the remaining catalogue assertions; the corrected query passed;
- schema check initially selected the current worktree's stopped Compose project;
  selecting the already-running shared project made the unchanged gate pass.

Every `yellow_o126f_*` and `yellow_migrate_*` reviewer database was removed, as were
both detached reviewer worktrees. The shared PostgreSQL/Valkey stack was retained for
coordinator cleanup, and no app container was started.
