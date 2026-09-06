# Yellow schema guide

This guide explains what Yellow's table and migration counts mean, where the schema is
defined and how to inspect an existing database without changing it. It records source
state as of 2026-09-06; always pair a count with an exact Git commit and database
migration frontier.

## Current source lines

| Source line | Exact commit | Migration files / applied rows | Public base tables | Evidence and status |
|---|---|---:|---:|---|
| Reviewed `main` | [`443e3826b47025106d1829fcbb406ce6302fbbba`](https://github.com/dcpnode-maker/yellow/commit/443e3826b47025106d1829fcbb406ce6302fbbba) | 77 | 127 | [PR83](https://github.com/dcpnode-maker/yellow/pull/83) merged reviewed source `92346674`. All five jobs passed in [CI178](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811): deployment acceptance23/23, exact normalized schema and referee11/11. |
| Earlier operational baseline | [`5879e2b719db18077e00556477ba34bdb9b9991c`](https://github.com/dcpnode-maker/yellow/commit/5879e2b719db18077e00556477ba34bdb9b9991c) | 75 | 125 | Historical PR82 release, including `schema_migration`. Its five main CI jobs passed in [CI33987884230](https://github.com/dcpnode-maker/yellow/actions/runs/33987884230). |

These rows describe accepted source frontiers. Subsequent mainb5ef708/PR85 keeps
the same77/127 frontier. The current main checkout expects
77 migrations and 127 tables. A retained runtime still requires its own exact-SHA,
applied-ledger and health evidence; a source merge does not migrate it automatically.

**Unmerged Q201 candidate:** canonical
`0078_fiscal_submission_durability.sql` adds one protected
`fiscal_submission_history` table and nullable typed delivery fields to the
existing submission head. Its actual runner-backed catalogue is78 migrations,
128 public tables,118 RLS tables/policies,27 FORCE-RLS tables and2 views.
The regenerated candidate snapshot has SHA256
`dab3a27ac463e4565ac033eaafcbc5004732dc65a096fd182dd8d8e43ba03705`.
No existing1–77 migration is rewritten and no historical submission is invented
or backfilled. Candidate catalogue, independent approval, main and local runtime
are separate states; local remains77. See[Q201](../handoff/questions/201-canonical-fiscal-submission-integration.md).

**Current unmerged Q205 correction:** migration79 reuses that immutable history
for request/retry receipts and introduces one owner-private projection function;
there is no new table, financial write or history backfill. Current candidate is
79 migrations/128 tables, with unchanged RLS/table counts. The78 snapshot hash
above is historical, not the current79 snapshot. Independent real78→79 receipt
proof passes; new combined-source CI and merge are pending. Main/local remain77.

CI history remains visible: [CI175](https://github.com/dcpnode-maker/yellow/actions/runs/33991882050)
failed on the old125-table financial expectation; [CI176](https://github.com/dcpnode-maker/yellow/actions/runs/33992123191)
passed the native suites but failed four old deployment-shape assertions. Exact
canonical expectation repairs preserved the financial, permission and RLS checks.
CI177 was cancelled when the same source's PR run superseded it; CI178 then passed.
These were test-oracle drift failures, not evidence that a released hotel database
was lost or corrupted.

## What 80, 81, 125 and 127 count

These numbers are compatible because they measure different schema frontiers:

| Count | Exact meaning |
|---:|---|
| 80 | Application tables declared by the immutable baseline file [`migrations/0001_init.sql`](../migrations/0001_init.sql). It is a historical source count. |
| 81 | Those 80 baseline tables plus `public.schema_migration`, which [`scripts/migrate.ts`](../scripts/migrate.ts) creates before it applies numbered migrations. This is the historical runner-backed Phase-0 catalogue, not today's census. |
| 125 | Earlier reviewed main5879e2b7 after migrations 1–75: 124 tables declared across the numbered migrations plus the runner ledger. |
| 127 | Current reviewed main443e3826 after migrations 1–77: the earlier catalogue plus two tables added by migration76. Migration77 adds functions and other schema objects but no table. |

One migration can add no table, one table or several tables. The migration number,
number of applied migrations and number of tables therefore are not interchangeable.
Migration75 is part of `main` even though it does not add a table. In current main,
`0076_india_native_fiscal_source_evidence.sql` adds
`india_gst_accommodation_ordinary_regime_evidence` and
`india_gst_native_invoice_timing`; `0077_india_native_fiscal_source_completion.sql`
adds no table.

In this guide, **public base tables** means the rows returned by
`pg_catalog.pg_tables` where `schemaname = 'public'`. The count includes
`public.schema_migration`. It excludes views, materialized views, sequences, indexes,
functions, triggers, types, extensions and objects in PostgreSQL system schemas. When
another document uses a number with a different scope, it must name that scope.

## Where table definitions live

The executable schema is the ordered result of three layers:

1. [`migrations/0001_init.sql`](../migrations/0001_init.sql) defines the immutable
   80-table application baseline and its original constraints, indexes, policies and
   functions.
2. Later files in [`migrations/`](../migrations) change that baseline forward only.
   A table's current definition can therefore include its original `CREATE TABLE` and
   later `ALTER TABLE`, constraint, index, policy, trigger or function statements.
3. [`scripts/migrate.ts`](../scripts/migrate.ts) owns the separate
   `public.schema_migration` ledger. It validates the immutable baseline checksum,
   ordered filenames and recorded checksums before applying pending files.

[`tests/schema/expected.sql`](../tests/schema/expected.sql) is the normalized PostgreSQL
16 acceptance snapshot for the source line (currently the unmerged Q201 candidate).
It is derived evidence of the
whole resulting catalogue, not an input that can create migration authority. The
catalogue assertions in [`tests/database-acceptance.integration.test.ts`](../tests/database-acceptance.integration.test.ts)
and the setup scripts bind counts to a particular accepted frontier.

To locate a table's history in source, search all migrations rather than only the
baseline. For example:

```bash
rg -n 'CREATE TABLE .*reservation|ALTER TABLE .*reservation' migrations
```

For a quick source inventory, the following returns 80 on the immutable baseline and
126 across migrations 1–77 on current reviewed `main`:

```bash
rg -c '^CREATE TABLE ' migrations/0001_init.sql
rg '^CREATE TABLE ' migrations/*.sql | wc -l
```

This lexical inventory explains the arithmetic; the executed PostgreSQL catalogue is
the authority for an installed database.

## Read-only database inspection

Run these statements only through an already approved read-capable deployment or
database-administration session. Yellow deliberately denies the runtime application
role access to `schema_migration`. Do not add a grant, reuse application credentials or
change roles merely to inspect the ledger.

```sql
SELECT
  current_database() AS database_name,
  (SELECT count(*)::integer
     FROM pg_catalog.pg_tables
    WHERE schemaname = 'public') AS public_base_tables,
  (SELECT count(*)::integer
     FROM public.schema_migration) AS applied_migrations,
  (SELECT max(version)::integer
     FROM public.schema_migration) AS highest_applied_version;
```

Count and highest version should both be reported. Equal values show a contiguous
1-through-frontier ledger in today's repository; they are conceptually different and
should not be assumed equal for an unknown database. Inspect the exact applied files
and checksums with another read-only query:

```sql
SELECT version, filename, checksum_sha256, applied_at
  FROM public.schema_migration
 ORDER BY version;
```

For an already running, intended local Compose project, the first query can be issued
without exposing the protected password:

```bash
docker compose exec -T postgres \
  psql -U yellow_deploy -d yellow_dev -v ON_ERROR_STOP=1 \
  -c "SELECT (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname='public') AS public_base_tables, (SELECT count(*)::int FROM public.schema_migration) AS applied_migrations, (SELECT max(version)::int FROM public.schema_migration) AS highest_applied_version;"
```

That command is read-only. By contrast, `./setup.sh --db-only` and `setup.ps1 -DbOnly`
provision authority, start services, apply migrations to development data, drop and
recreate `yellow_test`, load a fixture and run the referee. Do not invoke setup merely
to answer a count question, and never point it at data that must be preserved.

## Changing the schema safely

Applied migration files, especially `0001_init.sql`, remain immutable. New schema work
requires its own scoped order, the next admitted forward migration, derived catalogue
updates, fresh and upgrade proof, exact count evidence and the required independent
review. Documentation of a candidate does not satisfy those gates.

Keep each assertion branch-specific. When a schema lineage is accepted, update its
setup count, normalized schema snapshot, database acceptance tests, readiness frontier
and documentation together from executed PostgreSQL evidence. Never delete a table,
rewrite an applied migration or weaken an oracle to make an old number match.
