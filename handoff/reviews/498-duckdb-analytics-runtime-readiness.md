# Order498 — DuckDB analytics readiness review

Reviewer: `/root/pms_delivery_audit`, 2026-09-20. Review/research only; no application,
database, provider, ingestion, dependency installation or deployment changes.

## Verdict

DuckDB fits disposable management, market, pickup and compset analytics over versioned
Parquet. It is not a replacement for PostgreSQL, Valkey, or the operational command
services. The native research engine works; production reporting integration is absent.
This review completes readiness discovery, not analytics runtime delivery.

PROJECT.md keeps PostgreSQL authoritative for occupancy, availability, reservation
state, financial records and business date. Order498 preserves that boundary.
Architecture-v3 describes embedded DuckDB; ARCHITECTURE-V1 retains PostgreSQL operational
projections until measured workloads justify columnar export. These are compatible:
keep transactional operational views in PostgreSQL and introduce bounded analytical
queries separately. No whole-app database replacement or ClickHouse deployment is needed.

## Personally observed evidence

- The current published runtime source under
  `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
  contains architecture references but no DuckDB reporting client/worker integration.
  Its Dockerfile packages a Bun Alpine application; the Windows Python native module
  is not a compatible production container dependency.
- Existing Order472 research is in the separate checkout
  `C:/Users/astha/Documents/Codex/2026-08-14/cl/outputs/yellow-order175-folio-responsive-containment`.
  `scripts/research/extract-overture-region.py` pins DuckDB1.5.5, wheel/httpfs hashes,
  sixteen publisher objects, a regional query and resource limits. Its market runtime
  loads two admitted immutable JSON artifacts; it does not run management analytics
  with DuckDB on each application request.
- Retained extraction receipt at
  `E:/yellow/market-discovery/order472/region-20260913T080453Z-5b27867cde994a0b9c673d099ecb7d85`
  records 35 rows, 43,688 bytes, 34.648 seconds, accepted exit0. I rehashed region.json:
  `7C0C268A34CB461713EED238124C627A5D1C0E44E3509184A215628B362CC6E7`, matching receipt.
  This proves retained artifact identity, not fresh publisher truth or global coverage.
  Receipt explicitly reports no hard network-byte cap and no verification of the
  whole Drive payload. SQL LIMIT is not a network-volume bound.
- Personally loaded the installed native module from
  `E:/yellow/toolchains/duckdb-1.5.5-python313/runtime` with Python3.13, bytecode disabled.
  An in-memory query `SELECT count(*),sum(i) FROM range(100000) t(i)` returned
  `[100000,4999950000]`, exit0. Observed engine version1.5.5, threads2,
  memory_limit244.1MiB (requested256MB), temp limit0bytes, external access false,
  autoload/autoinstall extensions false. No files, network data or PMS tables were read
  by that proof. It is engine/configuration proof, not a Parquet workload benchmark,
  tenant isolation proof, or production resource guarantee.

## Recommended integration contract

1. A bounded exporter produces immutable tenant/property-partitioned Parquet snapshots
   from a coherent PostgreSQL read snapshot. A manifest records schema version,
   source snapshot/watermark, source IDs, extraction time, property business date,
   timezone, currency, row counts, file sizes and hashes. Source market records also
   retain publisher release, observed/effective dates, applicability and licensing.
2. Publish a validated manifest atomically after all files are complete. Query workers
   pin one manifest version for a request. No in-place replacement of files being read.
   Initial batch refresh is sufficient; subsequent outbox-driven invalidation should
   coalesce affected partitions. Do not use a naive sequence high-watermark that loses
   late-committing transactions: reuse acknowledged committed event delivery/deduplication
   or a defined consistent snapshot/reconciliation protocol.
3. Authorize tenant/property before choosing a manifest. The server supplies exact
   file identities and fixed parameterized analytical queries. Never accept model/user
   SQL, file paths or arbitrary remote URLs. Separate private property data from public
   market reference sets. PostgreSQL RLS does not protect exported Parquet; isolation
   must be enforced independently and tested with hostile cross-tenant requests.
4. Use a supervised worker with a bounded queue, query deadline/cancellation, row/output
   cap, CPU/thread budget, process memory bound and explicit D:/E: temp quota/free-space
   reserve. Start with one concurrent heavy query and two DuckDB threads, then benchmark.
   `memory_limit` alone is not a whole-process memory bound. No live query files or temp
   spill on Drive's streamed G:; Drive can hold validated archive copies.
5. Cache by manifest version, authorized scope, query version and parameters. Results
   display source/as-of time, refreshed time, lag and stale/partial/unavailable state.
   A failed refresh retains the last good snapshot visibly marked stale; no snapshot
   means unavailable, not zero. Worker failure must not delay check-in or cashier work.
   After an operator mutation, use canonical operational API results immediately;
   refresh analytical cards asynchronously. Analytical output never authorizes a sale.

## Production gap and next safe order

Still required: supported Linux/Bun worker binding/package decision, dependency/license
review, export manifest schema, consistent snapshot pipeline, tenant/file authorization,
refresh/replay protocol, query API, stale-state UI, resource supervision, recovery and
representative performance/isolation tests. No quantitative speedup is established.

Next order should be limited to an OFF-by-default analytics adapter and synthetic
Parquet contract proof in an isolated directory: fixed query catalogue, manifest/hash
validation, tenant/property scoping, stale/missing results, process cancellation/resource
limits, deterministic aggregates and deployment-platform compatibility. No production
DB export, new operational tables, real data import, provider activation, operational
route replacement or live deployment. A subsequent separately scoped integration can
add the authorized snapshot exporter and dashboard adapter after that proof passes.

## Current official primary references

- [Parquet reader](https://duckdb.org/docs/current/data/parquet/overview): projection and
  filter pushdown support the proposed analytical read workload.
- [Concurrency](https://duckdb.org/docs/current/connect/concurrency): embedded concurrency
  rules support isolated read workers, not a substitute network OLTP server.
- [Security](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview):
  SQL can read files/access external resources; constrain both queries and process access.
- [Out-of-memory guidance](https://duckdb.org/docs/current/guides/performance/oom): some
  allocations bypass the buffer manager, so set an external worker memory boundary.

No content was inferred from a login-gated ChatGPT share. No runtime rollout or full
PMS completion is claimed. Review evidence is independent of the earlier PMS audit.
