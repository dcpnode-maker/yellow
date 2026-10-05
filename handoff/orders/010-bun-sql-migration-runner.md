# ORDER 010 — Bun SQL migration runner

**Phase:** 0 · **Branch:** `phase-0/bun-sql-migration-runner`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 3

## Goal

Apply immutable numbered SQL migrations exactly once through a connection-affine,
checksummed, serialized Bun SQL runner.

## Why now

Phase 0 cannot prove a production-shaped fresh database until the repository has a
real runner. D-73 resolves the tracking table, lock, atomicity, checksum, privilege,
and failure semantics after Claude's position and OpenAI's challenge.

Start from the reviewed Order 009 head.

## Scope — files Codex may create or change

- `scripts/migrate.ts`
- `tests/migrate.integration.test.ts`
- `package.json`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

`migrations/0001_init.sql` is read-only input and is explicitly not in Scope. No new
migration file is authorized by this order.

## Contracts to honour

- `PROJECT.md` — migration standards and immutable baseline
- `DECISIONS.log` — D-16 and D-73
- `handoff/questions/007-ARCHITECT-RESPONSE.md` — Decision B position
- `handoff/questions/008-ARCHITECT-RESPONSE.md` — Gate 2 adjudication
- Bun 1.3.14 `SQL.reserve()`, transactions, and `unsafe()`
- PostgreSQL 16 session advisory locks and transactional DDL

## Public runner contract

`scripts/migrate.ts` must:

- export a testable `runMigrations({ databaseUrl, migrationsDirectory })` function;
- run as a CLI only when invoked directly;
- require `DATABASE_URL` for the CLI;
- default the directory to repository `migrations/`, with a test-only explicit
  override argument/environment accepted by the exported function;
- print one deterministic line per applied file and a final applied/no-op summary;
- redact credentials from every error and log line; preserve PostgreSQL SQLSTATE from
  Bun's `PostgresError.errno` when present (`code` is Bun's generic error code);
- return/exit nonzero on every validation or database failure.

Add package script `db:migrate` and a dedicated integration script
`test:db:migrate`. The integration test may be skipped by the default `bun test` only
when its explicit admin-test URL is absent; the dedicated script must never skip.

## File discovery and integrity

1. Read regular files only; reject symlinks.
2. Every `.sql` basename must match
   `^[0-9]{4}_[a-z0-9][a-z0-9_-]*\.sql$`.
3. Parse the four-digit prefix as `version`; sort numerically and then by filename.
4. Reject version `0000` and duplicate numeric versions. Numeric gaps are allowed.
5. Read each file once into an immutable in-memory record, reject a UTF-8 BOM or
   invalid UTF-8, and hash those exact bytes with lowercase SHA-256 hex before opening
   a file transaction. Execute the decoded content from that same record; do not
   re-read the path after hashing.
6. Before any database mutation, require the baseline file to be named
   `0001_init.sql` and hash to
   `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.
7. Reject an applied version absent locally, filename disagreement for an applied
   version, or checksum disagreement. There is no force/repair/ignore flag.

## Connection and lock contract

1. Open the Bun SQL pool and immediately reserve one connection.
2. Acquire `pg_advisory_lock(6441674055002974567)` on that connection before
   bootstrapping or reading migration history.
3. Hold the session lock across discovery validation, ledger validation, all pending
   files, and final validation.
4. Apply every file in its own explicit manual transaction on that same reserved
   connection: send `BEGIN`, execute, then `COMMIT`; on any error send `ROLLBACK`
   before rethrowing.
5. In `finally`, attempt `pg_advisory_unlock`, release the reservation, and close the
   pool. Connection death is also a valid lock release.

Do not use `pg_advisory_xact_lock`; it would release between files.

## Exact tracking table contract

Bootstrap deploy-owned, non-tenant metadata in `public`:

```sql
CREATE TABLE IF NOT EXISTS public.schema_migration (
  version bigint PRIMARY KEY CHECK (version BETWEEN 1 AND 9999),
  filename text NOT NULL UNIQUE,
  checksum_sha256 char(64) NOT NULL
    CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
```

The runner must validate that an existing table has exactly this column order/type/
nullability/default contract plus the declared checks, primary key, and filename
uniqueness; do not accept a same-named arbitrary table after `IF NOT EXISTS`.

Revoke all privileges from `PUBLIC`. If `app_role` exists, revoke all privileges from
it. Repeat the `app_role` revoke inside every file transaction after executing the SQL
and before recording the ledger row, because baseline 0001 grants on all then-existing
tables when it creates that role. Verify after migration that `app_role` has no table
privilege on `schema_migration`. Do not enable RLS on this platform metadata table.

## File transaction contract

For each pending file:

1. Send `BEGIN` through the reserved connection.
2. Capture and retain `pg_backend_pid()` for connection-affinity diagnostics.
3. Execute the complete exact text using Bun SQL's unsafe/raw multi-statement API.
4. Revoke `app_role` privileges as above when the role exists.
5. Insert the version, filename, and checksum ledger row.
6. Send `COMMIT`. On any error, send `ROLLBACK` on the same reservation and rethrow the
   original error. Prove the connection remains usable after rollback.

Do not call Bun 1.3.14 `reserved.begin(callback)`. Its callback-failure path was
executably observed to surface a caught rejection as a fatal process error. Manual
transaction control is required until a future reviewed Bun upgrade proves otherwise.

PostgreSQL is the parser. Do not add a keyword regex that claims to recognize every
nontransactional statement. A transaction-incompatible statement must fail loudly,
roll back all earlier statements in that file, and record nothing. There is no
nontransactional mode in Phase 0.

## Container tooling

- Add a non-runtime Docker target named `database-tools` containing Bun, `scripts/`,
  and `migrations/`.
- Keep the existing application runtime image free of migration SQL and tools.
- Remove only the `.dockerignore` rule that prevents the tools target from receiving
  `migrations/`; do not broaden unrelated build context.
- Add a Compose `migrate` service under profile `tools`, built from the
  `database-tools` target, depending on healthy `postgres`, and using a service-network
  `DATABASE_URL`.
- `docker compose --profile tools run --rm migrate` must run the migration CLI.

No production credential is committed. Compose credentials remain local development
values; deployments inject `DATABASE_URL` externally.

## Required real-PostgreSQL integration proofs

`tests/migrate.integration.test.ts` must create uniquely named temporary databases
through an explicit superuser/admin test URL and clean them up in `finally`. It must
never touch `yellow_dev` or `yellow_test` schema contents.

Run database cases serially within the file: PostgreSQL roles are cluster-global and
immutable baseline 0001 conditionally creates `app_role`, so parallel first-ever
baseline applications in different databases would test a cross-database role race
rather than this runner. The explicit two-runner concurrency case still runs both
processes against the same target database and lock.

Prove all of the following:

1. Empty database applies baseline once and records exactly one correct ledger row.
2. Second run is a no-op with no ledger mutation.
3. Baseline byte/hash mutation fails before database mutation.
4. Applied-file checksum mutation fails.
5. Duplicate versions, malformed filenames, symlinks, filename disagreement, and an
   applied version missing locally all fail closed.
6. Two concurrent runner processes serialize and apply every file once.
7. Both processes use the advisory-lock backend connection for file transactions
   (backend PID evidence).
8. A synthetic file that creates an object and then runs
   `CREATE INDEX CONCURRENTLY` fails; the earlier object and ledger row are absent.
9. Killing a child runner while it holds the session lock releases the lock; a second
   runner then completes.
10. `app_role` has no privilege on `schema_migration` after baseline application.
11. The table is owned by the migration connection's current user and has no RLS.
12. A caught file failure produces one controlled rejection without an unhandled Bun
    error; the reserved connection remains usable after explicit rollback, and an
    actual database error retains its SQLSTATE via `errno`.

Synthetic migration directories belong in OS temporary directories and must be
removed. Never edit/copy over the repository baseline in place.

## Definition of done

- [ ] All twelve migration proofs pass against PostgreSQL 16.
- [ ] `bun run db:migrate` works on a fresh target and is a no-op on repeat.
- [ ] The Compose tools service applies the same runner.
- [ ] The application image contains neither `migrations/` nor `scripts/migrate.ts`.
- [ ] `bun run typecheck`, default `bun test`, licence check, and audit pass.
- [ ] The full Python referee reports `11 passed, 0 failed of 11`.
- [ ] Baseline SHA-256 remains exactly the D-73 value.
- [ ] `git diff --check` is clean and only Scope files changed.

## Forbidden in this order

- Editing any file under `migrations/`.
- Running migrations as `app_role` or granting it ledger access.
- Tenant/RLS behavior, occupancy, journal, fiscal, state, event, or seed changes.
- Whole-set transactions, transaction-level advisory locks, force flags, down
  migrations, checksum repair, or a nontransactional escape hatch.
- Bun `reserved.begin(callback)` in migration or failure-test paths.
- Adding Drizzle, node-postgres, postgres.js, or any dependency; use Bun SQL.
- Implementing Orders 011–013.

## Review requirement

Tier 3. This order embodies the OpenAI cross-vendor challenge; Claude must inspect the
implementation and executable concurrency/failure proof independently before the
cumulative integration PR merges. A reviewer must compare the baseline hash directly.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
