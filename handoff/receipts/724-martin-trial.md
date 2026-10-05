# Order724 — Martin 1.16.1 isolated local trial receipt

Date: 2026-09-25. This was a bounded native Windows loopback experiment, not a Yellow deployment, production benchmark, or market-map decision.

## Artifact and isolation

- Official pinned release: [Martin v1.16.1 release](https://github.com/maplibre/martin/releases/tag/martin-v1.16.1). Windows x86_64 archive SHA-256 verified as `cbe4f7f78361e27b7f77973c6b2f487fe6fdd466900d9e50811d707e3c6fe206`; downloaded archive was 39,083,287 bytes. Version command returned `martin 1.16.1`.
- Official fixture: [small PNG PMTiles fixture at the pinned tag](https://github.com/maplibre/martin/tree/martin-v1.16.1/tests/fixtures/pmtiles). `png.pmtiles` was 734,989 bytes; upstream Git blob `dd9a057dd2a7128a1b07fa7a9f6895993018230e`; local SHA-256 `e34b86abd5478e729b040b49b92a4f5a52d67cc417f124065b6e3d6a691f8723`. The one returned tile was a 181,918-byte PNG. This fixture is far smaller and structurally different from Overture/PostGIS or Yellow data.
- Server invocation used only that explicit file: `martin.exe <trial-root>\png.pmtiles --listen-addresses 127.0.0.1:3054 --workers 1 --cache-size 16 --webui disable`. Only `martin.exe` was extracted from the archive. The downloaded binary, fixture, and trial artifacts stayed under `D:\Yellow\temp\order724-martin-trial`; harness source and tests are the scoped repository files listed above.
- Owned process: PID 29752, path `D:\Yellow\temp\order724-martin-trial\bin\martin.exe`, start `2026-09-25T12:29:44.7681445Z`, listener `127.0.0.1:3054`. Inherited environment variable-name check found no `DATABASE_URL`/`PG*` names; process connections showed only its loopback listener. No DB was configured or contacted.
- Laptop at run: AMD Ryzen 5 5500U, 6 cores/12 logical CPUs, 15.35 GiB RAM; Bun 1.3.14; Windows. Available RAM was about 3.3–3.6 GiB during measured stages. Each stage was gated on app `http://127.0.0.1:3010/health` returning 200 and >2 GiB free RAM; both remained green. Periodic process sampling was asynchronous, verified PID/path/start time, and sampled every 5 seconds (maximum 121 samples per 600s stage).
- Order-harness tests were independently run by a non-implementer before measurement: `bun test tests/order724-martin-benchmark.test.ts` (16 passed, 0 failed, 97 expectations) and `bun run typecheck` (exit 0). Frozen harness SHA-256: `C5ABBDAA17099E6769C5650B79332ABA39090397A2846C224CF4B730A1E98E55`; test SHA-256: `4D5721320FABCA21FDA04388B7A2E21936311511F9FC1D56E9203FA559507504`.

## Smoke, compression, and restart

- First tile read after server start: `/health` 200 (2 bytes); `/catalog` 200 (128 bytes; `png`, image/png); `/png/0/0/0` 200 (181,918 bytes, 11.76 ms in the initial PowerShell probe); a missing source returned 404. The first tile read is a process-cold fixture request only; OS/disk cold-cache state was not proven.
- Requesting `Accept-Encoding: identity` and `gzip` both returned the same 181,918 bytes and SHA-256 `C6C1CC6905C7208BCA2657DCCC689396767101AC96BD6F97AC47CCC3884040E6`, with no `Content-Encoding`. This PNG fixture did not demonstrate compression or MVT size/cache gains.
- Restarted only the owned process (after path/start-time validation). Catalog stayed 200/128 bytes and the tile bytes/hash were identical. This is a process restart/content identity check, not evidence of a cold operating-system or disk cache.

## Rate results

The harness measures fixed windows and reports a uniform reservoir of completed-response latencies. Bytes are consumed but not persisted. `identity` is the response encoding in each measured request. The files named below contain complete machine-readable results and source hashes.

| Protocol | Configured average rate | Scheduled / sent / completed | Drops | Achieved completed rate | Completed-response latency p50 / p95 / p99 |
|---|---:|---:|---:|---:|---:|
| Steady individual slots, batch 1 | 25 RPS × 600s | 15,000 / 14,999 / 14,999 | 1 aggregate drop (original result did not separate drop causes) | 25.00 RPS | 2.90 / 4.25 / 6.16 ms (n=14,999) |
| Steady individual slots, batch 1 | 100 RPS × 600s | 60,000 / 41,620 / 41,620 | 18,380 aggregate drops (original result did not separate drop causes) | 69.37 RPS | 2.94 / 4.23 / 6.31 ms (n=20,000) |
| Burst-average-rate, batch 8 | 100 RPS × 600s; 80ms batch cadence | 60,000 / 60,000 / 60,000 | 0 | 100.00 RPS | 3.32 / 6.28 / 9.30 ms (n=20,000) |
| Burst-average-rate, batch 8 | 500 RPS × 600s; 16ms batch cadence | 300,000 / 299,048 / 299,048 | 952 scheduler drops (119 missed batches); 0 in-flight | 498.41 RPS | 3.67 / 7.64 / 10.53 ms (n=20,000) |

All responses in the measured stages were HTTP 200 identity, no oversized bodies, timeouts, or network errors. The 100 RPS steady shortfall and no-network injected-fetch pilots (100: 219/300 sent; 500: 337/1,500 sent; scheduler drops only) establish a load-generator pacing limitation for the batch-1 protocol on this host, not Martin server saturation. Batch-8 is explicitly a burst-average-rate protocol and is not steady per-request spacing. Results across those protocols are not directly interchangeable.

Other stage observations:

- 25 steady: 600,010 ms traffic window, 2,728,588,082 body bytes, server CPU delta 7,953 ms, working set 14,409,728–14,848,000 bytes; no sample errors.
- 100 steady: 600,010 ms traffic window, 7,571,427,160 body bytes, server CPU delta 22,719 ms, working set 14,348,288–14,946,304 bytes; no sample errors.
- 100 batch 8: 600,003 ms traffic window, 10,915,080,000 body bytes, server CPU delta 22,094 ms, working set 14,700,544–16,330,752 bytes; no sample errors.
- 500 batch 8: 600,008 ms traffic window, 54,402,214,064 body bytes, server CPU delta 97,328 ms, working set 14,704,640–17,870,848 bytes; no sample errors.
- All stages used the same 181,918-byte raster tile with identity encoding. The 500 RPS batch run delivered approximately 54.4 GB through loopback; it is not an estimate of customer network cost.

Results: `D:\Yellow\temp\order724-martin-trial\results-25rps.json`, `results-100rps.json`, `generator-mock-pilots.json`, `batch-pilot-100rps.json`, `batch-results-100rps-600s.json`, and `batch-results-500rps-600s.json`. Root independently performed a 3s batch-500 verification: 1,500/1,500 successful requests, 0 drops/errors, 497.98 completed RPS.

## Cleanup and limits

Stopped only PID 29752 after verifying its exact executable path, start time, and sole listener at 127.0.0.1:3054. Post-cleanup: port 3054 closed, no Martin process remained, existing app health stayed 200, free RAM 3.47 GB. Existing app/DB/cache services and public tunnel were not changed.

Martin's public fixture route had no Yellow authentication or tenant boundary; no real tenant request was made. This proves neither a safe private-data route nor production rollback. There was no PostGIS comparison, no Overture/PriceLabs/guest data, no map-product integration, no compression benefit, no public deployment, and no production SLO conclusion. Upstream benchmark figures were not used as Yellow results.
