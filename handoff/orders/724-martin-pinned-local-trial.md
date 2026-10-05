# Order724 — pinned isolated Martin trial

Founder explicitly re-raised the Martin1.16.1 proposal on25September. Research
verification alone is not this trial. Implement and execute a bounded native
CPU-only benchmark alongside723, without replacing Yellow's current map.

## Scope

- completion_queue709 owns scripts/research/martin-local-benchmark.ts (new bounded
  loopback-only harness), tests/order724-martin-benchmark.test.ts, and
  handoff/receipts/724-martin-trial.md; external artifacts/config/logs/downloads
  only under D:/Yellow/temp/order724-martin-trial/. Use apply_patch for code/config.
- Root owns this order, handoff/questions/724.md, handoff/reviews/724-martin.md,
  docs/research/MARTIN-TRIAL-20260925.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Read official primary release/config documentation and existing infrastructure.
  Do not edit product code, manifests/lockfiles, compose, server routes, DB/schema,
  private dataset, cloud permissions, or environment/credentials.
- Root may run one sanitized public-methodology second opinion via the already
  configured Antigravity included quota in the existing empty
  D:/Yellow/temp/antigravity-quota-check-20260925 directory, as recorded in
  questions/724.md. No Yellow files/private data/credentials forwarded, no paid
  fallback/auth change. Record actual outcome, not inferred validation.

## Artifact and isolation

Use official release martin-v1.16.1, not latest or a source build. Windows archive:
https://github.com/maplibre/martin/releases/download/martin-v1.16.1/martin-x86_64-pc-windows-msvc.zip
Expected SHA256 cbe4f7f78361e27b7f77973c6b2f487fe6fdd466900d9e50811d707e3c6fe206;
reconfirm official release metadata, then hash local bytes before execution.
Official version-pinned Cargo.toml declares MIT OR Apache-2.0. Bound download to
60MB; no dependencies, WSL/container install, new DB or full repository clone.

Use one tiny pinned public upstream tile archive/fixture, at most5MB, with explicit
source/hash/format/tiles/sample metadata. No Overture/world download or private
PriceLabs/guest data. This differs from the proposed Overture/PostGIS comparison;
record the limitation. No PostGIS installation/live hotel connection. If fixture
cannot be obtained safely, report the exact blocker rather than invent a result.

Martin binds only127.0.0.1 on a verified unused port (3054 preferred), one worker,
small explicit tile cache (16MiB or nearest documented setting), no directory
auto-discovery outside fixture root. Start native helpers with WindowStyle Hidden.
Record PID/path/starttime/port and stop only owned processes at finish. Existing
app3010, PG55432, Valkey6390 and public tunnelOFF remain unchanged.

## Executed proof

Start with health/catalog/tile bytes and missing-source denial, compression and
restart/cache identity checks. Then run25/100/500 scheduled requests/sec for600s
each if safe. Gate each stage on source availability and resource headroom; cap
in-flight at64, count all scheduled/sent/completed/dropped/timeouts/non2xx, consume
response bytes, bounded arrays/logs and per-request timeout. No unbounded catch-up
bursts. Record cold first request separately; do not call a restarted process a
cold OS/disk cache. Client p50/p95/p99, achieved rate, error/drop fractions, bytes,
CPU process time and sampled working-set memory required; no fabricated metrics.

If laptop pressure, low disk, app unhealthiness, or probe errors appear, stop or
reduce only with an explicit recorded truncated-trial outcome. No quality claim
from tiny-fixture localhost results or comparison to upstream103k/114k throughput.
Target p50<50ms/p95<=150ms is a trial target, not a guaranteed Yellow SLO.

Authorization/tenant isolation: Martin's public fixture route is NOT Yellow's
authenticated listing-detail boundary. Do not put private observations behind
that route. Record whether authorization is absent and why no real tenant test
is claimed. Demonstrate stopping/restarting the isolated candidate without any
Yellow deployment change; that is not a production release rollback proof.

Harness focused tests before load. Root reviews source and personally repeats a
short independent bounded probe before accepting the trial report. Keep progress
available through finite yielded commands, not blocking sleeps exceeding60s.

## Clarified bounded-batch follow-up

After full steady-scheduled25/100RPS runs and no-network diagnostic pilots, the
generator cannot sustain requested individual-slot100/500RPS pacing. Preserve
these results. questions/724.md authorizes optional explicit batch-size1..8 in
the same scoped harness/tests; default1 keeps the old protocol. At batch-size8,
run separately labelled burst-average-rate100/500 pilots and, if feasible,600s
stages with original caps/guards. Missed batches are dropped, never caught up;
request counters/protocol/source hashes stay explicit. Independent executable
review required before sustained follow-up. No server-capacity inference from
unreached rates, timer-system changes, busy-spin or production changes.

## Outcome

Bounded local trial complete; root independently approved the evidence and cleanup
in review724. Individually scheduled25/100RPS stages plus separate batch-size8
100/500RPS stages each ran600s; the original100RPS generator limitation is preserved.
Final batch500 delivered498.41RPS,299048successful responses,952scheduler misses,
0response errors/timeouts,p95=7.64ms, sampled Martin working set≤17.87MB. Native
owned server stopped; root confirmed PID/port absent and Yellow local health200,
public tunnelOFF. Final36/0/263 tests, types and208boundaries pass.

This completes only the clarified public PNG/PMTiles trial, not the original full
Overture/PostGIS comparison, compressed-vector benchmark, tenant-isolation or
production-rollback proof. ADR724 defers adoption; current map/auth/data unchanged.
