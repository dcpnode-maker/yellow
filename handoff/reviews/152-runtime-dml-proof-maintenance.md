# Independent review — Order 152 runtime-DML proof maintenance

**Verdict:** APPROVED
**Reviewed candidate:** `62772c1d7df5119081c3f405677bc177d806ea58`
**Base:** `aff09155d68ad3f69cd0a119e24b79e7f876fc56`
**Reviewer:** OpenAI Codex, independent non-implementing reviewer
**Date:** 2026-08-25

## Independence and scope

I did not implement Order 152. I read `PROJECT.md`, ran `./state.sh`, read Order
152 and D-419, and applied the repository PostgreSQL review rules before executing
the proof.

The corrected candidate is a linear descendant of Base (`0` behind, `5` ahead).
The Base diff has eleven paths: the Order 152 record, the eight authorized executable
test paths, and the governance-only D-419 status corrections to Questions 163 and 164.
There is no production, migration, schema, dependency, grant, role or policy delta.

Commands:

```text
git rev-parse HEAD
git merge-base --is-ancestor aff09155d68ad3f69cd0a119e24b79e7f876fc56 HEAD
git rev-list --left-right --count aff09155d68ad3f69cd0a119e24b79e7f876fc56...HEAD
git diff --name-status aff09155d68ad3f69cd0a119e24b79e7f876fc56..HEAD
git diff --check aff09155d68ad3f69cd0a119e24b79e7f876fc56..HEAD
git diff --quiet aff09155d68ad3f69cd0a119e24b79e7f876fc56..HEAD -- migrations src package.json bun.lock
```

Results: exact SHA; ancestor exit `0`; counts `0 5`; exactly eleven paths described
above; empty diff-check; production/schema inputs byte-identical.

## Finding disposition

My initial static audit of superseded candidate `848e2f9` found that relay rollback
counted `fact_log.id` against event aggregate IDs after the fixture moved from `task`.
That oracle could not detect a leaked handler effect because the aggregate is stored
in `fact_log.entity_id`. The builder corrected only that predicate in `62772c1`.
I discarded all prior-candidate evidence and restarted this review from zero. The
corrected predicate executed in the full relay suite. No finding remains.

## Fresh isolated database proof

I used only the existing `yellow-o151-build-postgres-1` PostgreSQL 16 builder on port
5561. Credentials were loaded privately from the authorized environment file and
never printed. Each suite received distinct `yellow_deploy` and `yellow_runtime`
DSNs, a separately named fresh database, migrations 0001 through 0016, and its exact
required flag. Every database was force-dropped after its suite.

The repeated command shape was:

```text
docker exec yellow-o151-build-postgres-1 psql -U yellow_deploy -d postgres \
  -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS <fixed-review-db> WITH (FORCE)" \
  -c "CREATE DATABASE <fixed-review-db> OWNER yellow_deploy"
YELLOW_DEPLOY_DATABASE_URL=<private-deploy-dsn> bun run db:migrate
YELLOW_DEPLOY_DATABASE_URL=<private-deploy-dsn> \
YELLOW_RUNTIME_DATABASE_URL=<private-runtime-dsn> \
<suite-require-flag>=1 bun test <suite-file>
docker exec yellow-o151-build-postgres-1 psql -U yellow_deploy -d postgres \
  -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS <fixed-review-db> WITH (FORCE)"
```

An initial pre-suite connection attempt met transient cluster saturation
(`SQLSTATE 53300`) from a concurrent proof lane. It produced no migration or test
result. Once those clients exited, I restarted from a newly recreated database and
used only the complete results below.

| Fresh database suite | Result | Assertions |
|---|---:|---:|
| `tests/fact-log.integration.test.ts` | 4/4 | 16 |
| `tests/idempotency.integration.test.ts` | 6/6 | 44 |
| `tests/party-profiles.integration.test.ts` | 8/8 | 119 |
| `tests/outbox.integration.test.ts` | 7/7 | 24 |
| `tests/relay.integration.test.ts` | 19/19 | 130 |
| `tests/reservation-parent-before-occupancy.integration.test.ts` | 7/7 | 45 |
| `tests/reservation-lifecycle.integration.test.ts` | 6/6 | 65 |
| `tests/reservation-segment-changes.integration.test.ts` | 7/7 | 115 |
| **Total** | **64/64, 0 failed** | **558** |

The suites retained and executed parent sequencing, tenant isolation, rollback,
publication failure, crash/retry, tamper/settlement, concurrency and index-plan
proofs. Relay's corrected rollback predicate and its 10,000-row backlog proof both
executed green.

## Runtime authority and catalogue proof

On another fresh migration-0016 database I ran:

```text
YELLOW_RUNTIME_DML_URL=<private-deploy-dsn> \
YELLOW_DEPLOY_DATABASE_URL=<private-deploy-dsn> \
YELLOW_RUNTIME_DATABASE_URL=<private-runtime-dsn> \
YELLOW_REQUIRE_RUNTIME_DML=1 \
bun test tests/runtime-dml-authority.integration.test.ts
```

Result: `5 pass, 0 fail, 65 assertions`. The exact table/column mutation catalogue,
sequence/view/default ACLs, protected capabilities, hostile denials, source-owner map
and unauthorized-grant canary all passed. Combined with the byte-identical migration
and production inputs, this proves the Order-150 catalogue is unchanged by Order 152.

I also personally queried `has_table_privilege` and attempted the affected runtime
operations after transaction-local tenant context and `SET LOCAL ROLE app_role`.
Table-level INSERT/UPDATE/DELETE were all false for `api_idempotency`, `app_user`,
`sellable_unit` and `task`. The sellable-unit status update, all app_user/task DML,
and table-level idempotency INSERT/UPDATE/DELETE each returned exact SQLSTATE `42501`.

## Standing and static gates

```text
bun install --frozen-lockfile
bun run typecheck
bun test
bun run boundaries
bun run license-check
bun audit
```

Results:

- frozen install: exact lockfile, 23 packages installed, no tracked change;
- typecheck: pass;
- standing suite: `179 pass, 459 skip, 0 fail`, 2,106 assertions across 95 files;
- boundaries: 64 TypeScript files scanned, pass;
- license policy: 23 installed packages, pass;
- audit: no vulnerabilities found.

Final cleanup found no `yellow_o152_review_*` database. The candidate was clean before
review metadata was written. I did not start or stop containers, touch the workbench,
alter production/tests/migrations, merge, push or deploy.

## Verdict boundary

Order 152's corrected fixture/oracle maintenance is approved at exact executable
`62772c1d7df5119081c3f405677bc177d806ea58`. This approval does not close Order 150,
Order 151, any remaining authority debt, or the wider Cyber phase.
