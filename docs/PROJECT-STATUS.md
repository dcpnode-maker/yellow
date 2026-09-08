# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Codex Yellow — remaining functional backend build; all UI/UX paused -->
<!-- current-order-files: handoff/orders/452-native-credit-delivery-discovery.md;handoff/orders/440-fiscal-submission-lifecycle.md -->
<!-- current-lifecycle: Published0b1ff327 all six CI jobs pass; Order452 native SQL11/0 HTTP3/0 canonical89 upgrade/referee11/11 and30 readiness faults pass; full standing/publication in progress; UI and live app unchanged -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders, reviews,
decisions and ledger entries remain evidence; their filenames are not an active
backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Functional build — 2026-09-08.** All UI/UX, prototypes, animation and guest-picker
work is paused by the founder; existing files are preserved. The running local
remains the separately verified a1085178/frontier85 build, not the published branch.
No restart, migration or promotion was performed by this checkpoint.

**Published:** 0b1ff327d289c611542d81f272d7e3a2e7223b06 on draftPR92,
tree754250713ebf548d6fda72016bf49a947b2c15c0, parentffb03441.
Orders449/450/451 are now implemented, independently scoped-tested and published:
complete immutable credit documents, authorized date-bounded credit listing and
private immutable long-stay pricing evaluation reuse. No print/UI renderer or
external fiscal-provider activation is implied.

Exact standalone full standing passes **1,956 tests / 0 failures**, with1,410
explicit environment/database skips,34,947 assertions and540 test files in197.04s.
Typecheck and189 import boundaries pass. The local license script scanned0
installed packages; CI's installed-dependency license/audit checks passed.
The skips are not substitutes for separately executed native database proofs.
CI34202983111 passes all six jobs: quality, local-review, Windows-state,
container-smoke, nativeARM64 and the complete database suite.
NormalCodeQL34202979566 passed; optional AI review is separate.

Order449's real signed-session PostgreSQL API passes1/0(48), including12 concurrent
reads of exact stored credit content/receipt and denied revoked/foreign access.
Order450's real API passes1/0(24), plus seven actual planner/denial cases.
All1,773 pre-existing rows remain in the final2,054-row synthetic target; protected
metadata, companion databases and live host identities are unchanged.

Order451's final root benchmark proves complete-output equality across nine
old/new workloads. The366/367-night median fixture times fell3027→283ms and
3152→231ms; these are controlled in-memory results, not production SLOs.
Root final focused42/0(382), hostile-input and genuine-green/two-mutation-red
checks pass. Q239 repaired only ownership/lifecycle of the existing browser test,
preserving all seven cases, assertions and30s deadline; no UI design changed.
All three earlier failed standing runs and intermediate proof failures remain
recorded, not silently replaced by the final passing run.

The first publication attempt stopped before any commit/ref/index/push because
its reverse-patch audit assumed identical audit-file context. The corrected
publisher committed and pushed the exact verified tree, then its raw-index guard
reported a difference. Root's subsequent read-only binary/semantic audit proves
only37 timestamp-cache blocks changed: all mode/OID/path/stage/flags,2,064 unrelated
staged entries,2,081 original working files and42 scoped inputs were preserved.
No reset/restore was needed; the original failure receipt remains immutable.
See [Order451 review](../handoff/reviews/451-rate-quote-evaluation-reuse.md).

**Active now:** [Order452](../handoff/orders/452-native-credit-delivery-discovery.md),
authorized credit-document fiscal-delivery discovery. SQL, typed service/command
and HTTP source are built. Root personally executed rollback3/0(19), then final
SQL11/0(164) and signed-session HTTP3/0(83) on one isolated retained candidate.
Two earlier test-oracle failures were corrected without changing production logic;
all failure logs remain. Full final preservation proves all3,080 preceding rows,
all2,054 original clone rows, companion databases, roles and live app unchanged.
Canonical0089 source and release wiring are integrated. Actual populated88→89
upgrade/no-op and separate pristine77→89 clean schema equality pass, along with
the unchanged11/11 referee and30 actual readiness fault denials/exact restorations.
Generated schema matches both databases at78e76f92. The initial workflow-test
declaration error was repaired; root focused25/0(571), compiler and191 boundaries
pass. Full standing and publication remain in progress. This feature is not yet
published or promoted into the running local app.
The read-only route requires
BOTH current document-read and submission-read permissions. Draft0089 adds one
narrow owner-mediated function, not tables or broad direct SELECT grants.
Both functional and canonical executions used separately frozen Q241 handoffs;
the complete-candidate standing/CI/publication gate is still open.

**Remaining boundaries:** native debit-note issuance is substantive Q187 scope;
a debit-series configuration is not issuance/accounting/submission. Its exact
economic-source contract remains to be bounded before implementation.
Authentic provider onboarding/sandbox acceptance remains separate from synthetic
worker/adapter proofs. Phase7 is NOT complete. Founder priority11→13→17 remains
dependency-gated by the build plan. No main merge or whole-app completion is claimed.

## Historical checkpoints (superseded)

**Founder priority — 2026-09-07.** Deliver completed functionality into the single
review app without waiting for all of Phase7, and follow Astra's redesigned flows.
[Order444](../handoff/orders/444-partner-review-and-astra-ui-integration.md) and the
[personally read source handoff](design/ASTRA-IMPLEMENTATION-HANDOFF.md) record
Calm Workbench, Precision Desk and Service Timeline; contextual task/role/property
disclosure replaces global expertise selection. Neomorphism is deferred. The
creative-freedom request was delivered to **Review Yellow Findings**, and Astra's
definitive reply5564886892 was personally read and incorporated into that handoff. The forthcoming
consolidated voice-agent document is separate and not yet received.

Read-only inspection confirms the current native3000 app is healthy but still
b5ef708/frontier77. Its fixed-version launcher, synthetic permissions and fixtures
also need a verified update; merely copying new frontend files is insufficient.
PR86's original five CI jobs and CodeQL are successful, but it remains
draft/conflicting and still contains legacy expertise selection. Its source was
preserved without a wholesale merge. The first integrated shell now exposes only
Calm Workbench, Precision Desk and Service Timeline, replacing the public global
expertise/appearance controls. The layouts change composition without remount,
refetch, storage or a business command. This is source implementation, not the
complete identity/department/STR redesign or a runtime promotion.

The published3a0a013 checkpoint's final full run passed1839 tests, zero failures and1310 explicit
database/Unix skips, with24731 assertions across522 files in136.38s. Types,
185 import boundaries,23 installed dependency licences and diff checks pass.
Failed earlier runs remain evidence: stale oracles, delayed browser import,
an unreproduced exact credential-size boundary failure, and a later1837/2 run
with status/long-stay deadlines. The last two focused suites pass unchanged;
the final full run changes no assertions, production calculation or deadline.
No cause is asserted for the intermittent credential failure.

Actual CDP viewport proof covers1440x900,1024x768,768x1024,390x844 and320x844,
all three desktop compositions, reduced motion and forced colours. Root's final
capture run passes124 assertions; screenshots caught and drove fixes for the
320px clipped picker and excessively tall mobile navigation. Mounted invoice,
draft/filter/selection/focus/property/request context and zero layout-only HTTP
requests are checked. These are synthetic HTTP browser fixtures, not live-database
journeys or200% browser-zoom/pixel-fidelity proof. The already-built Owner trust
route now has its missing shell deep-GET, with unchanged protected API behaviour.
[The capability manifest](design/BUILT-CAPABILITY-MANIFEST.md) maps all15 mounted
workspaces to existing routes, permissions, proofs and review-fixture gaps.
PR92's exact published commit `3a0a01316fbf8acc760e1cba38384042edbb86d2`
now passes all six CI34087312357 jobs and all three normal CodeQL34087310665
analyses. Root inspected the database job's actual final referee11/11 and fresh
deployment acceptance24/0(73). These results cover that commit, not laterQ209 edits.

**Current follow-on work.** Root independently executed the frozen populated81→85
proof on a separate newly admitted database:2passed,0failed,143 assertions,21.78s.
It preserves genuine original document bytes, signed receipts, initial/three retry
response bodies, financial chains and all retained tenant rows, then issues from
an81-era unissued source through the current85 confirmation path. All89 canonical
inputs, pristine77 template,19 roles,4 memberships and44 outside databases remain
unchanged. The first author's116-assertion failed run remains recorded; its detail
denial expectation was corrected against the retained NULL policy, with explicit
list-denial coverage added. No production authority was relaxed.

The next invoice presentation slice puts number/date and actual registration
state ahead of print actions, keeps technical evidence in a native disclosure,
and returns narrow screens to the selected task without discarding search drafts.
Real browser proof passes6/0(293), including keyboard Enter, retained disclosure
across all layouts, exact widths and zero layout/disclosure-only requests. The
first keyboard harness omitted Enter's character payload and failed; the complete
browser input sequence passes without replacing native activation in product code.
This remains a synthetic browser proof, not a runtime-promotion receipt.

Q209's new fiscal fixture is independently accepted:8pass/0fail/79 assertions,
5.38s, with a genuine issued invoice and a separate eligible source. Exact original
service dates, all eight balanced posting rows, documents, series and event lineage
survive rerun. Its service evidence predates the issue day; this exercises retained
prior-day evidence, not a claim of observing a later calendar day. Real signed-session
list/detail/readiness, unauthorized/checker denial and valid foreign-tenant positive
control followed by cross-tenant denial pass. Fresh baseline seed27/0(117) remains
a separate receipt. Failed setup/oracle attempts and the explicit60-second fixture
construction bound are retained in the review; no production guard was loosened.
Outside46 databases,19 roles,4 memberships, pristine77 and89 canonical inputs were
unchanged; the proof target has two synthetic tenants, one invoice and zero sessions.

Root independently executed the final native helper tests18/0(33),44.60s, then
personally verified the actual retained child5716/supervisor16176 identity read-only.
The earlier16/0 suite had missed joined PowerShell filter/JSON arguments; real
preflight and parameter-binding proofs found and drove their correction, including
the reserved home-variable collision. All failed evidence remains in
[the native review](../handoff/reviews/444-native-review-and-ci.md).
Windows-native and serial baseline/fiscal CI gates are wired and independently
source-checked, not yet run at a new commit. The first follow-on full suite1856/1
retained an Order239 deadline failure; its unchanged focused suite passes12/0.
A subsequent full run passes1861/0 with1316 explicit environment skips and24861
assertions in188.26s. That run precedes the final native repair and Q210 snapshot
alignment. Final frozen Q210/native source passes1863/0 with1316 explicit
environment skips,24884 assertions across525 files in201.13s. Types,
185 boundaries,23 licences and dependency audit0 vulnerabilities pass. Two
focused status-report timeouts remain recorded; that unchanged case passes in
the final whole run at3.30s. No timeout or assertion was relaxed.
Licensed identity/type integration, full journey acceptance, new-head CI and
reversible single-local promotion remain active. The founder app is still77.

**Current checkpoint — 2026-09-07.** PR91 is independently merged at
`3503b0c01f336637d2583963c17b792f6ad59efe`; remote GitHub merge state is verified.
Main now has81 migrations and128 public tables. All six exact-source CI34067083341
jobs and normal CodeQL passed, including native ARM64 execution, full80→81 signed
durability14/14, historical compatibility, runtime/readiness and final referee11/11.
A separate new-only postmerge PostgreSQL target reproduces the exact canonical
schema and the genuine unmodified seed/referee11/11. Failed earlier runs remain
recorded in [the independent review](../handoff/reviews/440-fiscal-provider-and-receipts.md).

Q208 now implements the actual operator invoice workflow in a separate branch of
the same worktree. Forward82–85 are applied only to its isolated synthetic build
database. Forward83 closes the independently reproduced fresh-v2 issue-date supplier
status bypass. Independently exercised forward84 corrects actual SQL execution,
same-tenant role checks and stable buyer/confirmation projection. Forward85 adds
durable public-command replay using the existing immutable native records; its
proof-only application was independently authorized, not approved as a release.
Independent strengthened PostgreSQL proof passes9/9, including committed concurrency,
API-row-expiry replay, a genuinely eligible alternate buyer and exact eight-table
artifact preservation on changed-input rejection. A separate clean77→81→85 upgrade
passes the unfiltered10/10 suite, no-auto-grant preflight, canonical seed and actual
referee11/11. Its normalized schema is copied mechanically into the current oracle.
An empty1→85 run was not allocated on the shared native cluster because historical
migration12 would change global-role membership; fresh and per-step rollback proof
remain mandatory in disposable CI, not waived by the clean upgrade.

The earlier publication preflight independently rechecked all89 canonical inputs
against that executed85 proof and retained1,732,510-byte schema. Its original
migration tests started with an empty81 predecessor; Q209's separately executed
populated proof above now covers retained receipt/document preservation. A real
UI/database journey and exact-source release gates remain required.

Independent testing exposed a real Bun SQL array-metadata incompatibility in the
new readiness projection. The narrow own-data-row repair now passes45 focused tests
and57 additional independent hostile assertions; nested JSON validation stays strict.
Authenticated main-screen and rendered-geometry browser proof passes4/4, covering login/deep links,
folio Back/Review, property change and late logout/import suppression. These use
synthetic HTTP fixtures, not a full live-database browser journey. Actual320/375/768/
1280CSS-pixel confirmation layouts,200% phone text and reduced motion pass without
horizontal overflow; root personally inspected desktop and phone screenshots.

Configured provider-choice backend is implemented and independently exercised:
exact current database/configuration UUID/version/key intersection, truthful
sandbox/production labels, current authority even with empty configuration, and
no credential exposure. Its explicit staff request controls are implemented;
the browser suite passes5/5 with120 assertions, including preserved document/
provider/request identity across uncertain outcomes. Current85 catalogue/runtime/
CI integration is implemented. The real runtime index-introspection mismatch was
repaired: an independent actual85 baseline and12 rollback-only hostile ACL,
configuration and ordering cases pass, with schema and global roles unchanged.

The corrected local QR renderer independently decodes exact synthetic signed bytes
in full-width screen previews and actual A4 PDFs, including near-capacity tokens.
Narrow previews give a full-size-print instruction instead of shrinking or clipping
the code. This is not physical-camera or fiscal-provider certification. Operator
reload-safe retry-only provider binding, remaining Phase7 product work, fresh full release
gates, provider onboarding and authentic sandbox acceptance remain outstanding.
No phase classification changed.

The single stable founder preview remains at its separately recorded77 release;
it has not received Q208 or main81. No local restart, migration, provider activation
or cloud deployment occurred. The checkpoints below are historical, superseded
where they describe PR91 as unmerged or main as80.

### Historical pre-merge checkpoint

**Current development checkpoint — 2026-09-07.** Q207 implements authenticated
ClearIRP transport, immutable source-bound signed invoice/QR retention, an authorized
receipt GET and protected deployment configuration. It remains unmerged development,
not a merged release, configured provider or completed Phase7.

PR91 publishes the complete integration. Its initial2381bd4 CI remains separate
baseline evidence. Automated review found a loader/HTTP constructor disagreement
for repeated provider row UUIDs. The independently reproduced and repaired loader
now rejects those malformed entries before repeated credential access, preserving
valid same-provider versions with distinct UUIDs. Independent focused proof passes
18/0 plus12 explicit environment skips and15 additional composition assertions.
The repaired full local suite passes1767/0 with1294 explicit DB/Unix skips and23578
assertions in100.96s; types,183 boundaries and23 dependency licences pass. The first
intentional failure and an unclassified exploratory probe failure remain recorded.
Fresh repaired-source CI and non-author integration remain mandatory. Applied81,
the canonical referee inputs and the stable local preview are unchanged.

**Additional integration repairs — D1407.** The baseline database job failed its
deployment acceptance step, then its unbounded failure-log step stalled until the
run ended cancelled. Final referee/readiness did not execute; complete job logs
were still unavailable when inspected. Independently, an actual read-only81 test
reproduced an expected-array ordering defect: SQL sorts `read` before `reconcile`,
but the test expected the reverse. Only those expected entries changed; the same
test now passes independently. Supplementary CI logs now have time, record and
byte bounds without bypassing acceptance or unconditional cleanup. Native checks
prove the wiring, not execution of GNU timeout on Linux. Final root standing passes
1768 tests, zero failures and1294 explicit environment skips, with23591 assertions
across513 files in110.19s. Types,183 boundaries,23 licences and independent focused
catalogue1/1 plus workflow15/15 pass. The failed/cancelled baseline is retained;
the repaired published revision still needs its own complete CI and normal CodeQL.

Independent actual PostgreSQL proof now establishes:

- Fresh81 signed durability:13 passes, one explicit upgrade-only skip, zero failures.
- Genuine cryptographic provider→worker→database→signed-session receipt journey:
  four passes; the separate authorized receipt GET suite passes six tests.
- Readiness rejects six hostile effective grants and restores the exact original
  ACLs:19 assertions pass.
- Fresh and upgraded81 normalized schemas are identical:1,645,755 bytes, SHA256
  `60b969a970baa8746f54b5f79eb8a3d5aa08bfafa0ceec1ffaa0dd2bd6f3e83a`.
- A separate new clean81 target passes the unmodified canonical seed and all11
  invariant checks. It has81 migrations/128 tables; pristine77 template and global
  roles remain unchanged.

The first upgrade run's genuine80→81 preservation case passed, but that full run
had11 passes and three harness failures. The three repaired cases passed on fresh81;
this is not an all-green rerun of the entire upgrade suite. The first full protocol
journey failed three early-lookup timing assertions; the corrected four-test journey
passes while preserving the real15-second recovery delay. These failures remain
recorded in the independent review.

Current-runtime compatibility now passes12/0 and historical77→78 compatibility19/0
under independent execution. The first current run's six passes/five failures exposed
a test-fixture envelope mismatch; its separate repaired target proves genuine signed
acceptance without relaxing production. The full root standing suite now passes1766
tests, zero failures and1294 explicit database/Unix skips, with23552 assertions across
513 files in111.74s. The prior full run's four stale status/composition oracle failures
remain recorded; all were corrected without removing activation or privacy guards.
Types,183 import boundaries,23 installed dependency licences and diff checks pass.

Exact-source Linux/ARM64 CI remains an integration gate. Operator invoice discovery/issuance/printing
and authentic external-provider sandbox acceptance remain product work. Provider
configuration is absent/default-off; main4ba1d6f stays80 and the existing local app
stays at its separately recorded77 release. No live hotel data was migrated.

**Merged integration checkpoint — 2026-09-07.** PR90 is independently merged
as4ba1d6f after all six CI34057881483 jobs and normal CodeQL pass. Actual native
ARM64 decoder/JWS/binder proof passes41/41; the independent new-only post-merge80
database matches canonical schema and passes genuine seed/referee11/11. Main is
80 migrations/128 tables; the stable local77 is not restarted or migrated.
Question207 now admits the complete authenticated provider, source-carrying claim,
atomic signed-receipt retention and property-authorized GET integration, including
forward81 and immutable legacy command replay. Database and protocol builders run
in parallel with coordinator-owned worker/read integration. This development is not
yet independently accepted as a whole, deployed, activated or Phase7-complete.

The checkpoint below records the preceding pre-PR90 source proof.

**Current checkpoint — 2026-09-07.** PR89 is independently merged as
`43fc758bf706b40cdf6d3a06e4272ffd8d56193d` after all six
[CI34053928779 jobs](https://github.com/dcpnode-maker/yellow/actions/runs/34053928779)
and normal CodeQL pass. The actual native ARM64 job executes the decoder/JWS
tests25/25; image success alone is not their proof. A separate new post-merge80
database reproduces the exact schema and genuine seed/referee11/11, preserving
template77, global roles and the founder preview. Main remains80 migrations/128
tables. These are merged private foundations, not an activated IRP provider.

The next original-invoice/signed-QR binder is independently verified in development.
It matches every issued field using exact decimal comparison, both genuine pinned
signatures and explicit compatibility rules. Root personally re-executes55 focused
tests (582 assertions) and112 additional generated-key adversarial assertions on
unchanged final source. The new ARM64 gate includes this binder, but its execution
on that architecture still requires new exact-source CI.

Complete current standing now passes1719 tests,0 failures,1264 explicit DB/Unix
skips and22813 assertions across507 files in109.65s. Types,180 module boundaries
and23 installed dependency licences pass. The first run's Windows status timeout
and next run's loaded-folio Chromium port-file EBUSY remain recorded failures.
Independently executed native batch/outsider-cwd and bounded transient-read repairs
preserve existing deadlines, exact report semantics and actual geometry assertions.
The new binder and these repairs are verified development, not yet a merged release.

Current remaining product work is authenticated provider transport, atomic signed
receipt retention, a property-authorized receipt read and operator invoice/printing,
followed by authentic sandbox proof. No phase classification, local promotion,
provider activation or cloud deployment is implied.

### Earlier foundation checkpoint — superseded by the current checkpoint above

**Fiscal runtime merged; signed receipts next — D1399.** PR88 is independently
merged as`2a0ba41ea5e018e44e69e87677b703721b0a2e33` after all six jobs in
[exact-source CI34049699932](https://github.com/dcpnode-maker/yellow/actions/runs/34049699932)
and normal CodeQL pass. The reviewer personally reads the full gates: migrations47,
delivery11, Linux process5, immutable replay5, historical durability19, readiness19,
all ten compatibility suites, deployment24, exact schema and referee11/11.
Merged tree equals the tested source tree; integration uses the normal SHA-guarded
merge with no bypass. A separate new native post-merge80 database matches the exact
1,620,228-byte schema and passes the genuine seed/referee11/11. Template77, global
roles and the stable founder preview remain unchanged. Main now has80 migrations
and128 public tables; a merge is not local promotion or provider activation.

The next work is Question206: authenticated provider transport, verified signed
invoice/QR retention and a separate authorized receipt read, followed by the operator
invoice/print journey and authentic sandbox proof. Its private lossless decoder
passes independent12/12 tests and10,000 differential cases; full standing passes
1,686 tests,0 failures,1,264 explicit DB/Unix skips and22,423 assertions across505
files in101.23s. Private RS256 verification is implemented and independently
approved after root finds and the builder repairs trailing-DER and byte-rounded
RSA modulus acceptance. Final decoder/JWS/boundary proof passes32 tests and301
assertions;36 further independent adversarial assertions pass. Complete current
standing passes1699 tests,0 failures,1264 explicit DB/Unix skips and22568 assertions
across506 files in97.05s; types,179-file boundaries and23 dependency licences pass.
These private helpers are published in PR89. The independent reviewer finds that
the first ARM64 image proof never executes them; an explicitly admitted CI step
now runs both suites natively before image/referee checks. Its permanent wiring
regression passes independently4/4; root's complete repaired standing passes1700
tests,0 failures,1264 explicit DB/Unix skips and22573 assertions in95.91s.
Fresh exact-source ARM64 execution and complete CI/integration remain required.
The next admitted private implementation binds both signed artifacts and all
invoice/QR values back to the original issued source, using exact decimals.
Neither helper is a completed provider integration, live registration or Phase7 exit.

### Historical implementation checkpoints

**Historical worker caller correction — D1398.** Exact1b7f9cc
CI34047572346 passes five jobs, including complete Linux quality, current80
delivery11/11 and actual Linux process5/5. Its database job later fails one older
77-to78 durability case: the caller omits four now-required worker fields.
The current worker rejects it before any claim; this is not a provider failure
or another browser timeout. Downstream readiness, compatibility, schema and
canonical database referee are skipped, not approved.

The already admitted test now supplies a typed, provider-bound seven-field worker
step, separately retaining the exact three-field repository claim. Its permanent
regressions require old-input rejection with zero mutation and valid cross-tenant
database denial, not merely a malformed-input error. Root actual fresh77-to78
proof passes19/19 (227 assertions,77.11s); non-implementing
fiscal_http_acceptance personally passes19/19 (227 assertions,93.18s) on a
different new database, with canonical hashes, clean constraints and no residual
sessions. Focused worker/runtime/command/workflow32/32, types,177 boundaries
and23 installed dependency licences pass. The first full standing run overlaps
the separate database proof and records1,673 pass/1 failure: an unchanged long-stay
tax-preview case reaches its5s deadline. Its unchanged isolated suite passes12/12
(45 assertions; failing case3.41s). A controlled complete run after the database
proof finishes passes **1,674 tests,0 failures**, with1,264 explicit DB/Unix skips
and22,293 assertions across504 files in101.95s. This does not establish the earlier
timeout's cause; no timeout or test was changed, skipped or hidden. Fresh exact-source
CI remains required before integration. No product validation, applied migration,
provider or stable-local77 behavior changed.

**Shared browser-journey deadlines — D1397.** The next exact CI34046418901
verifies Linux batching and owned-child cleanup, but the first Chromium launch
exceeds the newly introduced eight-second inner budget. The isolated gate is
23 pass / 1 fail; full quality and database stages are skipped, not approved.
The scoped repair gives each complete twelve-case journey one monotonic deadline
inside its unchanged60s/90s outer limit. Remaining time is checked before each
spawn; exhausted budgets fail without launching another child. No case, geometry
assertion, unique profile or cleanup obligation is removed.

Root's repaired focused browser/helper/workflow run passes15/15 (213 assertions).
The complete standing suite passes **1,674 tests, 0 failures**, with1,264 explicit
database/Unix skips and22,293 assertions across504 files in106.09s. Typecheck,
177-file boundaries,23 dependency licences and diff-check pass. Independent
workflow/helper/status/CLI proof passes23/23 with one explicit Unix-fixture skip;
separate personal browser execution passes4/4 (120 assertions,42.74s), with all
frozen hashes unchanged. The reviewer approves this bounded repair for publication;
new exact-source Linux CI remains required before integration. Main79 and the
stable local77 are unchanged; no provider is enabled.

**CI process containment — D1396.** The exact bd35c8a run34044350648 fails
four existing child-process timeouts; no current80 database gates execute. The
same test order and almost identical preceding elapsed time on the passing run,
plus recurrence before Q204, do not identify a new fiscal-runtime defect. Scoped
repairs remove per-record shell forks, preserve exact historical counts, give the
three matching browser proofs unique profiles, and bound child output, cancellation
and reaping inside each existing outer deadline. Independent inspection catches and
closes inherited-pipe, cleanup-margin and PID-fixture leaks. No test assertion,
existing deadline, product code, applied migration or permission is weakened.

Root's final complete suite passes **1,673 tests, 0 failures**, with 1,264 explicit
database/Unix-platform skips and22,266 assertions across504 files in107.00s. The
actual three browser journeys pass4/4(120), and independent final helper/status/
workflow/CLI proof passes22/22(141), with one explicit Unix fixture skip. Types,
177-file boundaries and23 installed dependency licences pass. New Linux CI must
execute the real empty/marker/response/symlink batch fixture, an isolated subprocess
gate and the complete suite, then all current80 database/process/referee gates.
This is a tested development candidate, not a merged or activated release. The
single local still reports ready atb5ef708/frontier77; no restart occurred.

**Catalogue correction — D1395.** PR88's next exact head efa71b8 passes actual
founder status and five CI34043585965 jobs, but an older runtime-authority test still
expects fourteen capabilities instead of fifteen. The correction preserves all old
signatures, configurations and ACL checks, and explicitly verifies the new discovery
function, its bounds, return shape and cursor index. Focused tests and types pass;
35 database cases are honestly skipped locally. Fresh complete CI must execute the
later fiscal/Linux gates; neither failed run is integration approval.

**CI correction — D1394.** Q204 is published as PR88 at a4a1346. Five jobs in
CI34043209976 and normal CodeQL pass. The database job stops on an older exact
six-worker status assertion; the seventh fiscal worker correctly reports disabled.
Only that test's response type and exact expected field are corrected, preserving
all privacy/access checks. Root focused proof passes 12 tests with 5 explicit
database/Linux skips; typecheck passes. The later database gates did not run and
must pass in fresh exact-source CI before independent integration. Main79 and
the stable local77 remain unchanged.

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
| Source and integration | PR91 independently merged at3503b0c after all-six CI34067083341, CodeQL and new-only postmerge referee11/11 | Main is the sole release branch. Q20885 operator invoice/print and the first Astra three-layout shell are verified local development; new exact-source CI and integration remain required |
| Native fiscal acceptance | Independent migration41/41, native116/116, compatibility89/89, catalogue23/23, exact schema and referee11/11; all five [PR83 CI jobs](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) passed | [Review434](../handoff/reviews/434-native-fiscal-source-completion.md) approves bounded native issuance, not provider activation or a retained hotel database |
| GitHub work queue | PR91 is merged; Astra PR86 remains draft/conflicting with its original CI successful | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) preserves earlier dispositions; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live queue |
| Database schema | Main81/128; candidate85 is applied only to named synthetic proof targets | Applied migrations remain immutable. Founder preview77/127 is not migrated by these isolated proofs |
| Private issued-wire proof | Independent10/10 unit and4/4 real-issued tests, including exact unchanged financial rows and cross-tenant isolation | Source/wire hashes differ deliberately; no certified provider, durable submission writer or fiscal acceptance is claimed |
| Hotel journey design | [Workbench specification](design/STAFF-WORKBENCH-SPEC.md), [casebook](design/HOTEL-CASEBOOK.md) and [research](research/HOTEL-OPERATIONS-REVIEW.md) are preserved from PR84 | Fictional interaction study; final visual fidelity needs an accessible reference and matched screenshot evidence |
| Local app | Exactb5ef708 native Windows preview personally verified on the laptop: readiness77, source archive hash, synthetic login and referee11/11 | [Recovery details](RECOVERY.md) distinguish native startup from Compose; no new screenshot, production stability or unmerged fiscal activation is claimed |
| Main verification and cloud | Main81 exact-source CI34067083341 and independent postmerge referee11/11 pass | No cloud host, ingress or serving URL is connected. Image/source publication is not deployment; retained founder preview remains77 |

A branch, document, test, container build, merge and deployment are separate evidence
states. The runtime must identify its exact source and applied migration frontier.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases0–3,5 and6 | Independently reviewed | Later changes still require regression proof |
| Phase4 | Built; integration review outstanding | Preserve implementation and close remaining integration evidence |
| Phase7 operational flows | Consolidated and independently approved baseline | PMS, stay, folio, payment, approval and fiscal-support flows remain preserved; this does not complete the whole phase |
| Order434 native fiscal issuance | Independently approved and merged through PR83 | Real source-to-invoice, accounting, replay, concurrency, tenant isolation, bounds and migration proofs pass; no provider registration or operator invoice screen is implied |
| Order440 fiscal submission | Q207 authenticated provider, signed storage and authorized receipt read independently merged through PR91, main81; full CI and new-only postmerge referee11/11 pass | Q208 operator invoice/print workflow is unmerged development; runtime activation and authentic sandbox acceptance remain outstanding |
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
