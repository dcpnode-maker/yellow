# Review — Order 616 PostgreSQL 18 migration-runner compatibility

Reviewer: `/root/pg18_group_block_review`

Status: approved

Scope reviewed:

- `scripts/migrate.ts` now filters `pg_constraint` with `contype <> 'n'` while validating `public.schema_migration`.
- The expected ledger contract remains the two CHECK constraints, primary key on `version`, and unique constraint on `filename`.
- PostgreSQL 18 exposes NOT NULL constraints as `contype = 'n'`; ignoring those catalog-visible not-null rows keeps the explicit contract strict without rejecting PG18.

Reviewer proof:

- Inspected the migration-runner diff.
- Ran an isolated PostgreSQL 18 proof with:
  - `COMPOSE_PROJECT_NAME=yellow-pg18-review`
  - `YELLOW_POSTGRES_PORT=55442`
  - `YELLOW_VALKEY_PORT=6489`
  - `YELLOW_APP_PORT=3100`
  - `.\setup.ps1 -DbOnly`
- Result: migrations applied on PostgreSQL 18, seed loaded, invariant referee `11 passed, 0 failed`.
- Direct catalog check showed `contype = 'n'` rows for NOT NULL columns and the four non-`n` constraints exactly matching the expected two CHECKs, PK, and UNIQUE.

Cleanup:

- Root removed the isolated review Compose project and its disposable PG18 volume with `docker compose -p yellow-pg18-review down -v`.
