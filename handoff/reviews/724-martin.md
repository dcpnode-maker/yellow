# Order724 independent trial review

Reviewer: root, nonimplementer of the benchmark harness. Status: APPROVED as a
bounded public-fixture local trial, NOT as production adoption, full proposed
Overture/PostGIS comparison or proof of tenant isolation. Final proof is below.

Root personally rehashed the downloaded official Windows release ZIP:
cbe4f7f78361e27b7f77973c6b2f487fe6fdd466900d9e50811d707e3c6fe206.
Tiny public fixture SHA256:
e34b86abd5478e729b040b49b92a4f5a52d67cc417f124065b6e3d6a691f8723.
Native `martin.exe --version` returned martin1.16.1. No production switch, private
data, PostGIS connection or Overture restoration was performed by root.

Before accepting any timings, root inspected the harness and requested corrections:

- replace synchronous per-process PowerShell sampling with bounded async sampling
  so metric gathering does not block the load generator;
- begin the rate clock after initial process sampling;
- account for scheduler stalls as dropped slots, avoid late sends after deadline;
- maintain the configured full measurement window, and separate sample overhead
  from achieved traffic rate;
- name the latency population honestly (completed responses, not success-only);
- add process identity/failure and clock-stall/deadline tests;
- enforce resource and app-health gates during sustained runs.

guest_contract709 separately inspects the harness and personally executes focused
tests, without implementing changes. Initial root probe is recorded below;
final verdict follows remaining load measurements and owned-process cleanup.

Root personally executed corrected focused harness tests11pass/0fail/54assertions,
including sampler-failure, stall and deadline cases, plus full backend/frontend
typecheck.

## Root personally executed short probe

Verified native process30912, exact scoped martin.exe path, start
2026-09-25T12:26:04.5394924Z, listener127.0.0.1:3054 only. Executed:

```text
bun scripts/research/martin-local-benchmark.ts --base-url http://127.0.0.1:3054 --tile-path /png/0/0/0 --rps 25 --duration-seconds 3 --max-in-flight 8 --timeout-ms 2000 --server-pid 30912 --server-path D:/Yellow/temp/order724-martin-trial/bin/martin.exe
```

Actual traffic window3003ms:75scheduled/sent/completed/successful,0dropped,
0timeouts/network/non2xx/oversize errors;24.97completedRPS;13,643,850body bytes.
Identity encoding75. All75latency samples: p50=3.0835ms,p95=4.2669ms,p99=10.3745ms.
Server CPU delta15.625ms,2process samples,working set14,393,344–14,462,976bytes,
0sample errors. Root did not stop/restart the agent-owned server or run parallel
traffic during planned sustained stages. These are warm short localhost public
raster-fixture numbers, not production capacity, compression gain or a DB query.
Full stage acceptance remains pending.

## Sustained-stage evidence and final harness correction

Root read results-25rps.json from the scoped trial directory:15000scheduled,
14999successful200identity,1unclassified drop,600010ms offered window, no response
errors/timeouts. Body total2728588082equals14999times181918. Reported p50/p95/p99
2.8955/4.2476/6.1573ms, all14999latencies retained; CPU7953.125ms,
121working-set samples14,409,728–14,848,000bytes,0sampler failures.
Rounded achievedRPS25.00 does not erase the explicitly reported one dropped slot.

Independent guest_contract709 found overlapping oversized/non2xx responses were
undercounted in one field. The active25RPS run was left frozen, then the builder
fixed that branch and added the oversized503 regression. Its normal200/181918byte
path was not affected. Pre-fix source hashEDBC6005390DD16120CBB7E687D8FFD56302E787867B5EAF9BAD45AA37EDD83D;
post-fixFE9BD6345C53814B6B933E609D9275726A4EF1B83D2CE45E046E9820CD8D54EC;
testsF95626EA6A73C212C5086EB110C929366847B932A4DC072961F2B06BD028E186.
Root personally read the correction and reran12pass/0fail/56assertions. Reviewer
guest_contract709 separately reran the same12/0/56 and full typecheck, no blocker.
100/500RPS stages use the corrected frozen harness; no source change under load.

Root also obtained an actual included-quota Antigravity/Gemini public-methodology
critique (conversation19de8195,6.176s). It correctly flagged response-integrity,
generator-limit and real-workload/security limitations, but overstated server
ceiling and OS-cold-cache proof. Root rejected those two claims; see ADR724.
Another model's critique does not replace the personally executed probe above.

## 100 RPS pacing investigation (not a capacity verdict)

Live progress at350s reported35030scheduled,24260sent,24259completed and10770drops.
These are in-flight progress observations, not the final600s result. Root and
guest_contract709 independently inspected the pacing loop without adding network
traffic or changing the active harness. The existing dropped field combines
missed scheduled slots with in-flight-cap drops. Roughly one outstanding request
does not support the earlier tentative suggestion of64-request-cap saturation.
Timer/scheduler granularity is plausible but not yet proven by these observations.

The owner will preserve the full100RPS artifact, then add separate scheduler/cap
drop counters, maximum observed in-flight depth and bounded slot-lateness metrics,
with deterministic tests. A short immediate-response/no-network pilot isolates
generator timing before deciding whether the real500RPS stage is meaningful.
No production-capacity claim or undisclosed pacing change is authorized by a
configured rate alone.

Root then personally read the final results-100rps.json:60000scheduled,
41620sent/completed/successful200identity,18380aggregate drops;600010ms traffic,
600011ms completion,69.37achievedRPS. Response errors/timeouts/oversize all zero.
Body total7571427160 equals41620times181918. Uniform reservoir20000 completed
responses: p50/p95/p99=2.9420/4.2272/6.3051ms. CPU22718.75ms;121working-set samples
14,348,288–14,946,304bytes,0sampler failures. Source hashFE9BD6345C53... matches
the corrected pre-run source. The18380drops are30.6333percent of scheduled slots;
the low response latencies do not make this a successfully offered100RPS test.

## Independently verified bounded-batch follow-up

Root wrote the separate-protocol clarification in questions/724.md/order724 after
reading generator-mock-pilots.json. The new default remains one request per slot;
explicit batch-size8 sends at most8 requests per scheduled batch. No accumulated
catch-up, altered OS timer, busy-spin, new dependency or wider target was added.
Root inspected request-level remainder/skip/cap/deadline accounting, and required
the fake-clock remainder test to advance time and assert0/800ms dispatch times
rather than only counts.

Frozen source SHA256:
C5ABBDAA17099E6769C5650B79332ABA39090397A2846C224CF4B730A1E98E55.
Tests SHA256:
4D5721320FABCA21FDA04388B7A2E21936311511F9FC1D56E9203FA559507504.
Root personally executed16pass/0fail/97assertions and full two-project typecheck.
guest_contract709 separately executed the same proof, inspected the batch logic
and matched both hashes; no implementation by either reviewer.

Root personally rechecked exact native PID29752/path/starttime and loopback-only
listener, then executed the real public-fixture probe:

```text
bun scripts/research/martin-local-benchmark.ts --base-url http://127.0.0.1:3054 --tile-path /png/0/0/0 --rps 500 --duration-seconds 3 --batch-size 8 --max-in-flight 64 --timeout-ms 2000 --server-pid 29752 --server-path D:/Yellow/temp/order724-martin-trial/bin/martin.exe
```

Actual3012ms window,1500scheduled/sent/completed/successful200identity,0drops,
0response errors/timeouts;497.98completedRPS,272877000bytes,188batches including
the final partial batch. Max observed in-flight16, no missed batches or sampler
failures. All1500latencies retained:3.6753/7.0185/9.2443ms p50/p95/p99. CPU390.625ms,
two working-set samples14,409,728/17,768,448bytes. Maximum batch wake lateness14.9685ms.
This is explicitly average-rate burst traffic, not steady individual arrivals or
a production SLO. Root released the endpoint to the builder for sustained100/500
batch stages, with no parallel root load. Final results and cleanup still pending.

Root personally read batch-results-100rps-600s.json: source C5ABBDAA...8E55,
batch-size8/cadence80ms,7500scheduled batches,60000scheduled/sent/completed/
successful200identity requests,0drops/missed batches/errors/timeouts/oversize.
Traffic600003ms/completion600004ms,100.00rounded achievedRPS; body10915080000bytes
equals60000times181918. Reservoir20000 completed responses gives p50/p95/p99
3.3165/6.2774/9.2981ms. Max in-flight8. CPU22093.75ms;121working-set samples
14,700,544–16,330,752bytes,0sampler failures. Batch wake lateness observed7500,
max31.5347ms (below80ms cadence), p95=14.5785ms. No root concurrent load.
The final500RPS batch stage proceeds under the same frozen source and guards.

During sustained stages, progress exposes scheduled/sent/completed/drop counters,
not HTTP status/error totals. Root reminded the builder to report only observable
mid-run counters; response-error acceptance comes from completed result JSON.
One builder elapsed-time estimate was inconsistent with scheduled counts and was
explicitly corrected. Final trafficElapsedMs, not polling cadence, is authoritative.

## Final500RPS artifact, cleanup and acceptance

Root personally read batch-results-500rps-600s.json and executed arithmetic checks:

- 300,000 scheduled = 299,048 sent + 952 scheduler drops; no in-flight-cap drops.
- Every sent request completed successfully; all 299,048 statuses were 200/identity.
- Zero timeouts/network/non2xx/oversized, 119 missed batches, maximum in-flight 29.
- 54,402,214,064 body bytes = 299,048 times 181,918, matching declared-length sum.
- 600,008 ms traffic/completion, 498.41 rounded achieved RPS; 0.317333% scheduled drops.
- Completed-response reservoir 20,000: p50/p95/p99 = 3.6679/7.6437/10.5275 ms.
- CPU 97,328.125 ms; 121 working-set samples 14,704,640–17,870,848 bytes, no sampler errors.
- Both result hashes match root's independently rehashed final source/tests.

Builder stopped only the scoped owned Martin process after exact identity checks.
Root separately verified: PID29752 absent, no listener3054, app3010/health200.
Docker inspection confirms local app723 remains healthy on127.0.0.1:3010,
PostgreSQL55432/Valkey6390 remain healthy, and public tunnel Exited. No root
stop command, hotel write, database change, production tile switch or public
publication. Existing readiness503/build-provenance limitation remains unresolved.

Root personally executed final combined proof after timed traffic ended:

```text
bun test tests/order722-pricelabs-dashboard-export.test.ts tests/order723-market-map-import.test.ts tests/order723-market-map-layer.test.tsx tests/order699-street-map.test.ts tests/order724-martin-benchmark.test.ts
36 pass, 0 fail, 263 assertions
bun run typecheck
passed (backend and frontend)
bun run boundaries
208 TypeScript files, passed
```

Verdict: the pinned native PMTiles path is promising for this single warm public
raster fixture. Preserve every original/method-corrected result and generator
limitation. Do not claim exact500RPS delivery, server maximum, compressed-vector
gain, OS-cold-cache proof, a Yellow DB/map SLO, PostGIS performance, tenant isolation
or production rollback. Recommend deferring production adoption until the separate
representative-workload/security/deployment gates in ADR724 are executed.
