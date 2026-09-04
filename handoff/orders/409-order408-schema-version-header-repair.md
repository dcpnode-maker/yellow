# Order 409 — Order408 schema version-header repair

**Status:** ACTIVE — D1214
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** Order408 reviewed candidate `fabf41e`
**Risk tier:** 3 review repair — schema proof for financial/statutory change
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair only D1213's two informational `pg_dump` version-header lines so the committed
normalized snapshot is byte-exact to the repository's accepted official upstream
PostgreSQL 16.15 toolchain. The schema body and every product, migration, authority,
test assertion and runtime byte remain frozen.

## Exact scope

- `tests/schema/expected.sql`: replace only the two Ubuntu-decorated version headers
  with the exact upstream `16.15` headers;
- this order, Order408 status, its fresh review, `DECISIONS.log` and
  `handoff/LEDGER.md`.

## Required proof

Two-line cached diff; exact normalized schema equality on fresh upstream PostgreSQL
16.15; all Order408 D1213 reviewer-personal gates, adjacencies and a different fresh
Tier-3 review.

## Forbidden

No schema body, migration, product, test logic, dependency, database/local app,
deployment, merge, push, Phase or application-completion change.
