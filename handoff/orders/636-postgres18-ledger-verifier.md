# Order 636 — PostgreSQL 18 ledger verifier compatibility

## Scope

- `scripts/migrate.ts`
- `handoff/LEDGER.md`

## Problem

Fresh PostgreSQL 18 databases expose column `NOT NULL` entries in `pg_constraint`
with `contype = 'n'`. Yellow's migration ledger verifier already validates column
nullability through `pg_attribute.attnotnull`, then compares the remaining
constraint contract exactly. On PostgreSQL 18 the extra `n` rows make a valid fresh
ledger fail before any application migrations can run.

## Acceptance

- Preserve exact validation of the `schema_migration` columns.
- Preserve exact validation of the CHECK, PRIMARY KEY and UNIQUE constraints.
- Ignore PostgreSQL 18's redundant `NOT NULL` constraint rows in the constraint
  comparison.
- Prove a fresh PostgreSQL 18 database can run migrations far enough for Order 635
  governed housekeeping proof.
