# Order562 independent preflight — ACCEPT PLAN with required amendments

Reviewer: Codex `/root/astra_review`, independent non-implementer. 2026-09-21.

**ACCEPT the architectural plan, conditional on the explicit scope/contract amendments below before implementation. This is NOT source acceptance, migration/deployment authority, permission provisioning approval or permission to configure public data.** Source and live gates require separate personally executed independent review. Order561 stays blocked.

Read Order562, canonical PROJECT/AGENTS, existing FolioService/0073 allocator, operator boundary, seed-review permissions, CONTRACTS/EVENTS, Reviews496/558/559/561 and relevant decision search (especially D1216 direct-counter containment and D1440 existing fiscal-series atomic configuration). Yellow PostgreSQL/entity and engineering-review guidance applies. Reuse document_series; do not add a numbering primitive or reuse fiscal invoice configuration authority for non-fiscal folios.

## Current-target evidence, personally refreshed

Ran `bun D:/Yellow/temp/astra-order561-preflight.ts` again, exit0, READ ONLY tenant-scoped SQL and automatic-session/readiness only; no configuration/folio/check-in command. At2026-09-21T02:13:36.934Z all129 table fingerprints including ledger remain aggregate `B9411D8C1B7E10A996DC4F907E4971CE62133FA30C95A29CA698F2F20048A750`, same baseline as561. Public frontier96 and reviewed560 image remain the prior independently verified baseline; no97 execution is claimed.

Exact property6081b544-22a1-534f-a86d-bb1ae0519e14 / tenant6d9b7ce2-2d14-5576-b8c3-80f06501a603 has zero kind=folio document_series. Existing fictional target remains unique due_in, one booked segment/primary guest/exclusive occupancy, inspected room, no account/folio, readiness200 with sole primary_folio_not_open. New configuration must affect only that property after fresh final admission. No raw guest/contact/payment/document data needed.

## Required scope/contract amendments

1. Enumerate concrete file paths before edits: migration0097; the chosen new financials service and index export; src/http/operator.ts; src/app.ts/runtime composition where needed; exact integration/operator/HTTP tests; permission and review-fixture exports/tests actually touched. Add **docs/CONTRACTS.md and SCHEMA.sql** explicitly for API/SQL/replay/privilege contract and required schema equality. If another file is needed, amend scope openly; “service and export” is not silent permission to edit any context/kernel.
2. Separate **same-key replay** from **same-prefix new-key no-op**. Same-key must return the original canonical status/body, including original created=true on first-creation receipt, with replay metadata in the established header convention. Same-prefix/new-key returns existing created=false; no new series/fact/outbox/counter change, but exactly one new completed idempotency receipt is expected. Changed body under reused key conflicts. Never rewrite a historical receipt to pretend its original effect was a no-op.
3. Existing canonical prefix after legitimate allocations must return the existing root WITHOUT resetting next_no, tail or any field. Require valid next_no>=1 within bigint allocator range; reject corrupt/fiscal-shaped lineage. Clarify conflict handling when any second kind=folio row exists, including fiscal-marked rows, rather than accidentally adopting one among multiple roots. Never repair/reset/relabel existing rows.
4. Enumerate permission-registry and role_permission writes as explicit deployment effects. New permission creation is not configuration-time authority to grant all roles. Bind any fixture parity grant to exact known role identity, current full-config authority and pre/post topology, with no new user_role, ancestor/property expansion or role replacement. Public permission provisioning needs an exact reviewed row allowlist and independent proof; never rerun the broad seed to install one permission. Newly issued session must carry actual current authority, not a forged added scope.
5. Define fact entity_type=document_series and fact_type=configured; event_type=folio.series.configured/version1, aggregate_type=document_series/id=new UUID. Both payloads have exactly the five specified camel-case keys. Explicitly bind authenticated actor, property, correlation=request ID and transaction-stable property-local business date; no fabricated relationship to fiscal API correlation semantics. Document first-creation HTTP status, no-op status and exact minimized DTO.
6. Clarify referee wording: fresh/upgrade/11-invariant destructive fixtures execute only on reviewer-owned isolated databases or safely separate copies, **never after promotion against public hotel data**. Live postflight is READ ONLY catalogue/effect/health verification plus the separately admitted exact configuration request/replay.

## SQL/service/authority acceptance criteria

- Forward immutable0097; no existing migration rewrite. yellow_owner SECURITY DEFINER, exact safe search_path, PUBLIC/raw-runtime execution revoked, app_role only. Check session_user yellow_runtime, current runtime role app_role, transaction-local tenant nonnull/valid/exact. No function overload/temporary-schema name-shadow escape. No raw document_series INSERT/UPDATE/DELETE or next_no column authority restored.
- Validate exact active tenant, real property and timezone, active actor/current exact-property configuration grant, malformed/null context and all payload boundaries fail closed. API rejects extra authority/series/FY/supplier/kind/fiscal/counter/hash fields; no implicit trimming accepting a different request. Capability independently enforces its domain and authority boundary rather than trusting body flags.
- Authorization precedes every path, including same-key replay and existing-prefix no-op. A previously valid token must not override revoked current actor/property grants. If service idempotency returns before SQL function execution, explicitly revalidate authority first. Follow existing tenant-hidden HTTP convention.
- Serialize with the **same exact tenant/property non-fiscal-folio advisory key/root used by allocate_non_fiscal_folio_reference**, then lock/revalidate canonical property/authority and all matching series as needed in a consistent order. The empty-root case must be protected; different-prefix uniqueness alone does not prevent two roots. Existing allocator must not observe partial configuration or counter reset.
- Exactly one initial INSERT kind=folio/fiscal=false/next_no1/supplier-registration-null/FY-null/hash-tail-null plus one configured fact and one outbox, committed with actor/body/key-bound idempotency in the same transaction. No evidence on no-op/denial. No nested committing connection or dual publication.
- Existing same-prefix canonical row is a read/no-op even after use; all fields/counter/history stay unchanged. Different prefix, duplicate root, fiscal/registration/FY/tail contamination, invalid next_no/property/actor/tenant/grant is conflict/denial with zero partial state. No upsert that overwrites or silently adopts divergent truth.

## Required executable red/green matrix

Use fresh reviewer-owned PG16 with standard roles/SCRAM or equivalent real runtime-role login and migrations1–97. Also prove actual96→97 upgrade of existing96 data/ACLs, idempotent migration-runner replay and exact97 checksum/schema dump. A fresh bootstrap alone is not the upgrade proof.

1. Intentional named regressions must fail before implementation: missing command/capability/permission; no authorized create; raw DML denial must remain green, not weakened to make creation possible. Preserve exact initial failures.
2. Genuine authenticated HTTP create with `{prefix:'L3R-FOL-'}` and normal runtime transaction: first201/minimized coherent DTO, exact one series/configured fact/event/completed key, actor/property/correlation/business-date binding and exact payload keys. Assert all existing129-table row fingerprints except the explicit new config/evidence/idempotency rows are preserved; schema/permission changes are established separately before command baseline.
3. Same-key identical HTTP retry returns byte-identical original body/status and replay header, all table hashes unchanged. Changed body same-key conflicts. Same-prefix/new-key created=false and only idempotency addition; different prefix/new-key rejects without even a partial completed receipt. After real isolated allocator advance, original-key replay and new-key no-op preserve the advanced counter exactly.
4. Missing/bad token, missing scope, ungranted/foreign property, foreign tenant, inactive actor, removed grant, absent/empty/malformed/foreign tenant context, raw yellow_runtime role and privileged wrong session. Test authorization AFTER waiting on a held root/relationship as well as before. No cross-tenant discovery or fact leakage.
5. Prefix null/empty/whitespace/25chars/control/Unicode/invalid punctuation; missing/extra keys; authority-bearing JSON; null UUIDs, invalid property kind, incoherent tenant; duplicate roots, fiscal=true, supplier/FY/hash contamination and invalid counters. Snapshot exact no-write fingerprints for each denial, not merely response code.
6. Real PostgreSQL concurrent same-prefix different-key calls converge to one series/fact/event, all others canonical no-op. Concurrent different-prefix requests choose exactly one root, others conflict. Observe actual blocking with pg_blocking_pids/exact PIDs for configuration vs allocation and authority/series drift. No timing-only inferred concurrency.
7. Inject failure after series/fact and at/after actual outbox insert; prove series/facts/outbox/idempotency all rollback and clean same-key retry succeeds once. Repeat publication failure after contentious wait. Preserve existing advanced counter on hostile replay.
8. Catalogue effective owner/search_path/SECURITY DEFINER/execution ACLs; table AND column raw DML denial; two-tenant RLS on series and views; target-specific grant boundaries. Check PUBLIC/default privileges and no unintended new role membership.
9. Existing allocator/financial-folio tests remain green: non-fiscal only, exact root, gap-free allocation, existing financial atomicity/replay and no reset. Genuine HTTP proof cannot be substituted by mocked adapter tests. Independent reviewer personally executes current frozen proof; root results alone insufficient.
10. Focused source/operator tests, strict types, boundaries where relevant, schema equality and clean separate referee11/11. Build image from accepted bytes; no unrelated runtime drift. Record hashes, commands, test counts, skips and all failures without relabelling skipped DB tests as pass.

## Public deployment and exact configuration gates

Separate implementation/source ACCEPT precedes any public action. Rebind current source-vs-running image delta and ledger96; exact97 and minimum permission topology must be reviewed. Create private checkpoint (restricted child ACL, custom pg_dump digest + readable catalogue) BEFORE migration; retain old app image. Stop/recreate only app as required, preserve PostgreSQL/Valkey/tunnel/volume. Use normal runner `run --rm --no-deps migrate`; do not invoke provision/seed. Independently prove96→97 exact ledger, function/ACL/RLS, and data deltas only approved permission registry/grant rows. If role grant cannot be achieved inside reviewed scope, STOP.

After healthy exact-source promotion, take the separate pre-configuration checkpoint and fresh complete table/evidence baseline. Verify target root still absent, exact current token/grant/property and prefix. One canonical API request with one retained stable key/correlation (no credentials in logs) may create the root; same-key identical replay must duplicate nothing. Independent current-state proof: one target series next_no1, fiscal=false and lineage null; exactly one minimized configured fact and event; one completed actor-bound idempotency row; every forbidden/other row preserved. Fresh no-op checks must distinguish their new idempotency record from duplicate configuration effects.

Do not open a folio/check in under562. After configuration acceptance, rerun561 preflight and recapture its now-new baseline. No automatic cleanup/rollback of successful configuration; application rollback keeps forward schema and immutable evidence. Migration failure keeps the app stopped for review; no improvisational down-migration or restore. Both source and public final verdicts remain pending.

## Amended-order disposition — ACCEPT PLAN

Personally reread amended Order562 SHA256 `21802C077C339FA9A254B7FCF1F914259D4B07D1C8E0227C2FB8BD1C9E87DF97`. It now enumerates service/index/operator/app/conditional server paths, CONTRACTS/EVENTS, exact tests, replay semantics, used-counter preservation, locked live authority and same allocator root; permission changes require an explicit single-role allowlist. **ACCEPT PLAN for bounded source implementation against this amended contract and the proof matrix above.** It does not authorize public deployment/configuration yet.

Scope correction to the reviewer's earlier generic SCHEMA.sql suggestion: this runtime has no root SCHEMA.sql; personally verified scripts/schema-drift.ts uses existing `tests/schema/expected.sql`, now explicitly scoped by the order. That is the correct canonical dump path here; do not create a redundant schema file.

Future gates still require specificity before action: actual public provisioning script/receipt path and exact role UUID/preexisting authority/topology must be frozen in scope before that script is authored/executed. No live grant has been selected or approved by this preflight. Resolve the order's broad “no raw public DML” against any proposed permission provisioning mechanism explicitly; never treat fixture parity as permission to rerun seed or insert a document_series row directly. Interpret postpromotion referee strictly as an isolated-copy gate, with read-only live postflight; no destructive test fixtures on public data. Detailed response/envelope contracts remain required in scoped docs and source review. These are staged admission boundaries, not permission to omit proof.

## Final source review R1 — REJECT / CHANGES REQUIRED (2026-09-21)

Reviewer: Codex `/root/astra_review`, independent non-implementer. Governing amended order SHA256 `1A9F5DD8C4462307F50C268F15FD222F0BBC8A75B9775DAA1DF0C2ACA945C519`. This section supersedes plan acceptance only as a source verdict; the plan history above remains intact. **Do not promote, provision public permission, configure the public series, or resume Order561 from this candidate.** No public app/database operation was performed in this review. Implementation files were not edited.

### Blocking findings, independently reproduced

1. **P1 — same-key replay bypasses live locked authority.** `src/contexts/financials/folio-series.ts:145` enters `PostgresIdempotency.execute` before any authority validation; `configure_non_fiscal_folio_series` is only inside its new-command callback at line163. Kernel replay returns the stored receipt without calling that callback. Personally created a series, removed its current role permission, and retried the identical original key: service returned201/replayed=true; a new key correctly failed42501. Restored permission, marked actor inactive, and used the actual signed Elysia HTTP adapter: identical original key returned201/replayed=true, while a new key returned403. `listGrantedProperties` is unlocked and does not check active actor/tenant, so it does not close this gap. The existing test called `order562-inactive-replay` with a previously unused key; its name is not replay evidence. Required repair: current tenant/actor/property/grant validation under held locks before every idempotency return, with original same-key response preserved after successful validation. Add real revoked/inactive same-key HTTP/service regressions and observed contention/revocation tests.

2. **P1 — fiscal-shaped folio roots are ignored rather than rejected.** Migration0097 lines141/154 filter discovery to `fiscal=false`. On a separate isolated property I inserted a preexisting `kind='folio', fiscal=true` row as hostile deploy fixture. The governed command then returned201 and created a second kind=folio root, plus one configured fact, event and completed receipt. Counts changed series2→3/facts1→2/events1→2/receipts1→2 across the reviewer tenant. This violates required behaviour4 and the preflight's explicit any-kind=folio contamination boundary. Count/lock and validate the complete root topology, rejecting fiscal-shaped and mixed/duplicate roots without writes. Add fiscal-only and mixed-root cases, not merely two non-fiscal rows.

3. **P1 — public grant helper does not validate the complete authority topology it expands.** `tools/provision-public-folio-series-access.ts:41–43` selects only the expected actor's selected exact-property membership; lines54–73 check only the new permission row and which role receives it. It never compares all memberships/recipients/scopes of that role or its preexisting full permission set. On a fresh isolated97 database I installed the exact pinned tuple/name/path but gave the role zero preexisting permissions and an additional unexpected user's membership over another property. Running the unmodified helper returned exit0/created=true/grantCount1; the unexpected recipient gained the new permission over that other property. This is not an assertion about actual public topology: it is an executable fail-open topology regression. Freeze and lock/compare the entire intended role permission set and all affected memberships/scopes/recipients against the reviewed allowlist before insert and replay, and fail on extras/missing/deactivated topology. Also validate exact ledger checksum/frontier, set transaction-local tenant context before tenant-scoped queries, and fail closed on non-designated/non-loopback connection parameters before any future public execution. Do not infer full access from a role name. The order must explicitly describe the narrowly authorized role_permission mutation as the exception to its otherwise absolute no-raw-public-DML wording.

### Personally executed proof and results

All database proof used a **new reviewer-owned PostgreSQL16 Compose project** `yellow-astra562-review`, loopback port55562; isolated Valkey6397. Nothing targeted public55432 or legacy5442. Passwords came only from protected runtime `.yellow/runtime-database-authority.env`, loaded in process memory; no URL or password is recorded here.

- `bash ./state.sh`: unavailable, WSL `/bin/bash` missing; not counted as a pass. Read PROJECT/AGENTS, order, previous review, relevant decision search, SQL/service/kernel replay, route/composition, seed permission exports/test, docs and schema. Used Yellow PostgreSQL/entity and engineering code-review skills.
- PowerShell, runtime cwd: `$env:COMPOSE_PROJECT_NAME='yellow-astra562-review'; $env:YELLOW_POSTGRES_PORT='55562'; $env:YELLOW_VALKEY_PORT='6397'; $env:YELLOW_APP_PORT='30562'; ./setup.ps1 -DbOnly` → **exit0; two fresh1–97 migration passes; referee11 passed/0 failed**. Referee exercised real occupancy concurrency, raw DML denial, balance/sealed-day, gapless fiscal numbering, table/view RLS. The script's printed “129 after migrations1–91” label is stale; actual migration output included97. No app was started.
- `bun run typecheck` → exit0. `bun run boundaries` → exit0,201 files. `bun test tests/nonfiscal-folio-series-configuration.intentional-red.test.ts` →3/0/18. This is a current green source-contract test; I did not personally witness the original intentional-red run.
- `bun D:/Yellow/temp/astra562-proof.ts` → exit0. Creates `yellow_astra562_upgrade`, applies exact copied migrations1–96, adds one fictional tenant sentinel, fingerprints127 public tables excluding permission/ledger, then applies **only0097**: all127 fingerprints identical. Ledger count97/min1/max97 and exact0097 checksum verified; normal runner second call applies0. `pg_dump --schema-only --no-owner --no-comments` via the reviewer container, normalized with the canonical schema routine, equals `tests/schema/expected.sql` exactly. This is genuine96→97 existing-data upgrade plus separately observed fresh bootstrap, not a fresh database mislabeled upgrade; it is not a full public-data upgrade rehearsal.
- The same harness runs `bun test tests/nonfiscal-folio-series-configuration.intentional-red.test.ts tests/nonfiscal-folio-series-configuration.integration.test.ts tests/operator-nonfiscal-folio-series-configuration.integration.test.ts --timeout 120000` with paired isolated `YELLOW_ORDER562_*_DATABASE_URL` and `YELLOW_REQUIRE_ORDER562_DATABASE=1` → **10 passed/0 failed/75 assertions, no skips**. Actual runtime login, app_role, owner/search_path/execute ACLs, direct INSERT/UPDATE/DELETE42501, deploy invocation denial, first/same-key/new-key, used allocator counter, changed-body conflict, twenty concurrent same-prefix calls, and signed `createApp.handle(Request)` HTTP adapter exercised. This is real authenticated adapter+Postgres proof, not a listening-network/browser proof.
- Same harness creates separate fresh `yellow_astra562_seed`, migrates1–97, runs `bun test tests/review-seed.integration.test.ts --timeout 120000` with required flag, paired isolated URLs and ephemeral reviewer credential → **27 passed/0 failed/117 assertions**. Exact scope-string test includes configure; subsequent read-only catalogue query independently shows exactly one new permission grant, to `Local Availability Reviewer`, none to another role. No public seed was run.
- `bun D:/Yellow/temp/astra562-hostility.ts` → exit0 with explicit diagnostic outcomes, **confirmed findings1/2 above**. Independently verifies another tenant sees0 target series under app_role, document_series column INSERT/UPDATE/DELETE grants0, real AFTER INSERT outbox-trigger failureP0001 rolls back series/fact/event/receipt counts, then identical-key retry succeeds201 once. This harness intentionally reports unsafe actual results; exit0 is execution completion, not product acceptance. Trigger removed only from this disposable fixture.
- `bun D:/Yellow/temp/astra562-concurrency.ts` → exit0. Observed exact blocked runtime PID1397 via `pg_blocking_pids` behind reviewer advisory-root holder1389; release yields200/created=false. Real allocator advance followed by original replay preserves original nextNo1 while fresh-key canonical no-op reads nextNo2, never resets. Held actor inactive UPDATE blocks runtime PID1395 on holder1389; commit then denies42501. These prove new-command locking works, not that same-key authority is safe.
- `bun D:/Yellow/temp/astra562-grant-hostility.ts` → final fresh isolated run exit0, exact unsafe grant result described in finding3. Initial attempt on the earlier hostile database correctly rejected because an unrelated role already held the permission; that was fixture contamination, so I reran in newly created `yellow_astra562_grant`, migrations1–97 and no other grants. Both outcomes are retained honestly.
- Explicit tool strict check: initial command without `--ignoreConfig` returnedTS5112 (TS7 command-line-file rule). Corrected `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2024 --module Preserve --moduleResolution Bundler --types bun tools/provision-public-folio-series-access.ts` →exit0. Root tsconfig excludes tools, so root typecheck alone was not attributed to this helper.

### Additional proof required after repair

The authored10/0 suite is insufficient for the accepted preflight matrix. It lacks actual same-key revocation, complete fiscal/duplicate/lineage/counter/null/tenant-context hostility, locked replay checks, genuine different-prefix concurrency and configuration-vs-allocation interleavings, exact whole-table command preservation hashes, first-write fact/outbox failure injection, and complete actor/property/correlation/business-date evidence assertions. Its authored rollback case throws after a new-key **existing-root no-op**, not after initial series/fact/event creation. Reviewer AFTER-outbox reproduction adds useful evidence but compares counts, not complete contents. Do not present these gaps as fully proven by the current suite. Add durable regression tests and rerun fresh frozen-byte independent proof; inspect full data fingerprints for allowed command deltas. Exact helper replay/concurrent topology changes and its designated-target safety also require proof. No frontend change was in scope; no browser/mobile or production-image build is claimed here.

### Frozen source SHA256

| Path | SHA256 |
|---|---|
| migrations/0097_governed_nonfiscal_folio_series_configuration.sql | 218117A8CDBEBBEC15BBB9341D8173903123C06FCD1ECA26BECDECB828AE7E83 |
| src/contexts/financials/folio-series.ts | 4561CD6804A0724306E154E1DE12CDE2BB7D0AF487701175498BA93CFAC54DA6 |
| src/contexts/financials/index.ts | A5EAAA27567A55D0334674A51B08659D27248EAFADEF20E033ECE17DBABE15B5 |
| src/http/operator.ts | 0DDC5724FAE364129D0D472ABE8E5D8DA9626BAE4FCE881FEBD960A1E2CB3593 |
| src/app.ts | 821ECBA09F9FD3E620BDF2DAA13DCF846EAF13E782B20CB2C9EBF9B185E2AB7B |
| src/server.ts | C88848641D17A6A4EF0713498D5224C4D92D946A4364E6559466984035718693 |
| docs/CONTRACTS.md | ED760168BCFC446074FE7AE6640A8B3BF298DBBC7070E798E88ECC8B88A395B2 |
| docs/EVENTS.md | A439A989E1BFD7E41D153CF2AE8EF0434373EDC77865EF41C0714A0CF6D64CCB |
| tests/schema/expected.sql | D49385A98AC58DE5394B94C3A9CB99ACC1A4CA8FA9315EBE9DDA24405C8C557B |
| tests/nonfiscal-folio-series-configuration.intentional-red.test.ts | A445DA986D0ECE111EF9C98EBB3D72B08FD8EAFDD43BE28EBBF44E9D050F3AF3 |
| tests/nonfiscal-folio-series-configuration.integration.test.ts | CB8C8DC82ED629A588C002C2C573BA148D3D2224CE6FFC9092C76CE447F2079F |
| tests/operator-nonfiscal-folio-series-configuration.integration.test.ts | FE56CE509B4D7A4977C6874307577026B00F0501D8574ECE6175885E993111D3 |
| tests/review-seed.integration.test.ts | 8985A30317410366EE7F5CD436B24C7CFF630F1A5779C8469B4297EE673540DB |
| scripts/seed-review.ts | 61ABD9FB8A4BC596ED39F1CDB2063BB0F5407EA7E5D56737854BF4F36D4702A0 |
| tools/provision-public-folio-series-access.ts | 43B13123CB821B57800326C6E6FF6802A8BF051A25E141E8FA569250261C0441 |

Retained reviewer-owned executable evidence (not production source):

- `D:/Yellow/temp/astra562-proof.ts` SHA256 `17075F219BA550ADD268E3B119BC02162ADE0343E19D143593730C8D553CFF13`.
- `D:/Yellow/temp/astra562-hostility.ts` SHA256 `A6EB8FB598C716B5B0FDD3A989EC8325E137AF8D293ADE2AECF30F0E337F56CA`.
- `D:/Yellow/temp/astra562-concurrency.ts` SHA256 `8409CAAA26FAF09B01F0BE06B887800A35C3E250A05A575FC251B54E40056610`.
- `D:/Yellow/temp/astra562-grant-hostility.ts` SHA256 `7A36D14A6A8DB3BC5ADDEC83F5686350C3DB0C372A2FCA70E5A894FAB2943C09`.

These harnesses create named fixtures/databases; rerun on new reviewer-owned names or explicitly reset disposable fixtures, never point them at public/real data. Isolated review containers/data were retained, not removed. **Final R1 verdict: REJECT.**

## Independent R2 — REJECT: concurrent permission-topology expansion (2026-09-21)

Reviewer: Codex `/root/astra_review`, independent non-implementer. Read amended Order562 SHA256 `3DE4445F3CBA90144910C2AE56D8332CD3BDC20184E5CE8449D33F6E2359F036`, current migration/service/provisioner/tests/docs/schema and the R1 failure history. PostgreSQL/entity and code-review guidance again applied. No candidate edits, public connection, deployment, grant or configuration occurred. The newly explicit single role_permission exception and nine-property effect are now documented in the order; that R1 scope ambiguity is resolved.

### R1 remediation verified

- Service now executes owner-mediated `assert_non_fiscal_folio_series_configuration_authority` before idempotency lookup; creation reuses it. The authority capability is SECURITY DEFINER/yellow_owner, fixed search_path and app_role-only execution with runtime session/role/tenant validation and held actor/tenant/grant/property locks. My unchanged prior-case reproduction (retargeted solely to fresh R2 test database) now denies revoked same-key and new-key service calls42501, and inactive same-key/new-key signed HTTP requests403. No successful stale receipt returned.
- Migration now discovers all kind=folio roots. Same prior fiscal-only fixture rejects55000 with series/fact/event/receipt counts unchanged. Authored mixed-root test also passes. No reset or financial effects added.
- Provisioner pins the CLI URL, ledger97/checksum, complete65 prior permissions and nine memberships; preexisting missing permission/extra actor/foreign recipient tests now deny. Exact first grant and replay tests pass. However, the topology check is not stable against a concurrent insertion, below.

### Remaining P1 blocker — phantom membership enters between validation and grant

In `tools/provision-public-folio-series-access.ts`, line150 locks the parent role `FOR SHARE`; lines161–178 select/lock only existing memberships, and the final checks at215–218 reread permissions but not membership predicates. PostgreSQL FK `KEY SHARE` acquisition for a newly inserted `user_role` is compatible with the parent's SHARE row lock. The custom advisory lock is used only by this helper, not other membership writers. Thus neither new recipients nor new scopes are excluded while the helper runs.

**Personally reproduced on fresh PG16, not a mocked race:** seeded exactly65 permissions, nine expected memberships and an extra active actor without a role. Held `LOCK TABLE role_permission IN SHARE MODE` from reviewer blocker PID889. Started the unmodified `provisionFolioSeriesAccess` using a separate connection; observed PID892 blocked on its actual `INSERT INTO role_permission` via `pg_blocking_pids`, after it had passed topology validation. From the blocker transaction inserted a10th membership for the extra actor and committed, releasing the insert latch. The helper committed `created:true, grantCount:1, membershipCount:9, rolePermissionCount:66`; actual membership count was10 and the extra actor had gained configure authority. No operational/financial command was invoked.

This violates required behaviour11 (“any extra actor/membership… fails before insert”) and produces a stale safety receipt. It is the remaining **source-blocking** defect, not evidence of actual public drift. Required repair: serialize the role/permission relationship roots strongly enough to exclude incoming membership/permission phantoms throughout validation, insertion/replay and commit; use a consistent lock order, then revalidate the entire topology. Do not substitute another unlocked reread or a helper-only advisory lock. Add durable observed-interleaving tests for a new actor/new scope and an extra permission/recipient, testing both writer-first rejection and helper-first serialization; prove the original first/replay result is preserved without deadlock. A separately verified writer-free maintenance window is still required at public execution, but does not make this advertised fail-closed helper safe by itself.

### Fresh reviewer-executed results

New isolated project `yellow-astra562-r2`, PostgreSQL55563, Valkey6398; protected local authority file consumed only in process memory. R1 databases were not reused or upgraded over the superseded97 checksum.

1. PowerShell runtime cwd: `$env:COMPOSE_PROJECT_NAME='yellow-astra562-r2'; $env:YELLOW_POSTGRES_PORT='55563'; $env:YELLOW_VALKEY_PORT='6398'; $env:YELLOW_APP_PORT='30563'; ./setup.ps1 -DbOnly` →exit0, fresh migrations1–97 twice and **referee11 passed/0 failed**. No app start.
2. `bun D:/Yellow/temp/astra562-r2-proof.ts` →exit0. Fresh `yellow_astra562_r2_upgrade`: migrate1–96, fictional sentinel,127-table fingerprint, upgrade **only0097**, all127 unchanged (permission/ledger excluded), ledger1–97/exact checksum, runner replay0; canonical normalized schema equality PASS. Separate fresh `yellow_astra562_r2_seed` used for review seed.
3. Harness runs `bun test tests/nonfiscal-folio-series-configuration.intentional-red.test.ts tests/nonfiscal-folio-series-configuration.integration.test.ts tests/operator-nonfiscal-folio-series-configuration.integration.test.ts tests/public-folio-series-access-provisioning.test.ts tests/public-folio-series-access-provisioning.integration.test.ts --timeout 120000` with required database flag and paired isolated URLs →**17 passed/0 failed/130 assertions**, no skips. Includes exact payload/actor/date/correlation assertions, true revoked same-key tests, mixed roots, initial outbox failure/rollback/retry, same/different-prefix races, signed HTTP, and exact grant/no-op/hostility cases.
4. Fresh required `bun test tests/review-seed.integration.test.ts --timeout 120000` with ephemeral credentials →**27 passed/0 failed/117 assertions**.
5. `bun run typecheck`, `bun run boundaries` (201 files), and `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2024 --module Preserve --moduleResolution Bundler --types bun tools/provision-public-folio-series-access.ts` →all exit0.
6. `bun D:/Yellow/temp/astra562-r2-hostility.ts` →exit0; prior defects now rejected as detailed above; cross-tenant target visibility0, column raw-DML grants0, AFTER-outbox failureP0001/count rollback and identical-key retry201 preserved.
7. `bun D:/Yellow/temp/astra562-r2-concurrency.ts` →exit0. Observed runtime PID926 waiting behind root-lock holder917, then canonical200 no-op. Original receipt still nextNo1 after real allocation; fresh key reads2 without reset. Observed runtime PID925 waiting behind holder917's inactive-actor update, then42501 after commit. This validates current new-command lock behaviour; it is not the missing helper phantom protection.
8. `bun D:/Yellow/temp/astra562-r2-grant-race.ts` →exit0, **unsafe actual result**, worker892/blocker889/membership9→10 and extra authorized recipient. Harness exit0 means reproduction completed, not a product pass. Directly calls the exported transaction helper only on newly migrated reviewer-owned `yellow_astra562_r2_grant_race`; CLI target guard is not bypassed on any real target.

The earlier preflight's outstanding full-table command-preservation/extended malformed-context and post-wait replay matrix must not be relabeled as fully proven by these narrower suites. R2 adds substantial real proof, including the formerly missing first-write outbox rollback and different-prefix concurrency. No network listener/browser/build/deployment or public-state claims are made. Reviewer containers/data remain retained.

### R2 byte binding

| File | SHA256 |
|---|---|
| migrations/0097_governed_nonfiscal_folio_series_configuration.sql | 27EF8BF95F5CA18B54ABB031298825AB6536F28A9CA1A0AFBFF762BBA3B53DCA |
| src/contexts/financials/folio-series.ts | A672630295346423022CEFDE1F946C75000964F56AC37F5148F1C55402028EC8 |
| tools/provision-public-folio-series-access.ts | 4EFBBCBA0CE41FEF9856D7696A130FD9C50BF1C539141CDFE0F3518B756F34ED |
| tests/nonfiscal-folio-series-configuration.integration.test.ts | 9F3B9FE9325184EFEC81D49581F7CDFC81FC8DAE724F10F2691852C78F2186B9 |
| tests/operator-nonfiscal-folio-series-configuration.integration.test.ts | DBA2C1659CF3956AEBD8124AF33399571FEC29EB9A0B07C84D5BC3252DDB3D0D |
| tests/public-folio-series-access-provisioning.integration.test.ts | 41F97482879D70715A73D3F623EB606C7CD9457131D1BAED57C6B0E6F319619E |
| tests/public-folio-series-access-provisioning.test.ts | 748A45B8703196A0D04CBE3128F3A6556965515EF6428272927FC41C97935E31 |
| docs/CONTRACTS.md | 4F7A8E6B08D5A010391FE7927E57ADA4C63F2778CA167ECDB62C732F0B75019B |
| docs/EVENTS.md | BF06634A6AFD15804B8A18AC755AC0CAD6F555882AF51C7B6DBA7161422AE467 |
| tests/schema/expected.sql | 1A40B2C9AA9B77549B2C699F7BCDD35B1AEFEE152296078337A829D61D923FFA |

App/operator/review-seed test hashes remain the R1 hashes, personally rechecked. Evidence scripts:

- `D:/Yellow/temp/astra562-r2-proof.ts`: `E3256157EA4CA44A8C8BE7D196DB9BEDBEF4CADA766F911E6864B01955D1D343`.
- `D:/Yellow/temp/astra562-r2-hostility.ts`: `73B497AC5F03B128CD422C51633CB7832749C1B7ED095E11005353F1E4E8E9A0`.
- `D:/Yellow/temp/astra562-r2-concurrency.ts`: `F3373CE523745F48B64991CE6C4CC46A78531678596F30A6B8759A121D2D2CB1`.
- `D:/Yellow/temp/astra562-r2-grant-race.ts`: `536E529F9436FA6BFE3DB546193DDF35A4C0203956A541C2B794AA63AC501183`.

**R2 verdict: REJECT.** Preserve R1/R2 findings and request fresh independent proof after the relationship-root concurrency repair. No public admission and no Order561 resumption.

## Independent R3 — ACCEPT SOURCE, staged public admission still required (2026-09-21)

Reviewer: Codex `/root/astra_review`, independent non-implementer. **ACCEPT the frozen Order562 source below.** R1/R2 rejection sections are preserved as historical failure evidence; their reproduced blockers are closed for these bytes. This is not permission to skip deployment/configuration preflight, not a public postflight acceptance, and not Order561 authorization. No candidate implementation edits or public app/database access/mutations were performed in R3. Read the amended order, canonical constitution and Yellow PostgreSQL/entity/code-review guidance; personally executed every result below, not relying on implementer output.

### R2 blocker resolution

The helper now takes **FOR UPDATE NOWAIT** on the exact role and target permission roots in one parameterized authority query. This conflicts with incoming FK KEY SHARE locks, excluding membership/role-permission phantoms. Writer-first contention fails55P03 with the explicit sanitized “authority topology is concurrently changing” error and transaction rollback; a post-commit retry independently rejects the changed topology. Helper-first retains roots plus shared child/actor/scope locks through final complete memberships/permissions reread and COMMIT. The receipt uses finalMemberships, not the stale initial count. Parameterized `unsafe` here still binds all values; it is not interpolated SQL. I found no injection or new mutation surface in this correction.

Personally ran the durable real-PostgreSQL tests for **both orders and both relationship types**. They observe exact backend blocking with pg_blocking_pids rather than relying on elapsed sleeps. Helper-first blocks both incoming membership and foreign permission recipient until after helper commit; its receipt is correct at that commit. Later independently committed privileged changes are not falsely represented as part of the grant. A subsequent helper replay rejects that drift. Writer-first never grants while the competing relationship is uncommitted and rejects the changed topology after commit. No deadlock or stale successful receipt was reproduced. Repeated these two tests **five consecutive times**, all2 passed/0 failed/11 assertions per iteration (two other tests intentionally filtered out).

### Fresh isolated executable proof

Protected local `.yellow/runtime-database-authority.env` was read only inside reviewer processes; no credential or connection URL logged. New PG16 project **yellow-astra562-r3**, loopback55564 (Valkey6399); no public55432/legacy5442 access. R1/R2 databases were not reused.

- `$env:COMPOSE_PROJECT_NAME='yellow-astra562-r3'; $env:YELLOW_POSTGRES_PORT='55564'; $env:YELLOW_VALKEY_PORT='6399'; $env:YELLOW_APP_PORT='30564'; ./setup.ps1 -DbOnly` →exit0; fresh1–97 twice and **referee11 passed/0 failed**. No app start. Referee/source proof is isolated; never run these destructive fixtures against public data.
- `bun D:/Yellow/temp/astra562-r3-proof.ts` →exit0. Fresh `yellow_astra562_r3_upgrade`: exact1–96, existing fictional sentinel, then only0097;127 preexisting-table fingerprints unchanged (permission/ledger excluded). Ledger contiguous1–97 with exact97 checksum; normal runner replay applies0. Canonical normalized schema dump equals `tests/schema/expected.sql`. Separate fresh `yellow_astra562_r3_seed` for seed proof.
- That harness runs `bun test tests/nonfiscal-folio-series-configuration.intentional-red.test.ts tests/nonfiscal-folio-series-configuration.integration.test.ts tests/operator-nonfiscal-folio-series-configuration.integration.test.ts tests/public-folio-series-access-provisioning.test.ts tests/public-folio-series-access-provisioning.integration.test.ts --timeout 120000`, required DB flag and paired isolated URLs →**19 passed/0 failed/144 assertions**, no skips. Includes signed actual HTTP adapter plus real PG, current authority, replay/used counters, exact audit evidence, fiscal/mixed roots, first-write outbox rollback/retry, same/different-prefix races, target guard and full topology proofs. No claim of browser or listening-network execution.
- Fresh required `bun test tests/review-seed.integration.test.ts --timeout 120000` with ephemeral credential →**27 passed/0 failed/117 assertions**. No public seed.
- `bun run typecheck`; `bun run boundaries` →exit0,201 files; `bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2024 --module Preserve --moduleResolution Bundler --types bun tools/provision-public-folio-series-access.ts tests/public-folio-series-access-provisioning.integration.test.ts tests/public-folio-series-access-provisioning.test.ts` →exit0.
- `bun D:/Yellow/temp/astra562-r3-hostility.ts` and `bun D:/Yellow/temp/astra562-r3-concurrency.ts` →exit0. Prior R1 service revoked replay42501, inactive signed HTTP replay403, fiscal-root55000/no extra evidence remain repaired; two-tenant RLS0, raw column DML0, AFTER-outbox failure rollback/retry pass. Observed root wait PID1164 behind1156; observed inactive-authority wait PID1168 behind1156, then42501. Real allocation preserves original receipt nextNo1 and new-key current nextNo2.
- `bun D:/Yellow/temp/astra562-r3-deep.ts` →exit0 on the **populated review-seed database**, separate fictional tenant. Captured full129-table row count/content digests. First creation preserves every preexisting row outside the four exact new target sets and adds exactly1 series/fact/event/receipt. Same-key retry leaves all129 tables identical. New-key no-op differs only by its one new idempotency row. **21 hostile cases** (absent/empty/malformed/foreign tenant context; null authority parameters; null/empty/whitespace/25-character/control/Unicode/punctuation prefixes; raw runtime role) all deny; complete129-table hashes unchanged after the batch. Both SQL capabilities have exact owner/SECURITY DEFINER/search_path and no extra PUBLIC/raw-runtime execute grants. This closes the R2 explicitly unproven broad preservation/context portion with executable evidence; it is not a claim of exhaustive arbitrary input fuzzing.
- `bun D:/Yellow/temp/astra562-r3-grant-preservation.ts` →exit0 on newly migrated `yellow_astra562_r3_grant`. Exact topology65 permissions/nine memberships: first helper changes **only the one allowed role_permission row** across129 table fingerprints; exact helper replay leaves all129 tables byte-content-equivalent. No series configured by this test.
- `bun D:/Yellow/temp/astra562-r3-repeat.ts` →five consecutive2/0/11 runs of `bun test tests/public-folio-series-access-provisioning.integration.test.ts --test-name-pattern 'writer-first|helper-first' --timeout 120000`, grant-only DB. One earlier repeat attempt wrongly shared the database containing my separate hostile-role fixture: helper-first correctly rejected “permission already has an unreviewed recipient” (1 pass/1 fail). I corrected only reviewer test isolation, reran on the grant-only database, and retained this failure account rather than presenting it as a product defect or silently counting it green.
- `bun D:/Yellow/temp/astra562-r3-extra-concurrency.ts` →exit0. **Same original idempotency key** visibly waits on inactive-actor writer (PID1492 behind1484), then denies42501 after commit; no stale replay. Separately, first-time configuration holds its transaction while an allocator PID1493 visibly waits behind creator1491; commit yields first reference ALLOC-1 and next_no2. Configuration and allocation are demonstrably serialized on the same root with no partial visibility/reset.

All retained scripts are reviewer-only fixtures, not deployment tools. No UI/image build was required by this backend/helper-only R3 delta or claimed; the deployable application must still be built and rebound at the separate public stage. No full public data snapshot/history assertion follows from these isolated proofs. Review containers/data are retained.

### Frozen R3 hashes

| File | SHA256 |
|---|---|
| governance Order562 | AB6BCF1CE1205C165267B8049D267A8E9EA9C793405B6372C43F267145706459 |
| tools/provision-public-folio-series-access.ts | 0951F09414E1890CAD90D35A73E9241A20F1A5C50EB71C8986BE90176117631D |
| tests/public-folio-series-access-provisioning.integration.test.ts | BC3D9C9C9315D2D6556577B6A8C8DEDF8ED7E3C4B7A10DA1AA8AAD01199229BE |
| tests/public-folio-series-access-provisioning.test.ts | 6989251324EAA480A04244FBCD48A82F1A57BC564FDD53013DFC953D1A7D1BC8 |
| migrations/0097_governed_nonfiscal_folio_series_configuration.sql | 27EF8BF95F5CA18B54ABB031298825AB6536F28A9CA1A0AFBFF762BBA3B53DCA |
| src/contexts/financials/folio-series.ts | A672630295346423022CEFDE1F946C75000964F56AC37F5148F1C55402028EC8 |
| tests/schema/expected.sql | 1A40B2C9AA9B77549B2C699F7BCDD35B1AEFEE152296078337A829D61D923FFA |
| docs/CONTRACTS.md | 4F7A8E6B08D5A010391FE7927E57ADA4C63F2778CA167ECDB62C732F0B75019B |
| docs/EVENTS.md | BF06634A6AFD15804B8A18AC755AC0CAD6F555882AF51C7B6DBA7161422AE467 |

Service/API integration hashes remain the R2 values, personally checked. Other unchanged source remains bound by the R1/R2 manifests. Retained proof scripts under `D:/Yellow/temp/`:

| Script | SHA256 |
|---|---|
| astra562-r3-proof.ts | A164B8DBE1261AB164C22928195C08995466CC71438DAF53AB47F41CBAE9F234 |
| astra562-r3-hostility.ts | 668D21D89C0AB4AEDFE1FEF8E250B0E98DF78FDD4C9E20D467CFB64FF4E6568F |
| astra562-r3-concurrency.ts | 88058F29C3FDB38DF8EA7CE0EBAA2055FCBCC9330862576D462BCFD8670489B1 |
| astra562-r3-deep.ts | 1691F4F4966BE3F3FEFE21B4DD987C2DC7CF719B696CC854784C59F74982A234 |
| astra562-r3-grant-preservation.ts | 6BAA9CDBFAE0B0919CEE82F3A7C64624BC06DD588E0121F1F286E0E0671320EF |
| astra562-r3-repeat.ts | 801372A594CB74BD84B5EB643BBE4D7AAE824A37CA35E2E2336A6D1F62512A01 |
| astra562-r3-extra-concurrency.ts | 51BD5CC33CBDBF928678332F29982CB25AC839AC1B6E80365B5BACDA0BDD2DA1 |

### Remaining pre-public requirements — not waived by source ACCEPT

1. Independent target-bound deployment preflight: verify actual current public96 ledger/checksums, exact source-versus-image delta, complete frozen65/nine topology and absent target root; source hashes must still match. Public state was **not** inspected in R3. Do not reuse the isolated URLs or bypass the CLI's designated-target guard.
2. Private restricted checkpoint before deployment/grant, readable custom archive/digest; retained rollback image; stop only designated app and verify no writers. Apply only reviewed0097 through normal runner `run --rm --no-deps migrate`, never provision/seed dependencies. Baseline/postflight all-table fingerprints must allow only permission-registry and then the single separately recorded role_permission addition. No raw document_series write.
3. Admit the exact reviewed grant helper with in-memory protected deploy URL only after topology recheck; on contention/drift abort, do not retry blindly. Prove one row and exact no-op replay, all other data unchanged, catalogue/RLS/DML/security exact. Rebuild/promote only app from accepted bytes; preserve PG/Valkey/tunnel/volume identity and verify health/artifact chain independently.
4. Separate private pre-configuration checkpoint and fresh complete effect baseline. Fresh authenticated current authority, exact property6081b544-22a1-534f-a86d-bb1ae0519e14, prefixL3R-FOL-, one retained stable body/key/correlation through canonical API only. Same-key replay exact response; one series next_no1/non-fiscal/null lineage plus one minimized actor/property/correlation-bound fact/event and receipt, every forbidden/preexisting row unchanged. Reconcile uncertain response through canonical read/evidence before another operation.
5. Only after independent public postflight acceptance may Order561 get a **new** preflight. Do not open a folio or check in under562. Successful configuration/evidence is immutable operational history; application-only rollback retains forward schema/data, no ad-hoc deletion/reset/restoration.

**Final R3 verdict: ACCEPT SOURCE on the frozen hashes; public deployment/configuration remains gated as above.**

## Independent public postflight — 2026-09-21 — PUBLIC ACCEPT

Reviewer: Codex Astra (`/root/astra_review`), independent of implementation and deployment. This section does not replace the retained R1/R2 rejections or R3 source evidence. I personally executed read-only target-bound verification. No public migration, provisioning function, seed, operational POST, restart, stop, or data write was executed by this reviewer.

### Executed evidence

- `bun D:/Yellow/temp/astra562-public-postflight.ts` — exit 0. Protected designated credentials loaded only inside the reviewer process; target pinned to loopback55432 and the designated public database. SQL ran in `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` with tenant context. It verifies all97 ledger checksums against source, all129 table fingerprints, exact series/audit/idempotency, old-row preservation, complete grant topology, function bodies and security catalogue.
- `bun D:/Yellow/temp/astra562-public-http.ts` — exit 0. Loopback3010 and current public origin: health200, Today200, exact JavaScript/CSS bytes200. No session acquisition or command was needed.
- Read-only `docker inspect`, app-container `sha256sum`, archive `Get-FileHash`, ACL inspection, and `docker exec -i yellow-public-demo-postgres-1 pg_restore --list` with each dump streamed on stdin. The latter only reads archive metadata; no restore or public SQL is performed. Also extracted only `consumer_cursor` COPY data from the preconfiguration archive with `pg_restore --data-only --table=consumer_cursor --file=-` to compare its two non-PII rows.
- Source inspection: the two existing consumers acknowledge generic outbox delivery, but their handlers ignore `folio.series.configured`; availability rebuild handles its enumerated occupancy/inventory events, while pickup automation requires `reservation.modified`.

Reviewer executable hashes: `astra562-public-postflight.ts` SHA256 `8D32F23DB1DD7F97D7408748FAB6B25F89852F1EAA80FD2FD1C3FF7BDA89C0E4`; `astra562-public-http.ts` SHA256 `27094B8629743E6A7AE3B3B69447983A56C524C49059D6FCE3BFE07C40A7C544`. These scripts contain no credentials.

### Checkpoints and preservation

Private checkpoint `D:/Yellow/recovery/order562-public-20260921-091612` is restricted to owner and SYSTEM. Its parent ACL is inheritance-protected; the preconfiguration child inherits that restricted parent, not a broad users grant.

- Predeploy dump: 2,607,477 bytes, SHA256 `9C81094BF471825B341FA32F7563C1E5311A6C822476776E519E499560391940`, personally readable catalogue2091 lines.
- Preconfiguration dump: 2,616,448 bytes, SHA256 `2316D3EB962AA5226CAE73173E08FA430F1DDE469B77E401B6825C6D770848AB`, personally readable catalogue2095 lines.
- Exact old running-container rootfs archive: 200,843,264 bytes, SHA256 `42E2707E522FE2F3C5CCCAD1C68FB3A96BCFAD21A1CB0CD7561FA79ABD457EC7`.
- Rollback tag resolves to `sha256:eb1f46225de1e76053364e11c1bda52f36c26d1fb2011b830521b6ace19ad9b2`. This is a **reconstructed image** imported from the retained old running-container filesystem, with recorded non-secret entrypoint/CMD, `/app`, user `bun`, and runtime settings; it is not the old `fa8b…` manifest/config digest. The old untagged manifest was removed during rebuild. Compose supplies protected runtime environment separately. No claim of an identical original image digest or an independently exercised rollback boot is made.

Saved restored-predeploy versus preconfiguration fingerprints show exactly permission76→77, role_permission129→130, schema_migration96→97; all other entries identical. Saved restored-preconfiguration fingerprints exactly equal the preconfiguration baseline. I did not repeat the implementer's isolated full restores during this read-only postflight; archive readability/digests and the two cursor baseline rows were independently verified directly from the archives.

I independently recomputed every current table: **129/129 exactly equal recorded postconfiguration**. Configuration differences from preconfiguration are precisely:

| Table | Before | After | Meaning |
|---|---:|---:|---|
| document_series | 1 | 2 | one authorized non-fiscal root |
| fact_log | 953 | 954 | one configured fact |
| outbox | 893 | 894 | one configured event |
| api_idempotency | 67 | 68 | one completed original response |
| consumer_processed | 1786 | 1788 | two acknowledgements of that event |
| consumer_cursor | 2 | 2 | each last_seq939→940; acknowledgement timestamps advance |

All123 other table fingerprints are identical. Removing only the exact new series/fact/event/idempotency rows and the two exact consumer acknowledgements makes all five append-only table fingerprints equal their baselines; no preexisting row changed. This covers occupancy, reservation/segments/guests, accounts/folios, journal/posting/payment/documents, tasks and availability projection without exposing row values.

Fingerprint reproducibility correction: the retained files use `md5(COALESCE(string_agg(to_jsonb(t)::text, chr(92)||'n' ORDER BY to_jsonb(t)::text), ''))` with counts: a literal two-character backslash+n delimiter, **not LF**. An initial reviewer hash-of-row-hashes expression and then the implementer's mistaken LF description produced incompatible digests, not product drift. Independent delimiter reproduction resolved this; final comparison uses the exact retained basis and passes.

**Consumer acknowledgements are acceptable.** Exactly arrival-pickup-task and availability-projection acknowledge event `f3e1c6c7-89f1-4dfe-b7ad-988cd31ee707`, seq940. Each archive baseline cursor was939 and each live cursor is940. No other processed row, task, projection, event or domain row changed. These are ordinary derivative outbox-delivery bookkeeping, not a new operation or permission expansion; preservation is correctly reported as six changed tables, not falsely four.

### Exact configured state, evidence and authority

Exactly one target kind=folio root exists: series `e5785f11-dae4-4eaf-ad43-15c37a68b7bd`, prefix `L3R-FOL-`, fiscal=false, next_no1, supplier registration/FY start/hash lineage all null. Exactly one entity-bound `configured` fact and one v1 `folio.series.configured` outbox event exist. Actor `9f90d3e9-94f9-54de-95ec-35bd00b99b15`, property `6081b544-22a1-534f-a86d-bb1ae0519e14`, tenant `6d9b7ce2-2d14-5576-b8c3-80f06501a603`, correlation `56250000-0000-4000-8000-000000000001`, business-date2026-09-21 (validated against property timezone), null causation, aggregate and exact five-field minimized payload all match.

Exactly one completed `financials.folio-series.configure` idempotency row binds SHA256 of key `order562-public-l3r-fol-20260921-v1` and canonical actor/property/prefix body to status201 and the exact recorded response. The public execution receipt records first201/replayed=false and same-key201/replayed=true with byte-identical body; this reviewer independently verified the stored response/key/evidence, **did not re-execute the public POST**.

Ledger is contiguous1–97 and every checksum matches reviewed source, including0097 `27EF8BF95F5CA18B54ABB031298825AB6536F28A9CA1A0AFBFF762BBA3B53DCA`. Both authority/configuration capability bodies match the migration exactly, owner yellow_owner, SECURITY DEFINER, fixed `search_path=pg_catalog, public, pg_temp`; app_role EXECUTE yes, raw yellow_runtime and PUBLIC EXECUTE no. Both app_role and yellow_runtime lack INSERT/UPDATE/DELETE on document_series and there are zero column-DML grants. Tenant RLS remains enabled with the app.tenant_id policy. No mutating denial probes were run publicly.

Exact complete granted topology: frozen65 permissions plus this one configure permission =66, exact nine frozen actor/tenant/property-path memberships, and exactly one role recipient globally. Public access receipt reports created=true followed by created=false replay; current topology and preservation evidence agree. Runtime container service/index/operator/app/server file hashes match R3 accepted source hashes.

### Artifact and health chain

Current app container `9fac6deaa2014c1889326c2c2505a7b106211322092fa046e499df152dae9f06`, healthy, image `sha256:60d2ca02b140619efe015b1d36ffccb993dd7ab0d9cad5c20047e88d1f6f97d6`; build revision `0951f09414e1890cad90d35a73e9241a20f1a5c5` binds accepted grant-tool source. PG `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`, Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, tunnel `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`, and PG volume remain the checkpoint identities. PG/Valkey healthy; tunnel running.

Both loopback and external page serve `index-BPC7WH-E.js` SHA256 `0EE6D44EF8D8FB3BBDD4BE7E55AD91252F6361187172E0E291150834E66D0401` and `index-suC8KNf1.css` SHA256 `C7F62AD7203036D340B5A9904801998C2232A569754BA05A2F1371B917F3DD0B`; page/health/assets all200. No new visual-motion or entire-PMS readiness claim is made by this backend postflight.

**Verdict: PUBLIC ACCEPT for Order562's bounded deployment, single permission grant and non-fiscal configuration. No remaining blocker found in the verified postflight. Order561 may now receive a fresh target-bound preflight; this does not authorize automatic folio opening, check-in, financial posting or any other operational action.** Forward migration/configuration history must be retained; application rollback does not authorize deleting it or restoring the live database ad hoc.
