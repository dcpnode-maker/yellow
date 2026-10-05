# Order567 independent review — REJECT / CHANGES REQUIRED

Reviewer: independent Astra agent, 2026-09-21; did not implement the candidate. Read PROJECT.md, Orders564/567, the complete accepted564 draft/review and Yellow compliance/entity/PostgreSQL skills. Ran `./state.ps1` successfully: phase0, branch phase-0/founder-context-demo-readiness, heada043bb29, dirty worktree. This review concerns only the Order567 prototype, not the separately deployed D-runtime application. No public/production DB connection, deployment, migration change or implementation edit was made. No acceptance ledger entry is added.

## Frozen candidate

| Scoped file | SHA256 |
| --- | --- |
| Order567 | F0D8B4A3431C26C2E390F46C64CDA2C309E8B7B56D514025B93A8280792C7B7E |
| prototypes/commercial-attribution/README.md | C2B8E842C19D7EBADF1B37D89F3216D5AA332C95BF4471665A511B8FE1D1C31E |
| schema.sql | 48C28906051722CEA6C590201EEA10E7977619331B20786647D966F8082EF006 |
| fixture.sql | B5386ACB0269D3C9C9135BDAA5C810725263391D633E971D4854A0CD945D81CF |
| report.sql | F71011914B2CB0B1AE3905E75C8C6073C661205007B2CC0741869CEF14158E83 |
| expected.json | 7EBCE56128204E87AD4009404BF0B67439281D0F5E823004B831C39D01C2447D |
| tests/commercial-attribution-prototype.integration.test.ts | DA56EF7C207511A4DD763D60E25B19FF1E9D542B3E751871AD80F1CFAE275C0D |

Rehashed after execution: unchanged. `git status --short`, `git diff --stat`, scoped status and migration diff show the prototype/test are new untracked files, with no migration change. Existing tracked dirty files are handoff/LEDGER.md, src/contexts/tax-fiscal/index.ts and src/kernel/index.ts. Numerous older untracked governance files also exist. These predate this review; they were not changed by the reviewer or silently attributed to Order567. A clean whole-worktree/scope-only diff cannot be claimed from this shared dirty checkout.

## Personally executed proof

`bun D:/Yellow/temp/astra567-run.ts` created fresh reviewer-owned **yellow_astra567_r1** on reviewer-only loopback55564, existing isolated container yellow-astra562-r3-postgres-1. Protected local reviewer password is loaded in process only. PostgreSQL **16.15**. The candidate governance checkout has only canonical0001; its canonical migration runner applied0001 and created schema_migration, yielding **81 public tables**. This is not a claim of testing the unrelated deployed runtime's1–97 frontier.

The script personally ran:

```text
YELLOW_REQUIRE_COMMERCIAL_PROTO=1
YELLOW_COMMERCIAL_PROTO_URL=<process-only reviewer database URL>
bun test tests/commercial-attribution-prototype.integration.test.ts --timeout 120000
```

**16 pass, 1 fail, 29 assertions**,11.64s. The failing test is the authored aggregate latency gate: p95 **358.410ms**, threshold<300ms; p50 **211.666ms**, p99 **372.240ms**. First-leaf p50 **3.279ms**, p95 **4.829ms**, p99 **6.987ms**. These are actual measured results, not implementer output. Before/after this suite I independently computed exact count/full-row-JSON digest for **all81 public tables**: identical. This supplemental passing preservation proof does not fix the authored fingerprint defect below.

`bun D:/Yellow/temp/astra567-hostility.ts`: exit0, meaning the diagnostic probes executed, **not** that the candidate passed them. Reloaded candidate SQL only in this reviewer prototype schema; hostile fixture changes ran inside rollback-only transactions. Retained exact failing outputs in D:/Yellow/temp/astra567-hostility-results.json and actual app_role EXPLAIN plans/settings in D:/Yellow/temp/astra567-plans.json.

`bun D:/Yellow/temp/astra567-referee.ts` created a second fresh **yellow_astra567_referee** on the same isolated55564 cluster, applied candidate canonical0001, loaded canonical tests/seed_fixture.sql and personally ran Windows `python tests/run_invariants.py yellow_astra567_referee` with process-local YELLOW_DSN/PYTHONIOENCODING. **11 passed, 0 failed of11**,81 public tables; actual50-thread occupancy,40-bed contender, balanced/unbalanced journal, sealed day,100 numbering contenders and table/view RLS proofs passed. This is the Windows-equivalent invariant execution, not a claim that the full setup.ps1 orchestration ran. Both reviewer databases are retained; no public container was touched.

Scoped strict command:

`bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution Bundler --types bun --skipLibCheck tests/commercial-attribution-prototype.integration.test.ts`

**exit0**. Initial invocation without --ignoreConfig returnedTS5112; corrected the reviewer invocation, not candidate code. `bun run typecheck` independently fails with16 diagnostics confined to preexisting tax-fiscal index/timeliness/semantic-route test code: absent registration/attribution modules, duplicate CreatePositiveTaxAttributionSnapshotInput, ErrorConstructor mismatches and possibly-undefined accesses. No Order567 test diagnostic occurs. This unrelated root failure remains disclosed, not used to obscure the prototype's own reproduced failures.

## Blocking findings and exact repair obligations

### P1 — Cross-tenant disclosure and absent same-tenant scope proof

schema.sql:4 creates tenant_scope, line210 omits it from the RLS loop, and line220 grants app_role SELECT on **all** tables. Personally SET LOCAL ROLE app_role plus tenantT1 returned both **ALPHA/T1 and HOSTILE/T2** from tenant_scope. Seven security_invoker views and the night_leaf foreign-row denial pass, but do not protect this exposed tenant relation. Apply tenant isolation or deny application access, and enumerate every app-readable prototype table/view in hostile tests.

The same application-role query can see both same-tenant properties; that is expected for tenant-only RLS, but there is no requested/granted-property intersection. The authored “without expanding access” organization test runs privileged and merely counts two properties. Implement the scoped prototype query contract and test one-property authorization, forged foreign/sibling property and alternate-set non-authority. Production permissions/tokens may remain explicitly deferred, but do not claim the Order567-required same-tenant scope proof from a privileged count.

### P1 — Actual stay eligibility and conserved report input are disconnected

report.sql:5 consumes hotel_night, while eligible_hotel_night_source:22 is a separate unused view. Personally setting every T1 occupied_evidence=false yields **eligible_nights0 but reported_nights4**. Making the planned September21 fixture's inventory known produces **occupancy1.0000%**, despite the only night being planned, not occupied. The accepted architecture explicitly separates planned/sold and actual occupied measures.

hotel_night can exist without allocation legs: a new conserved night plus SET CONSTRAINTS ALL IMMEDIATE succeeds, yielding **hotel_nights5 versus reported_nights4** because night_leaf inner-joins allocations. The allocation trigger only fires on allocation mutations and checks NEW for updates, not both moved-from and moved-to identities. Build the report from executable eligibility evidence; distinguish occupied/sold counts; conserve every hotel-night with validated exact allocation or an explicit UNMAPPED leg. Test absent allocations and key-changing leg updates as well as invalid weight sums. Do not hand-seed both the source and expected derived answer independently.

### P1 — Missing history, mixed bases and currency scopes produce false metrics

property_day_metric:74 anchors exclusively on inventory rows. Deleting the explicit September21 missing-history placeholder while retaining the known hotel night returns **zero metric rows**, not an unavailable result. The authored missing-history test only covers a preinserted null placeholder. Drive coverage from requested property/date plus relevant facts and emit unavailable for absent history.

Revenue joins ignore counting_basis. Adding one known bed-capacity row beside room capacity gives **240000 revenue and RevPAR2400 on both room and bed rows**, with null_reason null; room_nights are4/0 respectively. This is not mixed-basis rejection. A USD room-revenue line beside SAR produces two rows each repeating capacity100/nights4 and invents USD ADR2500 using SAR nights. Prove one compatible inventory basis and explicit currency/denominator eligibility, return a reason for unsupported mixtures, and test conservation across the resulting report rows rather than only a GROUP BY currency illustration.

### P1 — Revenue lineage and taxonomy invariants are not executable

revenue_leaf reads independently populated revenue_line; signed_revenue_source is unused by it. A rollback probe changes one normalized amount60000→60001: source total remains240000 while report total becomes **240001** without refusal. Actual signs/reversal selection in signed_revenue_source is correct, but that does not prove derived report lineage or conservation. Derive normalized report facts from exact signed eligible source rows and unique association evidence; test tax/guest exclusion, full reversal, later-date corrections, ambiguous/multi-folio/unallocated revenue and quantity nonmultiplication through the composed report.

hotel_night's individual node FKs do not prove MSG owns MS. Changing one MSG to OTA while retaining NEGOTIATED MS succeeds and reports **OTA/NEGOTIATED**. Enforce/derive the version-local parent relationship, and add foreign-node/version/mismatch tests for both nights and revenue. Ambiguous company currently emits AMBIGUOUS rather than the required stable UNMAPPED leaf plus a reason; allocated revenue without company emits ALLOCATED as a company key. Make the Unmapped contract consistent across grains.

### P1 — Required temporal/conservation/unsupported-scope coverage is largely simulated

The “pins historical taxonomy across its version boundary” test reads a single hand-seeded version2 night. It proves neither a stay crossing the boundary nor pinned-as-booked versus restated behavior, knowledge cutoff/backdated correction, or organization reparenting. The sharer test contains no sharer relation. Alternate-set test counts3memberships/2properties but never executes a deduplicated report union or returns non-additive labels. The ratio test computes VALUES arithmetic rather than composed parent/child KPI conservation. Corrections, overnight moves, zero inventory, suite/constituent overlap, all-Unmapped composed totals and several required company/product scope paths lack meaningful fixtures/proof. Fill the specified architecture/order matrix and retain exact ID/count/amount expected results. Authority that is deliberately deferred should stay labelled unmet, not be mimicked by fixture constants.

### P1 — Performance and no-DML gates are not the requested proof

Authored publicFingerprint at test:22 uses relation bytes and **estimated n_live_tup**, not row values; a same-size update can pass. Replace with deterministic exact row/count fingerprints plus read-only report execution or actual DML privilege denials. Include schema/table inventory and prove no canonical table changes. My independent81-table digest check passes this run but is not a durable correction to the authored oracle.

Benchmark uses an already flattened **UNLOGGED** benchmark_night, bypasses taxonomy/eligibility/revenue/capacity composition, executes privileged queries and retains only20 warm timings after discarding sample0. It contains no EXPLAIN, cold sample, settings/hardware, skew, concurrency,100-room/two-year run, organization/channel/source/company/class/type scope matrix or late page proof. The required aggregate threshold fails in my actual run. Benchmark representative full query work under app_role with the named matrix and retain reproducible evidence; do not widen the latency budget or authorize a typed production projection solely from this simplified miss.

## Personally inspected query plans

After reloading the fictional schema, inserted the same730,000-row shape and ANALYZE'd it, then executed both authored SQL queries with **SET LOCAL ROLE app_role**, transaction-local tenant and READ ONLY; retained `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

- Aggregate: parallel sequential scan,2 launched workers; partial hash aggregate→sort→Gather Merge→final aggregate.20actual groups versus100estimated; **251.142ms** execution,10102shared-hit/2503shared-read blocks, no temporary blocks/spill. This one SQL execution does not erase the authored end-to-end p95 failure.
- Leaf: benchmark_night_leaf index scan with tenant/property/date/reservation keyset predicates and Limit50;50actual rows, **0.110ms**,8shared hits, no reads/spills. This establishes that narrow flat first page only—not full attribution drill or late pages.
- Host AMD Ryzen5 5500U,6cores/12logical; Docker Linux PG16.15. shared_buffers128MiB, work_mem4MiB, effective_cache_size4GiB, max_parallel_workers_per_gather2, jit on. Retained JSON includes exact query parameters and plans. No true cold-cache run is claimed.

## Evidence and disposition

| Reviewer artifact | SHA256 |
| --- | --- |
| D:/Yellow/temp/astra567-run.ts | 736D49D60E4A8CDA83C65E0B406826E91A320AF44DF8D10B00A6E0264ED43A99 |
| D:/Yellow/temp/astra567-hostility.ts | 18DCE8E4E621D4D4EE9E821F92E1410000A25AAFFB2D9C121BB046F8EB50F883 |
| D:/Yellow/temp/astra567-hostility-results.json | C97CA939C6A313A5C9A201DFBBC1C184902426FCFAAB59CA245BDBD46FE5BF3E |
| D:/Yellow/temp/astra567-plans.json | 7B91561F4F384706271C007F6142E68048B834CBF525777640FCDB2054EAA1EA |
| D:/Yellow/temp/astra567-authored-results.txt | D183BDDD4C15264B0E49D37530982BE398313135F969B82E28BA7771528D2DAE |
| D:/Yellow/temp/astra567-referee.ts | F78F5024D685E9413A86C0ACF263DEDD556277086214475B45B42894D1407CC4 |
| D:/Yellow/temp/astra567-referee-results.txt | CC0D73FD59A76DEF759F48BD8C979C0436BBDE4B3719EBD33786A87C68001D76 |
| D:/Yellow/temp/astra567-public-before.json | B3BEBE6DB09D0FE46161BEADCAA89C938D42F95D4DDFFAA34592CA5DC3FE4425 |

**REJECT / CHANGES REQUIRED.** Keep this failure history. Repair only within the order (or govern necessary scope explicitly), add meaningful permanent regressions for the reproduced cases, then request a fresh independent run. Passing canonical11/11, exact signed arithmetic in one source view and seven security_invoker declarations are useful partial results, not a waiver of the data leak, false metrics or absent proof. No production schema, persistence authority, public KPI, migration, deployment or completion-ledger acceptance follows.

---

## R2 — fresh independent review, 2026-09-21 — REJECT / CHANGES REQUIRED

Reviewer: OpenAI Codex independent Astra review agent `/root/astra_review`; not the implementer. R1 remains intact above. Personally inspected the corrected order, all seven scoped prototype/test files, and executed the following against new reviewer-owned PostgreSQL 16.15 databases on isolated loopback port 55564. No public database, runtime application, deployment, or production migration was accessed or changed. The Yellow compliance/entity/PostgreSQL skills informed the tenant, conserved-grain and financial-source checks. No implementation file was edited.

### Frozen bytes, verified before and after proof

| File | SHA256 |
| --- | --- |
| Order567 | DAFE12B9B5162613354F77AFEFCCF2B0AC3E0DBDA99B430ED607EDA5B17171F8 |
| prototypes/commercial-attribution/README.md | DCE0712261C7CAE14F27D6E4177FD387C8A2E96847724910C03DA4E98E0EC87A |
| schema.sql | C0D47D5994F53A596FBF8153F0062F3F3BCE415AB8B860430A4DD0CB8C58F4F8 |
| fixture.sql | 9C57612C2583446FBE4C9F57608E7DD47375DF80051BA6AA9A273A2B283DF86D |
| report.sql | 9B5408CE0A79E3388DD62AD6C0A93D142A20AE8858B6CE64CA3DBA00A2B90852 |
| expected.json | 7EBCE56128204E87AD4009404BF0B67439281D0F5E823004B831C39D01C2447D |
| performance-evidence.md | 799AD62C36189B9EB1A99A2EC043274CE34E2DFD01EAED9066121B4850F8B98B |
| tests/commercial-attribution-prototype.integration.test.ts | 0A7EE73B7A7242F243699DCD0EE6201B9DFFB0D4AEB14668584EA35EEC9B8B79 |

### Executed commands and outcomes

Commands run from the canonical governance workspace unless an absolute harness path is given. Harnesses load protected local credentials in process without logging them; URLs below are not printed or persisted.

1. `bun D:/Yellow/temp/astra567-r2-run.ts` created fresh `yellow_astra567_r2`, personally applied this workspace's complete canonical migration set (`0001_init.sql`, discovered=1), and invoked `bun test tests/commercial-attribution-prototype.integration.test.ts --timeout 120000` with `YELLOW_REQUIRE_COMMERCIAL_PROTO=1` and isolated `YELLOW_COMMERCIAL_PROTO_URL`. **16 pass, 1 fail, 43 assertions**, 17.43 seconds. The only authored failure was the aggregate latency threshold: MSG p95=302.2205ms and MS p95=303.3864ms, required <300ms. Leaf p95=3.8946ms. Do not replace this observed failure with the implementer's passing sample.
2. `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution Bundler --types bun --skipLibCheck tests/commercial-attribution-prototype.integration.test.ts` — exit0, no diagnostics.
3. `bun D:/Yellow/temp/astra567-r2-hostility.ts` — personally executed 16 independent cases. Every mutation was restricted to `commercial_proto` in a transaction which was rolled back. Results below.
4. `bun D:/Yellow/temp/astra567-r2-performance.ts` — populated isolated 73,000/730,000-row shapes, executed app-role scope matrices and retained six JSON `EXPLAIN (ANALYZE, BUFFERS)` plans. Exact public fingerprints still unchanged afterwards.
5. `bun D:/Yellow/temp/astra567-r2-referee.ts` created separate fresh `yellow_astra567_r2_referee`, applied canonical migration0001, loaded only `tests/seed_fixture.sql`, then personally invoked `python tests/run_invariants.py yellow_astra567_r2_referee` with process-local `YELLOW_DSN`. **11 passed, 0 failed of 11**: exclusive/beds races, direct occupancy denial, throughput153/s, journal balance, sealed day, gapless numbering, table and view RLS.
6. `bun run typecheck` — exit1 with the same 16 unrelated dirty tax-fiscal diagnostics: absent registration/attribution modules, duplicate exported input type, ErrorConstructor incompatibilities and possibly-undefined accesses. No diagnostic was in the Order567 test. This is not reported as a clean repository-wide typecheck and is not misattributed to this prototype.
7. `git diff --name-only`, scoped untracked inventory and `Get-FileHash` inspection — scoped prototype files are untracked; unrelated tax-fiscal/kernel/ledger dirt already exists. No whole-worktree-clean claim or attribution of that dirt to this order. Reviewer changed only this review in the repository.

### Blocking findings

**R2-F1 — demand metrics still mix currency denominators and omit eligible revenue.** `report.sql:45–52` groups actual nights without booking currency and anchors `n LEFT JOIN r` on actual nights. In the reviewer rollback probe, a USD2500 unallocated room-revenue line on P1/2026-09-20 correctly produced unavailable property-level denominators (`CURRENCY_PROPERTY_MISMATCH`), but `demand_metric` produced USD `room_nights=1.000000000`, `adr_minor=2500.0000`, borrowing the existing SAR Unmapped night. Separately, the unchanged fixture's P1/2026-09-21 eligible SAR1000 revenue exists in `revenue_leaf` but disappears entirely from `demand_metric` because there is only planned, not actual, demand that date. Preserve the eligible signed revenue grain in the demand rollup, and enforce an explicit compatible-currency denominator rule or named unavailable state there too. Add permanent app-role regressions on `demand_metric`, not only `property_day_metric_range`.

**R2-F2 — revenue mapping key movement bypasses the exact-one mapping guard.** `schema.sql:107–113` checks only NEW identity for UPDATE. In one rollback transaction the reviewer inserted a new eligible SAR1 raw line, moved the existing SAR60000 mapping from posting ID `50000000-0000-4000-8000-000000000002` to that new posting ID, and ran `SET CONSTRAINTS ALL IMMEDIATE`. No error occurred. App-role reads then showed one unmapped eligible source line, source sum **266001** versus report sum **206001**. Ordinary deletion is correctly rejected, but this equivalent orphaning path is not. Reject revenue mapping/source identity moves or validate both old and new identities, with permanent key-move/missing-mapping conservation tests. App-role has no DML; this is a disposable fixture integrity/correctness defect, not a claim that a production report reader can write.

**R2-F3 — performance gate and coverage remain incomplete.** The authored benchmark failed as above and omits the organization query. The independent organization-path join at the 730k shape had warm p95 **369.9867ms**, exceeding300ms. Optimize/measure the required query shape or explicitly govern a revised target; do not silently relabel the failed gate green. Flat benchmark evidence is still not evidence for the complete joined attribution/revenue/report pipeline or multi-property portfolio authorization.

### Remediations independently confirmed

- A1/T1 sees only ALPHA in `tenant_scope`, only P1 property, and only P1 alternate-set memberships. Changing requested property to P2 exposes zero actual rows and zero set memberships. The authored all-surface foreign-tenant enumeration passes; every reporting view is security-invoker. App-role UPDATE is denied.
- Turning off all P1 actual evidence (and clearing its allocation/product fields coherently) yields actual0 while planned stays exactly1. Missing allocation is rejected; split weights are checked; stay-leg identity changes are rejected. Inactive/cancelled labels are not independently substituted for occupied evidence.
- Missing inventory returns an explicit unavailable row with revenue1000 retained. Mixed room/bed history returns `MIXED_COUNTING_BASES_UNSUPPORTED` without capacity/night ratios. Property-level foreign currency denominators are null. The defect is the separate demand view, not these corrected cases.
- Updating a raw source amount by7 moves source and revenue-report sums together to266007. Classification contains no copied amount/date/currency/property. Normal signed revenue/reversals and quantity non-multiplication pass. Unmapped actual/revenue leaves survive; huge exact USD9223372036854775809 remains distinct from SAR500.
- MSG/MS mismatch, ordinary missing revenue mapping and stay-leg key update all reject. These passing cases do not cover R2-F2.
- Exact count+sorted-full-row fingerprints of **all81 canonical public tables** matched before/after the authored run and again after independent probes/benchmarks. No canonical public-row mutation occurred in the proof database. This is not a fingerprint claim about the public demo, which was not accessed.

### Independent performance evidence and limits

Each shape used `SET LOCAL ROLE app_role`, READ ONLY, transaction-local tenant/actor/property, and the authored parallel settings (4 workers maximum, min parallel scan1MB, setup cost0, tuple cost0.01). Measured hotel, authorized organization parent, MSG, MS, channel, source, company, class, type and first keyset leaf; first execution plus five warm samples, with p50/p95/p99 retained. Each aggregate conserved73,000 or730,000 nights; leaf50. The organization read includes only the actor's allowed property, not a fabricated portfolio grant.

| Shape | Aggregate warm p95 range | Organization p95 | Leaf p95 | Representative EXPLAIN execution |
| --- | --- | --- | --- | --- |
|100 rooms ×730 days|24.78–39.39ms|25.61ms|4.393ms|company35.131ms; organization25.402ms; leaf0.319ms|
|1,000 rooms ×730 days|209.80–369.99ms|369.99ms|3.054ms|company322.838ms; organization387.949ms; leaf0.235ms|

Plans retained in the JSON artifact. Large company/organization plans used9159/9131 shared-hit blocks; leaf8; zero shared reads or temporary spills. Small corresponding plans1126/1098/55 hits. These warm plans do not erase the independent end-to-end failed thresholds. No PostgreSQL restart or physical cold-disk run is claimed: the retained isolated cluster serves other reviewer databases, and caches were uncontrolled. Even a PostgreSQL restart would leave the OS cache limitation. This missing cold evidence is a performance limitation, **not a security blocker**.

### Retained reviewer evidence

Scripts: `D:/Yellow/temp/astra567-r2-{run,hostility,performance,referee}.ts`. Reproduction SQL and exact parameters are in those reviewer-owned scripts, not implementation edits.

| Artifact | SHA256 |
| --- | --- |
| astra567-r2-authored-results.txt | 3EC7FD6BFD1B80FACC6A922354EE9659F27DED9F1084B9A5E7170340FF96462C |
| astra567-r2-hostility-results.json | B56A4D19AAE514FE9164569CFB6F103801368A0AD44FCFB9A4D02C7B1FCA3682 |
| astra567-r2-performance-results.json | BEC7B3C3E76CC4A4C3FFE3EB33FCF442EB74B5A7AA4700A7CBBD9F9CC50ADCC7 |
| astra567-r2-referee-results.txt | 95121711703AC5329E26AE7EFA9426528AAD83883687EA9CFFC605B2F70FD1D7 |
| astra567-r2-public-before.json | 66F35A4F6E72EAE14C0559EE837A8D4A79FA009FAAA61017B36C73853A1134C6 |

**R2 verdict: REJECT / CHANGES REQUIRED.** Isolation and many R1 correctness defects are repaired, but exact revenue conservation, currency-safe demand reporting and the required performance gate are not established. No acceptance entry added to either ledger. No production persistence, migration, API, deployment or public KPI authority follows. Retain R1/R2 evidence and request a fresh review after bounded remediation.

---

## R3 — fresh independent review, 2026-09-21 — ACCEPT, isolated prototype only

Reviewer: OpenAI Codex independent Astra agent `/root/astra_review`, not the implementer. R1 and R2 are preserved above. Personally re-inspected all frozen scoped files and executed fresh database, hostility, projection, performance, security and referee proofs. No implementation edits or public/runtime/deployment access occurred. Acceptance is for this fictional schema-free prototype and its explicitly bounded query-shape evidence, not production analytics authority.

### Exact reviewed freeze

| File | SHA256 |
| --- | --- |
| Order567 | DAFE12B9B5162613354F77AFEFCCF2B0AC3E0DBDA99B430ED607EDA5B17171F8 |
| README.md | E5B1AF56A0A29A6A4887A440A3964108E6F7A4B46E35D70C189EC0D533B20D21 |
| schema.sql | C17B1481F16AF04FF1A768013A331033A8A5DA2174185D4CC66C1CCBDA461307 |
| fixture.sql | 9C57612C2583446FBE4C9F57608E7DD47375DF80051BA6AA9A273A2B283DF86D |
| report.sql | 946C75A3B4ABBA9FBDA187A24A386A243B6D5C2E777DF3FFFAD331E5EFA5257F |
| expected.json | 7EBCE56128204E87AD4009404BF0B67439281D0F5E823004B831C39D01C2447D |
| performance-evidence.md | 5D4B4C60ED7B0C29DF693F1064D98A62A7E155C130D2CC2925777A850376579A |
| tests/commercial-attribution-prototype.integration.test.ts | F8FCBB9796F1B393CEFEE0A22C38AB5D47D30DD1368FBDDE315A626C83C44899 |

Hashes personally matched the submitted freeze and were checked again after execution. Paths without a prefix in the table are under `prototypes/commercial-attribution/`.

### Personally executed proof

1. `bun D:/Yellow/temp/astra567-r3-run.ts` created new `yellow_astra567_r3` on reviewer-isolated loopback55564, PostgreSQL16.15. Applied the governance workspace's complete canonical migration set, discovered1/applied`0001_init.sql`. Invoked `bun test tests/commercial-attribution-prototype.integration.test.ts --timeout 120000` with `YELLOW_REQUIRE_COMMERCIAL_PROTO=1` and process-local isolated URL: **17 passed, 0 failed, 49 assertions**,25.67s. All81 canonical public tables had byte-content/count fingerprints identical before/after. Protected credentials were read only in process and not emitted.
2. `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution Bundler --types bun --skipLibCheck tests/commercial-attribution-prototype.integration.test.ts` — exit0. The R2-recorded unrelated dirty repository tax-fiscal type failures remain disclosed; no claim that whole-repository TypeScript is green.
3. `bun D:/Yellow/temp/astra567-r3-hostility.ts` reran all16 reviewer R2 rollback-only cases against the corrected fresh fixture. Both former correctness blockers now close as described below.
4. `bun D:/Yellow/temp/astra567-r3-referee.ts` created separate fresh `yellow_astra567_r3_referee`, migrated, loaded canonical fixture, then ran `python tests/run_invariants.py yellow_astra567_r3_referee` with process-local isolated `YELLOW_DSN`: **11 passed, 0 failed of11**. Includes occupancy races/denial, balanced immutable journals/sealed day, gapless numbering and table/view RLS. Throughput136commits/s.
5. `bun D:/Yellow/temp/astra567-r3-rollup.ts` independently populated both benchmark shapes from the retained source SQL and exercised all12 scopes for both properties under app-role READ ONLY with transaction-local tenant/actor/property. Separately acquired12 distinct database connections for a real concurrent scope matrix. Retained app-role JSON EXPLAIN plans for company/organization/source leaf at both shapes; checked exact81 public fingerprints again, unchanged.
6. `bun D:/Yellow/temp/astra567-r3-extra.ts` compared the complete rebuilt projection with its source-derived expectation in both directions using `EXCEPT ALL`: **zero differing rows**. Inserted a hostile-tenant rollup row only inside a rollback transaction; T1 saw0, T2 positive control saw1/nights999. Tested report-role rollup DML denial and catalogued FORCE RLS/unlogged status.

The retained reviewer scripts are not candidate implementation edits. No migration/runtime file was changed. Existing unrelated worktree dirt remains unmodified.

### Prior blockers and hostility results

- **R2-F1 closed:** injected USD2500 now has null nights/ADR in demand and property views; the authored exact regression also verifies `CURRENCY_PROPERTY_MISMATCH`. Existing revenue-only2026-09-21 remains a SAR1000 demand row with zero actual nights, null ADR and `ADR_NO_ACTUAL_NIGHTS`. No fabricated actual occupancy is introduced.
- **R2-F2 closed:** the identical mapping-key move now fails with `revenue attribution identity is immutable`; rollback leaves source/report totals exactly266000. Ordinary missing mapping and stay-leg identity attacks still reject. Source amount perturbation by7 still moves both source/report totals together to266007; no copied monetary columns were reintroduced into classification.
- Tenant_scope is T1-only. A1 sees P1 only; switching its requested property to P2 returns zero actual/set/rollup rows. Populated foreign-rollup positive/negative controls pass, not merely an empty-table test. App-role cannot UPDATE either stay attribution or the rollup. All six reporting views remain security-invoker; the metric function is invoker, not owner-mediated bypass.
- Turning actual evidence off yields actual0 and planned1. Missing allocation, MSG/MS mismatch, missing mapping and stay-key change reject. Missing history and mixed physical bases retain explicit unavailable responses. Unmapped leaves, signed reversal, tax exclusion, quantity non-multiplication and exact USD9223372036854775809 versus SAR500 arithmetic pass.
- **R2-F3 bounded resolution:** the direct-leaf misses remain historical evidence, not erased or renamed. The source-rebuilt disposable daily projection now meets the requested measured query-shape budget. It is neither a production table nor an authoritative independently writable financial source.

### Independent rollup/performance evidence

For each of100-room/73k and1,000-room/730k source shapes, hotel, organization, chain, brand, region, MSG, MS, channel, source, company, class and type each independently conserve exactly73k/730k. Full-row source rebuild comparison is zero, not only a total-count test. Both benchmark tables are unlogged; `benchmark_rollup` has ENABLE/FORCE RLS and only SELECT granted to app_role. Chain/brand/region labels match this fixture's ALPHA/LUX/KSA hierarchy. No general reparenting or multi-portfolio-authority claim is made.

- Authored largest warm aggregate p95 **91.9339ms** (company); first source-leaf p95 **5.0408ms**. Authored one-connection queued matrix280.2298ms. Its Promise.all on one reserved backend is **not** evidence of12 simultaneous SQL backends.
- Reviewer supplemental warm maximum across12 scopes: **136.1386ms** for73k, **82.7494ms** for730k. Both below300ms.
- Reviewer real12-connection matrix samples: **145.7318,80.5374,105.8145,116.1350,103.3851ms**; p95/p99=145.7318ms. Every connection returned730k conservation. These measurements exclude connection establishment and use12 pre-acquired read-only scoped transactions; no service/network SLO is claimed.
- App-role EXPLAIN execution for73k: organization1.555ms/741hits, company90.987ms/3208hits, source leaf0.446ms/40hits+18reads. For730k: organization1.302ms/743hits, company71.260ms/3208hits, source leaf0.324ms/11hits. No temporary spills. Full plans, parameters and all first/warm samples retained.
- No physical cold-disk or cold-shared-buffer claim. The retained reviewer cluster was not restarted because other reviewer databases share it; fixture/ANALYZE and host cache effects remain. This is an explicit performance limitation, not a security blocker or disguised passing cold benchmark.

The benchmark measures bounded nightly-count rollup shapes; it does not measure a complete production joined money/attribution pipeline, arbitrary skew, deep pagination or arbitrary organization reparenting. Production refresh/cutoff, activation/CAS/override authority, rebuild/recovery, cursor signing, real grants and persistence migrations remain separately governed prerequisites, as the README states.

### Evidence artifacts

All under `D:/Yellow/temp/`:

| Artifact | SHA256 |
| --- | --- |
| astra567-r3-authored-results.txt | EE1236A3EBE3073357CF1AC490A3374FA8F9CDA31C1EA9B6160799D4DD54C830 |
| astra567-r3-hostility-results.json | C2FE4538C7C2BC971DFA4E55F9D12A0150603E55DDB6EB19D3A0662FA9B50793 |
| astra567-r3-referee-results.txt | ACD813DAFD03826A8D61AFF31D79E0229DBBF79FD6E9F814B149FD644776DDF8 |
| astra567-r3-rollup-results.json | B571D36C788E8C73E131270A55422B7784A4A4B97950160C266185C14A0FEDF0 |
| astra567-r3-extra-results.json | D5E5C1DF02286A5D804979818CA4871A591D25014E29AE2A65F0F68A64D6E62D |

**R3 verdict: ACCEPT — isolated schema-free prototype only.** No remaining blocking defect was reproduced in the corrected scoped contract. Acceptance entries may record this bounded result, preserving R1/R2 failure history. No production/public mutation, migration, deployment, financial reclassification, public KPI certification or whole-PMS readiness follows.
