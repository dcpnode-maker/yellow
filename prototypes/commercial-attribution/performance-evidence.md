# Order 567 R3 performance evidence

This is implementer evidence only; independent review must reproduce it. It authorizes no production projection or migration.

## Environment

- Host: AMD Ryzen 5 5500U, 6 cores / 12 logical processors, Windows host with Docker Linux container.
- PostgreSQL: 16.15 x86_64 Alpine.
- `shared_buffers=128MB`, `work_mem=4MB`.
- Reporting transaction: `READ ONLY`, `SET LOCAL ROLE app_role`, transaction-local tenant/actor/property settings.
- Query settings retained by the test: `max_parallel_workers_per_gather=4`, `min_parallel_table_scan_size=1MB`, `parallel_setup_cost=0`, `parallel_tuple_cost=0.01`.
- Fixtures: fictional only. A 100-room property contributes 73,000 hotel-night rows; a separate 1,000-room property contributes 730,000 rows over 730 dates. Dimension skew: 5 MSG, 20 MS, 6 channels, 8 sources, 200 companies, 4 room classes and 12 room types.
- R2's direct-leaf aggregate failed independently at 303.39ms and organization at 369.99ms. R3 therefore tests a disposable source-rebuilt daily rollup candidate rather than hiding that miss or widening the budget. Each source night contributes exactly once to every scope; all twelve 1,000-room scope totals independently conserve 730,000 nights.

## Reproducible run

Command:

```powershell
$env:YELLOW_REQUIRE_COMMERCIAL_PROTO='1'
$env:YELLOW_COMMERCIAL_PROTO_URL='<isolated PostgreSQL 16 database URL>'
bun test tests/commercial-attribution-prototype.integration.test.ts --timeout 120000
```

Latest complete implementer run: 17 passed / 0 failed / 49 assertions. The 1,000-room daily-rollup scope matrix retained the first execution and then five timed warm samples per scope. One twelve-scope concurrent matrix completed in 210.9251ms:

| Scope | First execution ms | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: |
| Hotel | 14.3813 | 3.5783 | 4.0289 | 4.0289 |
| Organization | 4.8489 | 4.4241 | 6.0442 | 6.0442 |
| Chain | 4.6182 | 3.8066 | 5.5549 | 5.5549 |
| Brand | 5.1821 | 3.6746 | 4.4277 | 4.4277 |
| Region | 4.5543 | 3.4297 | 3.7726 | 3.7726 |
| MSG | 26.6711 | 19.8012 | 26.5709 | 26.5709 |
| MS | 32.7976 | 23.0933 | 31.4723 | 31.4723 |
| Channel | 17.6619 | 20.6477 | 28.4637 | 28.4637 |
| Source | 18.6942 | 19.2565 | 22.7809 | 22.7809 |
| Company | 62.3657 | 66.2439 | 89.1607 | 89.1607 |
| Room class | 16.2732 | 19.9109 | 32.8911 | 32.8911 |
| Room type | 21.5198 | 22.0930 | 25.8651 | 25.8651 |
| First leaf page, 5 timed warm samples | — | 2.2598 | 3.9277 | 3.9277 |

Targets: aggregate p95 <300 ms and first leaf page p95 <150 ms. These are machine-specific prototype observations, not a service SLO. The first-execution column is retained honestly but is not labelled a cold-cache benchmark: the fixture load and `ANALYZE` can populate operating-system and PostgreSQL caches. A reviewer must restart its isolated PostgreSQL process before any genuine cold-shared-buffer measurement and label the remaining host page-cache limitation.

## Retained plans

The authored test retains full JSON `EXPLAIN (ANALYZE, BUFFERS)` for the worst-cardinality company rollup, organization rollup and source leaf page under the same app role and transaction-local scope.

- Worst-cardinality company daily-rollup: 4-worker partial hash aggregate, gather merge and final aggregate; grant check is a one-time `property_grant_pkey` init plan; 200 rows; 3,208 shared hits, no reads or temporary blocks; planning0.281ms; execution **80.162ms**.
- Organization daily-rollup: `benchmark_rollup_scope` index-only scan, 730 source days and one output group; one-time grant init plan; 743 shared hits, no reads or temporary blocks; planning0.345ms; execution **1.701ms**.
- Late-date first leaf page remains on the conserved source: `benchmark_night_leaf` index scan and `LIMIT 50`; 11 shared hits, no reads/spills; planning1.541ms; execution **0.379ms**.

Both benchmark relations are disposable and unlogged. `benchmark_rollup` is rebuilt from `benchmark_night`, not accepted as an independent truth. Any durable projection requires a separate forward migration, owner-only rebuild, same-transaction evidence, ACL/RLS, freshness/cutoff and fresh/upgrade recovery review; this order grants none of that authority.
