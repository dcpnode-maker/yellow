---
name: yellow-postgres-patterns
description: MANDATORY for ANY SQL, migration, query, index, constraint, RLS policy, transaction code, or database access in the PMS. Use before writing DDL, before writing any query touching space_occupancy or financial tables, when adding indexes, when debugging concurrency or double-booking issues, and when working with PgBouncer, outbox, or Valkey caching. The concurrency correctness of the entire product lives in these patterns.
---

# PMS PostgreSQL Patterns

PostgreSQL 16 is the ONLY stateful system. Valkey/NATS/projections are derived and
disposable. If a pattern here conflicts with convenience, the pattern wins.

## 1. Occupancy: the claim-range design (P1 — proven under load)

Never reason "exclusive vs bed" in application code. Every occupancy row carries
`claim int4range`: exclusive = `[0,2147483647)`, bed at position p = `[p,p+1)`.
ONE constraint arbitrates everything:

```sql
EXCLUDE USING gist (tenant_id WITH =, space_id WITH =,
                    period WITH &&, claim WITH &&)
```

- Private-room sale vs 6 bed sales, bed vs same bed, room vs room — all the same
  overlap. The naive partial-constraint version (`WHERE exclusive`) FAILED stress test
  T2 (allowed a private sale to coexist with bed sales). Do not regress to it.
- Capacity is declarative: positions 0..capacity-1. No counter columns.
- Writes go ONLY through `record_occupancy()` / `release_occupancy()`
  (SECURITY DEFINER; direct INSERT is REVOKEd — expect 42501 in tests, that's correct).
- Advisory lock inside the function is a THROUGHPUT aid (orders waiters), not the
  correctness mechanism. The constraint is the truth. Measured: 1,409 commits/sec,
  50-thread race → exactly 1 winner.

## 2. Multi-tenancy: RLS that survives PgBouncer

- Every tenant table: `ENABLE ROW LEVEL SECURITY` + policy on
  `tenant_id = current_setting('app.tenant_id')::uuid`.
- Set context with `SELECT set_config('app.tenant_id', $1, true)` — the `true`
  (transaction-local) is what makes it safe under transaction-mode pooling. Session-mode
  `SET` leaks across pooled connections. Never use it.
- App connects as `pms_app` (non-superuser, no BYPASSRLS). Tests must include a
  cross-tenant read attempt that returns 0 rows.
- **VIEWS BYPASS RLS unless told otherwise.** A view runs with its OWNER's
  privileges by default, and owners skip row security — a plain `CREATE VIEW`
  is a cross-tenant leak (empirically proven on current_rate_price). Every view
  MUST carry `WITH (security_invoker = true)`; the §14 hardening loop enforces
  it on all public views, and the RLS smoke test must read through a view, not
  just tables.

## 3. Insert-only + bitemporal

- `posting_line`, `journal`, `space_occupancy`, `rate_price`, `fact_log`, `outbox`,
  `document`: no UPDATE/DELETE grants. Sanctioned updates are exactly two:
  `outbox.published_at` (relay) and `rate_price.superseded_by` (link, not mutate).
- Corrections = new rows: `journal.reverses_journal_id`, new rate_price superseding old.
- Bitemporal reads: "as of business time X, known at system time Y" → filter fact_log
  on both ranges. Views `current_rate_price` / `folio_balance` exist — use them.

## 4. Financial integrity

- `assert_journal_balanced` is a DEFERRABLE INITIALLY DEFERRED constraint trigger:
  post all lines of a journal in ONE transaction; balance is checked at COMMIT.
- Never post to a sealed day: `business_day` + `assert_day_open` trigger. Day close is
  `seal_business_day()` — continuous close, no blocking night audit.
- Money math in SQL: bigint only. Tax rounding per `tax_jurisdiction.rounding`
  (line vs document) — implement in one function, never inline.

## 5. Outbox + events

- Event write is IN the same transaction as the state change. Relay polls
  `WHERE published_at IS NULL ORDER BY seq` (partial index exists) every 100–250 ms.
  LISTEN/NOTIFY is forbidden as delivery (breaks under PgBouncer transaction mode);
  fine as a local wake-up hint only.
- Consumers dedupe on event `id`. Replay = re-read by `seq` (window = prune retention).
- Publishing churns dead tuples on the partial index: the table carries aggressive
  autovacuum storage params (don't remove them) and `prune_outbox()` runs nightly.
- Current-state reads on insert-only tables ALWAYS get a partial index
  `WHERE superseded_by IS NULL` (see rate_current_lookup / rate_current_contain) —
  history must never be in the hot path's way.

## 6. Index + query rules

- `tenant_id` leads every index. Then the range/entity column.
- GiST for ranges (occupancy, holds), GIN on JSONB only when you query with `@>`
  (JSONB `->>` equality does NOT use GIN — measured ~50,000× difference vs proper
  approach; hot predicates get real columns instead).
- Availability search reads the PROJECTION (`availability_projection` + Valkey),
  never the occupancy table. Truth is only consulted at hold/commit.
- Cursor pagination (`after` opaque cursor), never OFFSET.

## 7. Migrations

- Forward-only, numbered, each reversible by a compensating migration. Never edit an
  applied migration. Every migration runs in CI against a fresh DB + the RLS smoke test
  + `SCHEMA.sql` drift check (schema dump diff must be empty).
- Partition-ready ≠ partitioned: keep single tables until stats_daily or fact_log
  crosses ~50M rows/tenant-year; the keys are already shaped for it.
