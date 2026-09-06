# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Codex Yellow — fiscal completion, with free-hosting and recovery preparation in parallel -->
<!-- current-order-files: handoff/orders/442-host-recovery-and-merged-local-review.md;handoff/orders/443-runtime-storage-containment.md;handoff/orders/440-fiscal-submission-lifecycle.md -->
<!-- current-lifecycle: Q205 independently merged main79 with post-merge proof; Q204 supervised runtime80 implemented with independent database/schema/referee proof, final full CI pending; stable local77 preserved; provider and hosting inactive -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders, reviews,
decisions and ledger entries remain evidence; their filenames are not an active
backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Latest implementation and integration — D1393.** PR87 is independently merged
as`22f1beddea23429ccd9111092dccf6176386adf2`, after exact15f5204 passes all six jobs
in[CI34039764089](https://github.com/dcpnode-maker/yellow/actions/runs/34039764089).
The non-implementer verifies migrations45/45, HTTP9/9, immutable replay5/5(447),
durability19/19, Linux readiness15/15, both GST compatibility suites and the canonical
referee11/11. A separate new post-merge79 database reproduces the exact schema and
unwrapped seed/referee11/11. Main now contains79 migrations/128 tables. The existing
founder preview remains exactb5ef708/77; merge is not deployment.

Q204's supervised runtime is implemented, including fair bounded discovery,
pre-claim adapter reservations, cancellation and late-result quarantine, durable
lookup cadence, tenant revalidation and shared graceful shutdown. Independent real
HTTP→PostgreSQL→worker→reconciliation initially passes11/11(93), extra lock/ACL/rollback proof
passes, and actual80 schema plus canonical referee pass11/11. Root found and fixed
a startup gap: readiness now verifies the fifth runtime-only discovery capability,
with exact79 rejection and hostile80 ACL/config regressions. Pure4/4(26) passes
independently; required Linux database/process execution remains in the next CI.

The complete current80 standing run first exposed six stale composition/frontier
assertions (1,655pass/1,259explicit DBskips/6fail). Scoped corrections preserve
opt-ins, sanitized logs, private helpers and inactive production. The next run
passes1,661 with1,263 explicit DBskips and one Chromium EBUSY startup failure.
The unchanged browser test passes on rerun; a bounded EBUSY/ENOENT helper repair
has deterministic red/green proof and preserves the geometry checks. Before
publication, provider research also exposes a restart gap: internal IDs and a hash
cannot identify a remote invoice. Lookup now receives detached original issued
bytes, with no submit cache or second store. Independent execution on a new
isolated80 database passes all 11 delivery cases (95 assertions), including a fresh
worker recovering the exact wire without resending. The five repair files, SQL80
and schema hashes are unchanged before and after that proof.

Final local standing passes **1,664 tests, 0 failures**, with 1,263 explicit
database skips and 22,225 assertions across 503 files (128.73s). Types, 177-file
module boundaries and all 23 installed dependency licences pass. Exact-source Linux
process/readiness, fresh/upgrade migration equivalence and complete CI still must
pass before independent integration. Runtime80 is not yet merged or locally active;
real provider authentication/sandbox remains unfinished. No Phase7 completion claim.

### Historical checkpoints — superseded by the latest record above

**Integration correction — D1392.** Exact7235e27 CI34021139814 attempt2
passes five jobs, migration45/45, authenticated HTTP9/9, immutable replay5/5
(447 assertions) and durability19/19. Readiness then fails because its helper
expects only78 after running the complete79 catalogue. Root corrects that exact
expectation and the two downstream full-current GST catalogue counts, preserving
all predecessor and hostile permission checks. Local non-database checks pass20/20
(1,039 assertions), with26 explicit database skips; typecheck passes. Actual Linux
readiness and complete exact-source CI must run again. No blind retry or merge.

Q204's separate unpublished delivery runtime now passes11 genuine PostgreSQL cases
(93 assertions) independently, plus25 focused cases and9 additional ACL/rollback
assertions. Complete current80 schema/referee, Linux process and integration gates
remain pending. These are development proofs, not active provider transport. The
stable local still returns ready at exact mainb5ef708/frontier77 without restart.

**Latest correction — Q205.** PR87's six CI jobs passed, but subsequent independent
testing found that repeated fiscal commands returned a later attempt's receipt.
Merge was withheld. Root reproduced both late-attempt drift and immediate JSON
body drift, then added forward79 without changing applied1–78 or stored financial
rows. Independent genuine78→79 proof passes5/5 (447 assertions), and existing79
proof passes5/5 (451 assertions): original request and all three retry keys retain
their exact HTTP bytes through acceptance/rejection, with replay metadata only in
the response header. Earlier bounded approvals below are superseded for integration;
new exact-source CI and final integration are still required. Q204 provider-neutral
runtime production/unit work is built and its bounded database integration is proved;
migration80 and final release gates remain unpublished work. No Phase7 completion
or stable-local promotion is claimed.

The exact staged Q205 candidate now passes the full standing suite:1,644 tests,
1,242 explicitly skipped database cases,zero failures,22,098 assertions across499
files (111.62s). A first archive-only run had four failures: two lacked Git parent
objects, one hit Chromium's transient port-file lock and one status child timed out.
All four pass unchanged in the scoped rerun; the complete rerun used read-only Git
metadata and a fresh browser profile. Types and176-file boundaries pass; dependency
licences pass for the same23 installed packages in the authoritative checkout.
The archive's junction-blind zero-package scan is not counted as licence evidence.
Independent actual current79 schema and all11 canonical invariants also pass.
Applied79's extra trailing blank line is retained to preserve its reviewed checksum;
the resulting diff-check whitespace warning is recorded, not concealed.

Published repaired candidate `b6ecada` passes five CI jobs and normal CodeQL.
CI34020729817's database job found three stale78 expectations in an older
current-frontier migration test. Both new78→79 proofs pass, but later integration
steps did not run. The three expectations now include79; applied SQL and historical
prefix tests are unchanged. Fresh exact-source CI remains required before merge.

**Founder direction: finish outstanding build, then dependent phases.** The
existing `Review Yellow Findings` task has been asked for the new UI handoff;
do not reintroduce the global Simple/Advanced/Expert design or block backend work
on that handoff. The old local preview is not the redesigned UI. No further UI
implementation/restart was performed here. Order440 fiscal canonical integration
has passed its exact Linux CI checkpoint; Orders442/443 recovery/free-hosting preparation remains
parallel support.

**Q201 verified implementation checkpoint (unmerged).** The frozen durable SQL is now
canonical migration78, with a regenerated128-table source snapshot and mandatory
CI durability proof. Public Tx-only request/retry commands reject malformed input
before tenant selection and abort failed Results before commit. The actual
canonical-upgrade durability suite passes19/19 (223 assertions), including both
production commands and all17 prior delivery/race/rollback cases. Setup/release
unit gates pass9/9; types,175-file boundaries,23-package licences and audit pass.
Fresh replay uses one temporary native D: proof cluster because historical
migration12 correctly rejects the retained preview's live sessions. All five jobs
passed in [CI34008495909](https://github.com/dcpnode-maker/yellow/actions/runs/34008495909)
at exact827be46703d85e87def0615f71e9c5bd4d485e75: migrations43/43, native116/116,
issued-wire4/4, durable19/19, containment/readiness15/15 (including all12 readiness
cases with clean Linux exit), seed10/10, compatibility89/89, acceptance24/24 and
referee11/11. No provider or new HTTP worker is active. The preserved preview
source is merged mainb5ef708/77; its reboot status is recorded below. This
candidate source is not yet merged or deployed.

Final native checkpoint: root standing1624pass/1227explicit DBskips/0fail,
19/19 actual durability and4/4 actual wire cases. Fresh migration43/43 and
independent actual78 schema/ledger/referee11/11 pass. Independent readiness
inspection's policy/config gap is repaired, but its Windows Bun process crashes
after passing assertions; graceful pool close did not resolve it. The clean
Linux CI result above discharges that target-runtime gate, not the Windows runtime
defect. The temporary55513 PostgreSQL
cluster is stopped; its directories remain because cleanup was policy-blocked.

**Host recovery and local preview (Orders442/443).** The laptop rebooted at
11:34:17 IST on2026-09-06. Root restored the retained native PostgreSQL cluster
on55503 and, at12:26:53 IST, resumed exact mainb5ef708 at<http://127.0.0.1:3000/>.
The existing source, databases and protected passwords are unchanged. Independent
root inspection of the builder's Q200 helper passes7/7; actual full archive identity,
read-only77 ledger hashes, readiness and prefilled real login pass. AppPID5716 runs
under bounded supervisor16176; PostgreSQL remains15956. Repeated invocation safely
refuses replacement and preserves the same appPID. Logs are limited to5MiB per file,
three per stream, with no automatic restart. This is Bun1.3.14/PostgreSQL16.15,
canonical77/127; the initial referee11/11 remains historical evidence, not a rerun.
No WSL/Docker or
retained hotel database was started/refreshed. Q199's cdfca0b private durable work
is committed/pushed development, not part of this merged-main preview.

The desktop Drive parent is`G:\My Drive\Yellow`; the initial19.8MB checkpoint
preserves533 Git refs and all three worktrees' captured dirty/untracked source,
with independent hashes. It predates the local preview and excludes databases.
Remote upload and browser screenshot remain unverified because desktop/browser
automation initialization failed. Nine WSL Bun dumps still total8,436,600,824bytes:
tool-policy-blocked deletion is not claimed. A pending WSL count cap is containment,
not a runtime repair. Order443 addresses uncapped app logs; native Windows crashes
also exist in historical evidence. [RECOVERY](RECOVERY.md) records exact recovery,
containment and unfinished enterprise reliability gates. Phase7 fiscal canonical
integration is progressing alongside this founder-requested host work; phase priority is unchanged.

The newer D:-only checkpoint `20260906T020603870Z-644ad0ec` captures21,630,399bytes
of source/history/working changes and the new synthetic review database plus
private configuration. Archive listing passed; it has **not been uploaded** and
does not claim a restore drill. Free staging recommendation is OCI Always Free
2OCPU/12GB, subject to account/capacity and an ARM64 build (current images are
amd64). Q202 adds a native ARM64 CI job using the existing launcher/referee/login.
Its first run atc1dfaacc (CI34009685141) rejected a Python wheel because the existing
lock allowed only its Intel hash. The exact publisher ARM64 hash is now added for
the same package version; independent focused8/8(93) passes. Repaired native ARM64
job101425264551 in[CI34010394787](https://github.com/dcpnode-maker/yellow/actions/runs/34010394787)
passes at exactd88ae59ade95b342121e0a3644f5102adcf9726c: both image targets pass
architecture/source checks, referee11/11, readiness78, synthetic sign-in and cleanup.
The non-implementer personally dispatched and inspected the run; root independently
retrieved its log. The separate long database job subsequently succeeded: all six
jobs are green, with canonical referee11/11 in the database log.
This proves the bounded ARM64 launch, not capacity, sustained reliability or hosting. No cloud
deployment or spending occurred. Full limits and the unchanged
7.86GiB WSL dump evidence are in[RECOVERY](RECOVERY.md).

**One Codex Yellow project preserves both reviewed development streams.**
Orders438/439 consolidated the operational app through PR82. Order434's native
fiscal source passed independent whole-candidate Tier-3 review and all five jobs in
[CI178](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) at
`92346674c784b552356934e168d60e4b9650497a`, then merged through
[PR83](https://github.com/dcpnode-maker/yellow/pull/83) as`443e3826`.
[PR84](https://github.com/dcpnode-maker/yellow/pull/84) subsequently merged the
independently reviewed hotel-journey/schema/design study as
`7829eae47d4281efa117c8d3c788c3be52d10d06`. Main contains77 migrations and127 public
base tables, including the runner ledger; [SCHEMA-GUIDE](SCHEMA-GUIDE.md) explains
the immutable80-table baseline and historical125-table frontier.
The combined private fiscal/RMS follow-up passed all five jobs in
[CI33999540391](https://github.com/dcpnode-maker/yellow/actions/runs/33999540391)
at088d093 and merged through[PR85](https://github.com/dcpnode-maker/yellow/pull/85)
asb5ef70842b658183f7b5b4c650c8e78c7a0b513d. That merge changes no migration frontier.

**Order440 fiscal submission** continues the durable request/delivery/reconciliation
implementation. Its private state contract passes17 tests; the new private issued-wire
candidate independently passes10 unit tests and4 genuine-issued PostgreSQL tests.
Those prove the supported GST component combinations, two-tenant source isolation and
unchanged financial rows. The source hash remains distinct from the deterministic
wire hash; money never passes through floating-point conversion. Canonical0077's final
issued content includes Qty1.000/UnitOTH; the ordinary intermediate candidate does
not. Q197 corrects that description. The candidate remains uncertified. Q199's
private repository/worker and SQL draft now pass17 real PostgreSQL tests: exact
source/wire preservation,100 concurrent claims, unknown-delivery recovery, bounded
explicit retries, forced rollback of all four delivery operations, retained history
and both audited business-day seal race orders. These are isolated-database proofs,
not a canonical migration or activated worker. Independent private-foundation review
also passed the canonical referee11/11 and reproducible draft-schema comparison.
Q201 promotes the exact draft through the canonical runner and Tx commands and
passes the Linux integration proof above. Provider authentication, verified-session
worker activation and live sandbox evidence remain unfinished. Q203 now
implements both authenticated request/retry endpoints with an empty production
adapter directory and no new role grants. Non-implementing root personally passes
13/13(125): five actual signed-session PostgreSQL cases plus eight identity, safety,
workflow and transaction-closure checks. Actual existing cross-tenant resources,
permission revocation on replay, receipt mismatch and late-outbox rollback are
proved; the isolated78 database has zero residual fault constraints or sessions.
Fresh independent fiscal_http_acceptance personally repeats13/13(125) plus both
legacy composition suites11/11(75), with no blocking finding. Root full standing
passes1635/0 with1234explicit DB skips,22058assertions and clean process exit;
the incomplete pre-reboot run is not counted. Exact combinedcb9a87f now passes all
six jobs in[CI34017067690](https://github.com/dcpnode-maker/yellow/actions/runs/34017067690).
Non-implementer fiscal_http_acceptance personally dispatched and inspected the run;
root independently retrieved its success and database log. Required HTTP proof
passes9/9(89), including five genuine signed-session cases; durable19/19,
migrations43/43, containment/readiness15/15, deployment24/24 and referee11/11 pass.
This completes the bounded HTTP acceptance, not worker/provider activation or merge.
The earlier
private-only figures above are historical Q199 evidence.

**Order440 hotel journeys** preserves cross-department guest/staff research,
16 synthetic cases and a14-case interactive design study. Its fictional in-memory
workbench does not release event, outlet, spa or purchasing capabilities. Functional
review, reference-matched visual review and actual laptop execution have separate
receipts. **Order441 RMS research** records the founder-selected Astra Ultra algorithm
portfolio; proposals are not implemented algorithms or measured revenue uplift.
[Question198](../handoff/questions/198-concurrent-reviewed-source-integration.md)
disambiguates the concurrent Order440/Question196 identifiers without losing history.

Prior fiscal/research checkpoint13737a7 passed all five jobs inCI33996041604 and
PR85 CI33996882192. PR85 then required integration because main advanced through
PR84. Combined candidate4ecee0b failed quality inCI33998572070 because a test matcher
mutated shared status text; Windows/local and CodeQL passed, database/container did
not execute. Root reproduced and repaired that test-order defect, plus a private
revoked-proxy input exception. The repaired source passed1600 local standing tests
with1195 explicit database skips. The later088d093 exact-head CI discharged the
combined-source gate, including the required issued-wire database proof. Q199's next
private draft passes1613 standing tests with1214 explicit database skips, types,
import boundaries across173 TypeScript files,23 package licence checks and dependency audit; its separate
genuine DB run is17/17. The independent private-foundation approval permits development
publication and subsequent canonical admission, not an activated feature.
No retained hotel database was refreshed by the fiscal work. Order442 subsequently
created a separate synthetic native review database and launched merged main above.

Earlier failure CI33992123191 at6bb7ba6 remains evidence: migration41/41,
native116/116, containment7/7 and compatibility89/89 passed before four stale
catalogue expectations failed. Those were repaired and independently passed23/23;
PR83's subsequent exact-head green CI discharged the native acceptance condition.
Codex owns implementation and coordination; ordinary development has no separate
vendor/person dependency. Independent high-risk proof remains required.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | PR87 independently merged at22f1bed after exact15f5204 all-six CI and post-merge schema/referee11/11 | Main is the sole release branch; Q204 runtime80 remains separate unmerged work |
| Native fiscal acceptance | Independent migration41/41, native116/116, compatibility89/89, catalogue23/23, exact schema and referee11/11; all five [PR83 CI jobs](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) passed | [Review434](../handoff/reviews/434-native-fiscal-source-completion.md) approves bounded native issuance, not provider activation or a retained hotel database |
| GitHub work queue | All62 PRs in the original audit are closed with source preservation; PR82/83/84/85/87 are merged | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) preserves dispositions; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live queue |
| Database schema | Main79/128; private Q20480/128;118RLS/118policies/27FORCE/13permissions/2views | Applied1–79 remain immutable. Founder preview77/127 is not migrated by these isolated proofs |
| Private issued-wire proof | Independent10/10 unit and4/4 real-issued tests, including exact unchanged financial rows and cross-tenant isolation | Source/wire hashes differ deliberately; no certified provider, durable submission writer or fiscal acceptance is claimed |
| Hotel journey design | [Workbench specification](design/STAFF-WORKBENCH-SPEC.md), [casebook](design/HOTEL-CASEBOOK.md) and [research](research/HOTEL-OPERATIONS-REVIEW.md) are preserved from PR84 | Fictional interaction study; final visual fidelity needs an accessible reference and matched screenshot evidence |
| Local app | Exactb5ef708 native Windows preview personally verified on the laptop: readiness77, source archive hash, synthetic login and referee11/11 | [Recovery details](RECOVERY.md) distinguish native startup from Compose; no new screenshot, production stability or unmerged fiscal activation is claimed |
| Main verification and cloud | Mainb5ef708 CI34000319799 and runtime/migration image publication34000989837 succeeded | Registry digests were not retrieved; no approved cloud host, ingress or serving URL is connected. Publication is not deployment |

A branch, document, test, container build, merge and deployment are separate evidence
states. The runtime must identify its exact source and applied migration frontier.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases0–3,5 and6 | Independently reviewed | Later changes still require regression proof |
| Phase4 | Built; integration review outstanding | Preserve implementation and close remaining integration evidence |
| Phase7 operational flows | Consolidated and independently approved baseline | PMS, stay, folio, payment, approval and fiscal-support flows remain preserved; this does not complete the whole phase |
| Order434 native fiscal issuance | Independently approved and merged through PR83 | Real source-to-invoice, accounting, replay, concurrency, tenant isolation, bounds and migration proofs pass; no provider registration or operator invoice screen is implied |
| Order440 fiscal submission | Canonical79 repair is independently merged after full CI and post-merge proof; runtime80 has independent genuine worker, schema and referee evidence | Complete80 CI/integration, provider authentication, runtime activation and live sandbox evidence remain outstanding |
| Order440 hotel journeys | Reviewed study merged through PR84 | Cross-department research and a fictional prototype; final reference-matched visual QA and laptop execution remain separate |
| Order441 RMS research | Astra Ultra portfolio documented | Known methods, falsifiable proposals and experiment design; no live algorithm or measured uplift |
| Phases8–17 | Planned | Requirements, research and department studies are preserved; documentation is not shipped behavior |

The roadmap contains **18 phases, numbered 0–17**. Founder priority remains
**11 → 13 → 17**, with mandatory dependencies. From the active phase, the executable
sequence is `7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.

## Preserved product destination

The consolidation keeps the full hospitality OS goal from the founder conversation:

- complete hotel and STR operations, native finance, distribution, booking/CRS, CRM,
  RMS, groups/events, outlets and hotel interfaces;
- one governed command and query layer shared by screens, chat, voice and automation,
  with role/property scope, exact approvals, idempotency and audit receipts;
- simple interfaces that reveal detail in context, with distinct, task-tested design
  families and layouts appropriate to desktop, tablet, phone and watch;
- local-first or low-cost components where measurements support them, replaceable AI
  and provider adapters, deterministic execution for established workflows, and more
  capable models reserved for research, ambiguity and hard development work;
- PostgreSQL authority for tenancy, inventory, money, business date and durable facts,
  with no claim of zero cost or unmeasured latency/performance superiority.

The independent analysis behind these choices is recorded in
`docs/research/ASTRA-TAKEOVER-REVIEW.md` and
`docs/research/HOTEL-OPERATIONS-REVIEW.md`. Capability claims require executable or
measured evidence; model benchmark results do not waive Yellow's review gates.

## Updating this record

Update the four machine-readable fields and the relevant table rows in the same
reviewed change whenever the active task, phase or lifecycle changes. Record the exact
commit, image digest and deployed target in release evidence rather than editing
historical orders. Append decisions and ledger entries; never rewrite their history.
