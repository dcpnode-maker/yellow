# ADR-724: Evaluate Martin without replacing Yellow's private map boundary

Status: Bounded native trial accepted; production adoption deferred.
Date: 2026-09-25
Deciders: Codex within Order724 technical scope; founder for spending or new data rights.

## Context

Yellow currently uses MapLibre with OpenFreeMap street tiles. Order723 adds a
client-memory-only PriceLabs research layer, not a tile database or listing feed.
The founder supplied Martin1.16.1 as a possible efficient Rust tile server and
asked for an actual trial. Laptop memory/disk and the prior no-large-Overture-download
instruction constrain this evaluation. Existing app, hotel database and public
tunnel configuration must remain unchanged.

## Recommendation

Retain Martin as a candidate for future owned/precomputed public tile serving;
do not replace Yellow's current map or extend a custom tile server on the strength
of this small trial. Keep private listing details and Yellow identity checks outside
Martin. The native PMTiles path is promising on this laptop, but representative
data, PostGIS/compressed-vector behavior and deployment/security proof are missing.
Order724 and its executable receipt define the measured workload and safety gates.

## Options considered

1. Keep OpenFreeMap plus client GeoJSON: least new infrastructure; current map
   remains usable, but provider availability and viewport privacy remain concerns.
2. Add Martin for owned/precomputed public tiles: reuse established serving and
   cache code, at the cost of another process, storage, bandwidth and monitoring.
3. Build/extend a custom tile server: greatest maintenance and correctness burden;
   no established Yellow Rust tile server was found in the active map path.

## Trade-offs and evidence boundaries

Martin does not acquire listings, improve approximate source coordinates, license
third-party data, or create dated competitor prices. A tiny local archive benchmark
measures that fixture/workload, not worldwide data or production capacity.
The upstream sparse-pyramid optimization only applies when empty parent tiles
guarantee empty descendants; compressed-cache gains trade memory for CPU work.
GeoParquet/DuckDB support is experimental and excluded here.

The proposed Overture/PostGIS comparison is not performed by this bounded trial:
no large extract, new PostGIS service or connection to the hotel database is allowed.
Likewise public fixture access cannot prove private tenant isolation. Restarting
an isolated test process cannot prove production release rollback.

## Action items

- Verify official release digest before executing the binary.
- Pin one small public archive and record its bytes/hash/source.
- Execute bounded scheduled-rate probes with complete error/drop accounting.
- Independently inspect the harness and repeat a short probe.
- Record results and a keep/defer/adopt recommendation after proof, not beforehand.

## Primary sources

- [Martin1.16.1 release](https://github.com/maplibre/martin/releases/tag/martin-v1.16.1)
- [Pinned MIT OR Apache-2.0 declaration](https://raw.githubusercontent.com/maplibre/martin/martin-v1.16.1/Cargo.toml)
- [Compressed-cache upstream benchmark](https://github.com/maplibre/martin/pull/3211)
- [Sparse-pyramid limitation and upstream test](https://github.com/maplibre/martin/pull/3208)
- [Martin documentation](https://maplibre.org/martin/)
- [1.16.0 changes](https://github.com/maplibre/martin/releases/tag/martin-v1.16.0)

## Executed observations

Native Windows on an AMD Ryzen 5 5500U (6 cores / 12 logical processors), about
15.35 GiB physical RAM. Client and Martin share this laptop with the existing
healthy Yellow stack; this is not a dedicated or production-equivalent machine.
Martin is pinned to 1.16.1, one worker, a 16 MB cache setting and loopback port3054.
The source is the release-pinned 734,989-byte public PNG PMTiles fixture, not
Overture, vector tiles or PostGIS. Each tested tile body is 181,918 bytes.

| Protocol / nominal rate | Duration | Successful / scheduled | Drops | Achieved RPS | p50 / p95 / p99 ms |
|---|---:|---:|---:|---:|---:|
| Individually scheduled, 25 RPS | 600 s | 14,999 / 15,000 | 1 | 25.00 rounded | 2.90 / 4.25 / 6.16 |
| Individually scheduled, 100 RPS | 600 s | 41,620 / 60,000 | 18,380 | 69.37 | 2.94 / 4.23 / 6.31 |
| Batches of8, 100 RPS average target | 600 s | 60,000 / 60,000 | 0 | 100.00 rounded | 3.32 / 6.28 / 9.30 |
| Batches of8, 500 RPS average target | 600 s | 299,048 / 300,000 | 952 | 498.41 | 3.67 / 7.64 / 10.53 |

The completed stages received only HTTP200 identity responses, with no reported
response errors or timeouts. These percentiles cover completed responses, not
missed slots. At100RPS, 30.63% of scheduled slots were dropped: that stage did NOT
successfully offer100RPS and cannot prove a100RPS capacity target. Original result
files and exact source hashes are retained separately, not overwritten.

Root inspected the pacing loop; an independent reviewer repeated the review.
After the original100RPS stage, diagnostic counters separated missed schedule
slots from in-flight-cap drops. Three-second, immediate-response, no-network
pilots then missed81/300 and1163/1500 slots at nominal100/500RPS respectively,
with zero in-flight-cap drops and maximum pending depths2/3. This isolates a
generator timing limitation; Windows timer granularity is plausible but was not
independently instrumented at the OS level.

The explicitly separate follow-up protocol uses at most8 requests per scheduled
batch, nominal cadence8/rps seconds, with missed batches dropped and all original
safety caps retained. It measures average-rate burst traffic, not evenly spaced
requests. Independent tests/typechecks passed; root's real3s500RPS batch probe
completed1500/1500 with0drops/errors and p95=7.02ms. The full100RPS batch follow-up
then completed60000/60000,0drops/errors, sampled working set14.70–16.33MB and
22.09CPU seconds over600s. The final500RPS follow-up delivered498.41RPS with
952scheduler misses (0.3173% of planned requests), no in-flight-cap drops and no
reported response errors/timeouts. Sampled working set14.70–17.87MB, max in-flight29,
97.33CPU seconds over600s. Both batch stages retained20000 uniformly sampled
completed-response latencies; these are estimates, not full-population quantiles.

The local response-latency targets (p50<50ms/p95<=150ms) were met for the offered
workloads, but not every nominal500RPS request was sent. This is not evidence of
a server ceiling, production capacity, an end-to-end Yellow map SLO or a database
query time. Final artifact acceptance and cleanup belong in receipt/review724.

Root independently verified the final result arithmetic, pinned source/test hashes
and shutdown: Martin PID29752 is gone and port3054 closed. Yellow3010/health remains
200, database/cache containers unchanged, public tunnel off. Final combined source
proof:36tests/0fail/263assertions, backend/frontend typechecks and208 import-boundary
checks passed. No production switch, database write or whole-ecosystem completion.

## Adoption gate

Even a successful tiny-fixture trial is insufficient to switch the live map.
A later adoption order must use an approved representative tile corpus, multiple
zoom levels and cache-miss patterns, a load generator that reaches the intended
offered rate, and a deployment/rollback proof. PostGIS generation and compressed
vector-tile behavior need their own measurements. Private or tenant-filtered
tiles additionally need independently executed authorization/cache-isolation
proof; an anonymous public fixture cannot stand in for that boundary.

The current2,528-row private research layer does not require a new tile service:
it is rendered as clustered client GeoJSON over OpenFreeMap. Acquiring approved
market observations and creating a governed persistent ingestion/read path are
separate gaps. Martin does not fill either gap, and no such pipeline is claimed
by this benchmark.

Recorded body-byte totals are bytes consumed over the local loopback connection,
not internet data acquired or bytes retained on disk. Only the pinned binary,
tiny fixture, a few integrity samples and bounded result/log artifacts are kept.
The16 MB cache setting is not a whole-process memory limit; reported memory is
sampled Martin working set, not the memory of Yellow, the browser or this laptop.

## Included-quota independent model critique

Root actually ran configured Antigravity Gemini3.8FlashLow, sandbox/plan/low effort,
with a sanitized public methodology-only prompt, explicitly no tools/files/browsing.
Conversation19de8195-fec9-41a6-a0b7-747cac1addd8:SUCCESS,6.176s,1turn,
14,029input/702output/186thinking tokens reported. No Yellow source/private rows,
credentials, device identifiers, paid fallback or auth change. This was critique,
not a data extraction, executable review or benchmark.

Useful suggestions: verify response body/status/integrity; distinguish generator
scheduling misses from server response errors; examine resource drift; do not infer
PostGIS, compressed MVT, network/TLS, tenant security or real-market capacity from
one raster archive. Root accepts those boundaries, not every generated statement.
The response overclaimed that fixed-rate probes establish a server ceiling and
that OS cold-cache initialization is measured. Neither is established:500RPS is
only the highest offered rate, no OS cache flush was performed, and real disk/OS
effects are not eliminated. A16MiB cache setting also does not prove an overall
process-memory ceiling. These corrections govern the final interpretation.
