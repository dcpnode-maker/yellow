# Order 498 — DuckDB analytics runtime readiness

## Objective

Validate and prepare the project’s already-decided embedded DuckDB-on-Parquet
analytics path for fast, disposable management, market and RMS reporting without
creating a second PMS system of record.

## Scope

- Architecture, dependency, runtime and existing analytics-intake evidence only
- A bounded implementation recommendation and executable local readiness proof if
  the existing repository contracts support it
- `handoff/reviews/` and `handoff/LEDGER.md` evidence for this order

## Required behaviour

1. PostgreSQL remains the only authority for reservation state, availability,
   occupancy, financial journals, business date, and all operational writes.
2. DuckDB reads immutable or versioned Parquet extracts/projections only. It may
   power world-market, pickup, comp-set and dashboard analysis; it never accepts
   operator writes or makes sellability decisions.
3. The design specifies source lineage, tenant/property isolation, refresh,
   invalidation, bounded disk/temp use, failure behaviour and how a stale analytical
   result is visibly identified.
4. The result distinguishes the existing Order472 discovery intake from a production
   analytics runtime; no third-party data import or provider activation occurs.

## Exclusions

- No change to PostgreSQL authority, availability/occupancy, finance, PMS actions,
  migrations, external connector activation, data ingestion, credentials or public
  deployment.
- No Redis/Valkey replacement and no ClickHouse deployment.
