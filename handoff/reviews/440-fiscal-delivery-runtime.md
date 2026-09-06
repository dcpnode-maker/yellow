# Order440 / Q204 independent delivery-runtime review

Reviewer: `/root/fiscal_http_acceptance`, 2026-09-06. This reviewer implemented
none of the runtime, SQL or tests. Scope is the explicit Q204 admission; this is
separate from PR87's published migration79 candidate. No Q204 integration approval
or production-provider activation is implied.

## Personally executed isolated PostgreSQL proof

Read PROJECT, ROSTER, Order440, Q204 admission and the PostgreSQL skill. Inspected
the full frozen SQL80, discovery source/runtime, provider/registry/worker and
repository changes, server composition/lifecycle and actual integration fixture.
The PostgreSQL skill governs forward-only SQL, transaction-local identity and
real concurrency/tenant execution; no applied predecessor was edited.

Before creation, personally verified `yellow_order434_production` on loopback55503:
77 migrations,127 public tables,0 tenants,0 other sessions, and all77 ledger hashes
matching canonical bytes. Closed the template connection, independently rechecked
zero sessions from /postgres, and required exact target nonexistence. Created only
`yellow_order440_q204_review_90604` from that pristine77 template. Canonical
`runMigrations` discovered80 and applied exactly78,79,80 in order on backend11924.
No seed, global role, retained database, cluster or stable app was changed.

An in-memory PowerShell here-string passed to `bun -e` read the two protected env
keys in-process, verified loopback127.0.0.1:55503 and deploy/runtime usernames, and
replaced only the pathname. Neither URL nor credential was printed or persisted.
The child test received command-scoped
`YELLOW_ORDER440_DELIVERY_DEPLOY_DATABASE_URL`,
`YELLOW_ORDER440_DELIVERY_RUNTIME_DATABASE_URL` and
`YELLOW_REQUIRE_ORDER440_DELIVERY=1`.

```text
bun test tests/fiscal-submission-delivery-runtime.integration.test.ts
11 pass, 0 fail, 93 assertions, 27.61s

bun test tests/fiscal-submission-worker.test.ts \
  tests/fiscal-submission-delivery-runtime.test.ts tests/server-lifecycle.test.ts
25 pass, 0 fail, 139 assertions, 245ms
```

The genuine path uses signed HTTP and native-issued synthetic invoices, real
PostgreSQL discovery/claim/reconcile, and explicitly isolated deterministic adapter
registrations. It covers two tenants, minimal discovery identities, role/context
denials, bounded keysets and wrap, unavailable-adapter zero mutation, competing
runtimes with exactly one submit, shutdown-to-unknown, ignored late success and
lane quarantine, database-time lookup cadence, abandoned-lease lookup-only
recovery, explicit retry and active-tenant discovery/claim race. Financial document,
series, journal and posting snapshots remain unchanged in the registered cases.
Fixtures deactivate only their own synthetic tenants after each case.

Frozen hashes independently matched before execution and again afterward:

- SQL80: `2c6b1a82e031470bace7ae8b37a2d67e54497014bd1e82f5364d23a2ce25f250`.
- Actual test: `74fe806bc8487796f5e26b7458d8f64a88e8db2522b825fe105748692b52b397`.
- Fixture: `cf55824e8992b9fd5e69418d39f1308494b4b385012cdf5ee6c60fa7f5e0937b`.

## Additional reviewer-authored execution, no product edits

A second in-memory `bun -e` harness used only the same newly created review DB.
It personally checked discovery owner yellow_owner, SECURITY DEFINER, fixed
search_path, runtime EXECUTE and app_role EXECUTE denial. Direct yellow_runtime
SELECT on both fiscal head and history returned42501.

It created one additional signed-HTTP synthetic scenario, captured exact JSON for
document,document_series,journal,posting_line,fiscal_submission,
fiscal_submission_history,fact_log,outbox, then held that submission's real row lock
in a deploy transaction. The runtime repository used100ms lock/1000ms statement
timeouts. Claim returned sanitized database_error in134ms and all eight snapshots
were byte-identical. After releasing the blocker, current_user was yellow_runtime,
tenant context empty and both timeout GUCs back to0. The same repository/pool then
successfully claimed the same row. Nine assertions passed. Its synthetic tenant
was deactivated, blocker rolled back, and all owned pools/connections closed.
The proof database is retained; no destructive cleanup or test rerun against an
already populated target occurred.

## Bounded review disposition

No additional blocking defect found in the reviewed frozen provider-neutral
discovery/claim/transport/reconciliation slice. Adapter lanes reserve before claim,
revalidate provider identity afterward, release normally only after transport
settles, and quarantine an abort-ignoring original promise. Unknown transport never
becomes an automatic resend; current SQL keeps lookup cadence and active-tenant
claim checks aligned with discovery. Production registration stays empty and an
enabled workbench runtime fails before listening without a real registration.
Repeated shutdown signals retain handlers throughout the bounded drain.

This is NOT final Q204 acceptance. Current80 schema/fresh-upgrade equivalence,
complete catalogue/standing gates, canonical referee, frozen Linux actual-process
proof and fresh exact-source CI remain coordinator/integration obligations.
The new server-fiscal-runtime test was still being changed during this review and
is not claimed as executed or approved here. PR87's separate migration79 CI and
P2 conversation remain subject to their own final review. No merge, source edit,
provider call or local-preview replacement was performed in this lane.

## Independent current80 schema and canonical referee

On2026-09-06 the same non-implementing reviewer personally completed the separate
current80 schema/referee obligation while PR87's published79 CI ran. Rechecked
frozen SQL80 SHA256 `2c6b1a82e031470bace7ae8b37a2d67e54497014bd1e82f5364d23a2ce25f250`
and schema snapshot `03796c8d46400892158875f6957525b5ec91e6406e7cb9d3f13787800ee32b8e`
before execution. No runtime/frontier source was edited by this reviewer.

From the existing protected deploy authority on127.0.0.1:55503, verified pristine
`yellow_order434_production` again:77 migrations,127 public tables,0 tenants,
0 other sessions, all77 applied hashes matching canonical files. Closed that
connection, rechecked zero template sessions from /postgres and exact target
nonexistence, then created only `yellow_order440_q204_referee_90604` from the
template. Canonical runner discovered80 and applied exactly78,79,80 on backend15688.
No retained proof database or preview was reset or migrated.

Native PostgreSQL16.15 pg_dump, with schema-only/no-owner/no-comments flags and
command-scoped PGPASSWORD, produced a dump normalized by the repository's strict
`normalizeSchemaDump(..., true)` wrapper validation. Actual and frozen expected
schema are byte-identical:1,620,228 bytes; SHA256
`03796c8d46400892158875f6957525b5ec91e6406e7cb9d3f13787800ee32b8e`.

Then personally executed the same unwrapped seed/referee path required by setup.sh:

```text
psql --host=127.0.0.1 --port=55503 --username=yellow_deploy \
  --dbname=yellow_order440_q204_referee_90604 --no-psqlrc \
  --set ON_ERROR_STOP=1 --file tests/seed_fixture.sql
canonical seed passed

python tests/run_invariants.py yellow_order440_q204_referee_90604
RESULT: 11 passed, 0 failed of 11
```

Python received YELLOW_DSN only in its child environment and UTF-8 output. The
referee recorded one winner in the50-thread exclusive race, exactly6 bed claims,
direct occupancy INSERT42501,162 commits in1.26s (128/s), deferred unbalanced
journal rejection, balanced commit, sealed-day denial,100 gapless numbers1..100,
118 tenant/RLS/policy tables and2 security-invoker views with cross-tenant isolation.
All proof connections closed. The new seeded referee DB is retained for audit;
no deletion, role change, external provider call or local process restart occurred.

Current80 schema and canonical referee are now personally discharged. Frozen
Linux actual-process test SHA256
`56ca49c718f8d0d85d61e45a0159f19e030d0dfa2fb60ab1cc2574cdb578c670`
was identified by the coordinator but was NOT run on Windows. Complete current80
catalogue/readiness, fresh-upgrade equivalence, standing and exact-source CI remain
separate integration gates. This proof does not approve or alter PR87's79 source.

## Supplemental current80 readiness-capability review

After PR87's independent79 merge/post-merge proof, the reviewer inspected the
separate three-file Q204 readiness addition: build-info.ts, pure readiness tests
and database readiness tests. The fiscal authority CTE now requires exactly five
known functions, including runtime_due_india_fiscal_submissions(integer,uuid,uuid)
with runtime_allowed=true. The existing owner, SECURITY DEFINER, exact proconfig,
app/runtime split EXECUTE and PUBLIC-denial checks apply to that fifth function;
the LEFT JOIN plus exact count fails closed if discovery is missing.

The database test adds an explicit exact79 predecessor lacking discovery and
requires its rejection, then expects only80 in the current upgrade helper. New
PUBLIC EXECUTE, app_role EXECUTE and TimeZone drift probes all restore the original
authority/configuration and recheck success. Existing75/77 denials and hostile
history/request/claim checks remain. No SQL80 bytes were changed by this addition.

Personally executed only the safe pure file:

```text
bun test tests/build-readiness.test.ts
4 pass, 0 fail, 26 assertions, 1039ms
```

Scoped diff-check passes (ordinary CRLF-normalization notice only). Reviewed hashes:
build-info36b6d943551c151dcab51adb7ff31e4bd84c778b11cde07cb2c158070a7ae8f8;
database-test92faa7a5724459d055b22da0a796141fe9206f1d6902378806c55c6886327aca;
pure-test64b9e238327eda16f39dc4879b9d4123c5eca2665a5689b560f3e5e78cfd8603.
Linux process test still matches frozen56ca49c718f8d0d85d61e45a0159f19e030d0dfa2fb60ab1cc2574cdb578c670.

No source-review blocker in this addition, but pure query-shape assertions do not
replace the actual79-denial/80-acceptance/hostile-restoration cases. The Windows
database-readiness crash suite and Linux process suite were not executed here.
Genuine Linux readiness/process and complete frozen80 CI remain mandatory before
Q204 integration. No Q204 product edits or activation were made by this reviewer.

## Final development-publication review — one current-oracle correction required

Reviewer `/root/fiscal_http_acceptance` reviewed the final Q204 source delta and
its amended admission, including the six legacy-oracle corrections, bounded
single-file Chromium startup helper, Linux process test, CI/release gates,
historical Q205 prefix isolation and new79-to80 migration proofs. Existing recorded
personal genuine delivery/ACL/rollback/schema/referee evidence remains applicable:
SQL80, schema and Linux-process source still match the frozen hashes above.

The legacy test changes retain workbench-only exact opt-ins, shared cancellation,
fixed sanitized failure messages, private raw snapshot helpers and the empty shared
production registry. They update old composition assertions rather than weakening
business effects/permissions. Chromium readDevToolsPort catches only EBUSY/ENOENT
and returns to the existing800-iteration/25ms startup loop; other I/O errors rethrow.
Viewport,DSF,overflow,label/rail assertions and process ownership remain unchanged.

The Linux process test was read completely: required mode throws outside Linux;
actual cases exercise a real default-disabled server with SIGTERM, enabled-empty
failure while a reserved port proves no listen occurred, and repeated real SIGTERMs
through the production lifecycle during a pending drain. Child output is bounded
and private sentinels are checked; only owned processes and validated temporary
paths are cleaned. These actual cases remain unexecuted on this Windows host.

CI retains six jobs. Its required current80 delivery test uses an empty isolated
clone, distinct credentials and REQUIRE=1; the required Linux process file is run
without filtering/suppression. Cleanup is registered before clone creation. Q205
still copies exact canonical1–79 bytes and tests actual78-to79 receipts; its
historical scope is not silently upgraded to80. New migration tests assert injected
rollback/schema preservation, old79 ledger preservation, exact80/no-op/checksum
rejection and fresh80-versus-upgraded79 schema equality. Actual execution of these
new migration and Linux/readiness cases is still required in exact-source CI.

Personally executed with all YELLOW_* variables removed:

```text
bun test tests/fiscal-replay-workflow.test.ts tests/server-fiscal-runtime.test.ts \
  tests/fiscal-submission-worker.test.ts tests/fiscal-submission-delivery-runtime.test.ts \
  tests/server-lifecycle.test.ts tests/build-readiness.test.ts \
  tests/arrival-pickup-task-worker-wiring.integration.test.ts \
  tests/reservation-arrival-roll-worker-wiring.integration.test.ts \
  tests/reservation-departure-roll-worker-wiring.integration.test.ts \
  tests/fiscal-submission-commands.test.ts tests/operator-fiscal-submission.intentional-red.test.ts \
  tests/release-workflow.test.ts tests/operator-app-bar-responsive-containment.intentional-red.test.ts
59 pass, 9 explicit database/Linux skips, 0 fail, 414 assertions, 4.72s
```

This includes actual375/640px DSF2 Chromium geometry plus both new deterministic
port-reader regressions, not only static UI assertions. YAML parses CI6/release1;
three additional TypeScript syntax checks (migration/Linux-process/historical-replay
tests) pass. Scoped diff-check passes. No known Windows database-readiness suite ran.

**Finding before publication:** the older full-current historical-lineage test in
tests/migrate.integration.test.ts still ends its exact appliedFiles expectation at
0079 (line2280 at inspection), although its runner uses PROJECT_MIGRATIONS and the
following ledger/no-op counts now expect80. This deterministically fails when80 is
applied. Append exactly0080_fiscal_submission_delivery_runtime.sql to that list;
preserve historical predecessor44 bytes and no-op assertions. Reviewer immediately
reported this to the coordinator and made no product/test edit.

No other static blocker found in the reviewed provider-neutral candidate. Development
publication/new-PR clearance is conditional on that exact oracle correction and
completed coordinator standing/type/boundary/license gates. It is NOT integration
approval: current80 genuine delivery, migration equivalence, Linux process,
79-denial/80-acceptance/hostile readiness, schema/deployment, referee and all required
exact-source CI must be green and independently inspected before merge. No stable
local/provider/cloud promotion, main edit or workflow dispatch occurred here.

## Publication hold — restart-safe provider lookup input

The coordinator added exactly0080_fiscal_submission_delivery_runtime.sql to the
full-current appliedFiles list above. Reviewer personally rechecked that list and
the scoped migration-test diff-check: the reported oracle blocker is resolved.
The coordinator reports full standing1664 pass,1263 explicit database skips,0 fail,
22221 assertions,110.65s before that final one-line correction; this is attributed
implementer evidence, not an additional reviewer-executed standing run.

Development publication remains **HOLD**, superseding the conditional clearance
above. Subsequent provider-integration inspection by the coordinator and another
agent identified that lookup's internal UUID/digest binding alone cannot identify
the provider invoice after a process restart. The admission now explicitly requires
detached original issued wire payload on lookup, derived from the existing claimed
wireJson rather than an in-memory submit cache, new store or SQL rewrite. The
reviewer read this amendment and awaits the frozen implementation and permanent
fresh-worker PostgreSQL regression before independently inspecting/executing it.

The earlier11-pass/93-assertion delivery result remains historical evidence for its
then-current source; it does not discharge this newly identified recovery gap.
Frozen SQL80 and retained databases are unchanged. No product/test edits, new
database, publication, workflow dispatch or activation were made for this hold.

## Restart-safe lookup repair — personally executed independent acceptance

Reviewer `/root/fiscal_http_acceptance` independently inspected the frozen five-file
repair under the explicit Q204 amendment. FiscalProviderLookup now requires the same
payload contract as submission. The worker revalidates claim identity and whole-wire
SHA256 before transport, then constructs a new Uint8Array from the immutable claimed
wireJson for lookup. This detached buffer does not alias a mutable repository object
or depend on previous submit memory. Existing binding, cancellation/deadline,
quarantine, normalized reconciliation and transaction boundaries remain unchanged.
No provider-specific authentication, external call, new store or SQL change is added.

The unit case checks exact original bytes, their digest, complete binding, context
and lookup-only normalized result. In the real PostgreSQL regression the original
claimant has an empty registry and is closed before a new adapter/runtime is created.
That fresh adapter begins with zero calls. After expiring only the synthetic claim's
lease, discovery invokes lookup only; both payload-body and declared hashes match
the original issued wire, acceptance is reconciled and the four-event history is
exact. No previous in-memory submit path can supply that adapter's lookup input.

Personally executed:

```text
bun test tests/fiscal-submission-worker.test.ts \
  tests/fiscal-submission-delivery-runtime.test.ts tests/server-lifecycle.test.ts
25 pass, 0 fail, 143 assertions, 330ms
bun run typecheck
tsc --noEmit: exit0
git diff --check -- <the five frozen repair files>
exit0
```

For the separately authorized new target yellow_order440_q204_review_90605, an
in-memory bun -e harness read only the approved protected deploy/runtime env keys,
validated127.0.0.1:55503 and exact usernames, and replaced only URL pathname. It
required target nonexistence and reverified pristine yellow_order434_production:
77 migrations,127 public tables,0 tenants,0 other sessions,all77 canonical hashes.
After closing its template connection it rechecked zero sessions from /postgres,
then created exactly that one clone. Canonical runMigrations discovered80 and
applied only78,79,80 on backend14888, all three transaction PIDs14888. Frozen78/79/80
hashes were checked before execution. No seed/global-role/old-database change ran.

The child process received only command-scoped Q204 deploy/runtime proof URLs and
YELLOW_REQUIRE_ORDER440_DELIVERY=1; other YELLOW_* variables were removed.

```text
bun test tests/fiscal-submission-delivery-runtime.integration.test.ts
11 pass, 0 fail, 95 assertions, 48.41s
fresh-worker exact-issued-wire recovery case: pass, 5.54s
```

This full run also personally re-executed tenant/role isolation, bounded discovery,
real signed HTTP delivery, unavailable zero-effect, competing runtimes, shutdown/
late-result/cadence, explicit retry and active-tenant race cases. Final read-only
checks find the template still77/0tenants/0other sessions and the new proof DB at80
with12 synthetic tenants,all inactive,0other sessions. All owned pools closed; the
proof database is retained, not reset or deleted.

SHA256 values personally matched before and after execution:

- fiscal-provider.ts: ce71dda8ae8cfa6d5c2ccc4ca8aff8540a999120da7cccdecd099fc6f2acb5ae
- fiscal-submission-worker.ts: 7804ac96ea37ea72dc9d6d6ae04ff9d046d0ac952858b4b8ec342b6a9b4df829
- worker.test.ts: bc6b239de8fe0afe7a586fcdb6390d6e8fba67251e222071c4865b0c8cd05528
- delivery fixture: 3bc9e690900a25ae4e8fbf03cc8b8ae7ae23e56520b7a208a23bf67681c51e27
- delivery integration test: 66c86b73154ef3a0972ca34d031e95f3e4e932eb2bcad0058837fd92dfac3ee1
- SQL80 remains2c6b1a82e031470bace7ae8b37a2d67e54497014bd1e82f5364d23a2ce25f250
- schema remains03796c8d46400892158875f6957525b5ec91e6406e7cb9d3f13787800ee32b8e

The restart-input publication blocker is discharged for these exact bytes. No
additional static blocker found in this repair. Together with the preceding review,
development publication/new PR is acceptable once the coordinator's final standing
and remaining repository gates pass. This is not integration or provider activation
approval: mandatory exact-source Linux process/readiness/migration/current80 CI and
final independent PR review remain required. The older11/93 result stays historical;
the new11/95 result is the personally executed current delivery evidence. Reviewer
changed only this admitted review record, not production/tests/main or local apps.

## PR88 exact-source CI failure — no integration approval

Reviewer personally inspected PR88 at exact published head
a4a134660a3bc13b45e545a678597fd1d34adb29 over main
22f1beddea23429ccd9111092dccf6176386adf2, its56-file immutable diff, body and current
conversation/check state. The frozen repair, SQL80/schema and preceding personal
proof remain applicable; applied1–79 are not changed. Scoped full diff-check passes.

Automatic CI34043209976 completed with five successful jobs (quality, local-review,
windows-state, free-host-arm64, container-smoke) and database failure. Normal
CodeQL34043208505 passed. This reviewer launched no duplicate workflow or rerun.
Actual local-review and ARM64 logs each show128 tables after1–80 and canonical
RESULT:11 passed,0 failed of11; ARM64 runtime status reports frontier80. Those
successes do not substitute for the blocked database integration chain.

Personally retrieved the exact failed job with:

```text
gh run view 34043209976 --json headSha,status,conclusion,jobs
gh run view 34043209976 --job 101513773620 --log-failed
```

Earliest failing gate: Execute isolated Phase3 database proofs, specifically
tests/founder-status.integration.test.ts:744, P1 granted-property exact live status.
Expected workers omits fiscalSubmissionDelivery, while published operator.ts:2755
correctly returns fiscalSubmissionDelivery:"disabled". Output is7 pass,1 fail,
150 assertions,1.59s. This is a substantive deterministic stale-oracle assertion,
not a timeout or reason for a blind retry. Coordinator was immediately notified
to admit a narrowly scoped expectation correction; reviewer made no test edit.

The migration integration suite, Q204 delivery/Linux-process proof, readiness and
compatibility chain, deployment acceptance and database-job referee were all
SKIPPED downstream. They are not green evidence at this head. PR88 remains
MERGEABLE/UNSTABLE with unchanged head/base; **NO MERGE** until a corrected published
source passes every required gate and final independent review. No database action,
stable-local promotion, provider call, admin bypass or branch deletion occurred.

## PR88 corrected status oracle — next exact-source catalogue blocker

Reviewer independently inspected a4a1346..efa71b830c3d56f553d33558027e9cda22a7fcae.
The admitted founder-status test correction changes only its response type and
seventh exact expected disabled worker field. Six existing states, whole-object
equality and privacy/access assertions are intact; diff-check passes. Frozen
provider/worker/delivery/SQL80/schema hashes still match personal acceptance.

Personally ran bun test with founder-status.integration.test.ts,
server-fiscal-runtime.test.ts and build-readiness.test.ts:12 pass,5 explicit
database/Linux skips,0 fail,165 assertions,498ms. This local check does not claim
execution of the corrected database assertion.

Automatic exact-head CI34043585965 then genuinely executed both founder-status
P1 and P2 successfully on Linux. The next failure is database job101514797757,
Phase3 runtime-database-authority.integration.test.ts:356 and465: expected14
runtime_% functions, received15. Output8 pass,2 fail,49 assertions,241ms. The new
discovery function is the legitimate fifteenth capability. Reviewer inspected the
surrounding exact signature list and configuration predicate, not just the counts:
the list also lacks runtime_due_india_fiscal_submissions(integer,uuid,uuid), and
the universal one-setting config expectation must distinguish that exact new
function's fixed search_path,TimeZone=UTC,DateStyle=ISO,YMD from the fourteen
unchanged older configs. Universal owner/runtime-grant/PUBLIC-app denial checks
must remain strict. Coordinator received this full diagnosis before repair.

Five jobs and normal CodeQL passed; database failed. All downstream migration,
Q204 delivery/Linux-process, readiness/compatibility/deployment and database-job
referee gates were skipped again. No blind retry, dispatch, source edit or merge
was performed. **NO MERGE** remains until admitted narrow catalogue corrections
and new exact-source execution discharge every required gate.

Supplemental personal read-only query on retained q204_review_90605 used pg_proc
for the exact discovery regprocedure, selecting proconfig and
pg_get_function_result. PostgreSQL returns exactly:

```text
config = ["search_path=pg_catalog, public, pg_temp","TimeZone=UTC","DateStyle=ISO,YMD"]
result = TABLE(tenant_id uuid, submission_id uuid, provider_key text, provider_extension_id uuid, provider_extension_version integer)
```

In particular DateStyle has no space after its comma. One protected deploy
connection was opened read-only in usage and closed; no suite, mutation, role action
or clone was performed. This confirms the exact catalogue oracle for the repair.

## Exact bd35c8a catalogue repair — independent read-only verification

Reviewer inspected efa71b8..bd35c8a735fb35bb809c98f39dcc9cade752f350 and the explicit
Q204 amendment. Both test deltas preserve the fourteen previous runtime signatures,
their exact single-setting configs and universal owner/grant/denial checks. They
add only exact discovery authority/result/input checks, and deployment acceptance
now requires the fifth fiscal capability plus the valid/ready tenant-leading
partial cursor index definition. No product or applied SQL changed; diff-check
passes. New automatic CI34044350648 is tied to this exact head over main22f1bed.

Personally executed an in-memory bun -e read-only catalogue harness against retained
yellow_order440_q204_review_90605. It compares the ordered15 runtime signatures to
the repaired test's explicit list, then asserts every owner and runtime/PUBLIC/app
grant, all14 unchanged configs, exact fiscal config, SECURITY DEFINER/result and
the complete index definition with indisvalid=true and indisready=true. All pass.
The index is exactly:

```text
CREATE INDEX fiscal_submission_delivery_cursor ON public.fiscal_submission USING btree (tenant_id, id) WHERE ((delivery_version = 1) AND (status = ANY (ARRAY['pending'::text, 'submitted'::text])))
```

One protected deploy connection closed; no DDL, role change, fixture suite against
the retained DB or new clone occurred. With no database test env configured,
bun test runtime-database-authority.integration.test.ts and
database-acceptance.integration.test.ts passes3 pure tests,35 explicit DB skips,
0 failures,24 assertions,136ms. bun run typecheck passes. These are not substitutes
for the full runtime-authority/acceptance database suites now required in new CI.
No source edits, workflow reruns, merge or activation were performed.

## bd35c8a automatic CI — child-process timeout failure

CI34044350648 attempt1 completed failure at exactbd35c8a. windows-state and
local-review passed; quality job101516618935 failed and dependent database,
free-host-arm64 and container-smoke jobs were skipped. Normal CodeQL34044348485
passed. No genuine new-head database gates executed in this run.

Reviewer personally retrieved the full failed quality log and inspected all four
reported failures. Earliest is project-status.test.ts, Unix report case, at
16:06:49Z:5004.58ms/5000ms timeout, killed dangling child, followed by an unhandled
exitCode expected0/receivednull assertion after the timeout. Subsequent failures:
business-day-seal Chromium90000ms, import-boundary real CLI5000ms with dangling
child killed, owner-trust Chromium90000ms. No substantive assertion failure before
those timeouts is visible. Git diff from main22f1bed to bd35c8a confirms all four
test files are unchanged. This resembles the previously recorded multi-child
timeout pattern but its underlying runner/harness cause is not established here.

Commands: gh run view34044350648 --json status,conclusion,jobs;
gh run view34044350648 --job101516618935 --log-failed; exact git diff for all four
affected files and read of project-status runState/Bun.spawnSync harness. Reviewer
reported the first failure and downstream skip boundary immediately. **NO MERGE**;
no rerun or workflow dispatch was authorized/performed in this inspection. No
assertion, timeout, configuration or production source was weakened or edited.

## Independent failed-versus-successful quality diagnosis

Reviewer personally compared full quality logs34044350648/job101516618935 with
successful quality34043585965/job101514570696 using an in-memory parser. Both
execute exactly the same373 test-file groups in the same order before project-status.
Elapsed to that group is38,972ms failed versus38,958ms successful, a14ms difference.
Immediately preceding runtime-authority executes the same three unchanged pure
tests and skips its database body. bd35c8a changes only two DB test bodies and
governance records; the new authority assertions do not execute in quality. No new
executed pre-timeout setup/global-state mutation is identified from this delta.

Both jobs use Bun1.3.14 commit0d9b296a, runner2.337.0, Ubuntu24.04.4 and image
20260831.293.1. Worker regions differ (failed eastus, successful northcentralus).
No ENOMEM, EMFILE, EAGAIN, ENFILE, ENOSPC, OOM, resource-unavailable or panic signal
is visible. The logs do not contain CPU/memory/FD/process-limit telemetry sufficient
to diagnose exhaustion. Similar pre-failure elapsed time does not rule out a later
resource stall, but cannot support a claim of one either.

The successful four case durations are status1744.85ms, seal10443.64ms,
CLI165.11ms, owner-trust10169.44ms; the failed run hits their5s/90s/5s/90s limits.
Source inspection finds status uses Bun.spawnSync without an inner deadline;
state.sh spawns hundreds of grep/basename commands and unbounded read-only Docker
status commands. The two browser harnesses discard stderr, wait for stdout EOF
then process exit, and do not kill an owned child in their finally cleanup. The
CLI concurrently waits for exit and both streams. Thus existing logs cannot
distinguish child execution stalls from stream/child-reaping waits.

Q204 lifecycle's signal test removes its listeners in finally and asserts restoration;
no global mock/clock/env modification was found in inspected worker/runtime tests.
The exact four-timeout pattern was already independently recorded at7235e27;
git ls-tree confirms that head contains neither Q204 lifecycle source/test nor
server-fiscal-runtime test. Therefore this new Q204 signal code is not a necessary
precondition, although a general ordering/runner issue remains unproven.

Proposed next diagnostic, not executed or authorized by this record: preserve all
assertions/deadlines, compare unchanged four-case isolated Linux execution with the
same ordered full prefix, and collect bounded external-watchdog child PID/status/
wait-channel, RSS,FD/process-limit and state-script stage timings. Record only
listener counts/environment key names, not credential values; capture bounded
browser stderr. An external observer is needed if the Bun event loop itself stalls.
Any diagnostic source/workflow changes need explicit admission. Final full exact
CI remains mandatory regardless of an isolated pass. No rerun, dispatch, mutation,
production edit or merge occurred during this read-only diagnosis.

## State batching review — Windows proof and reference-oracle edge case

Reviewer read the full admitted state.sh/project-status.test.ts delta. For ordinary
readable non-hidden regular records, batching preserves anchored MERGED/RESOLVED/
RATIFIED semantics, architect-response exclusion, report metadata and zero-record
handling. Quoted arrays, grep -- and NUL-delimited output preserve spaces/newlines;
parameter expansion replaces per-question basename. The Unix fixture instruments
only marker scans, expects0 for empty groups and2 for populated groups, and retains
the original outer deadline with a2s owned fixture process timeout.

Personally ran bun test tests/project-status.test.ts on native Windows:
5 pass,1 explicit Unix-fixture skip,0 fail,46 assertions,5.09s. Actual PowerShell
valid-report case3224.94ms and invalid metadata1789.21ms; scoped diff-check passes.
No system32 bash/WSL was invoked. The new Unix batch fixture still requires Linux
execution; this result neither executes batching nor proves the CI root cause fixed.

At inspection state.sh SHA256977496544ba0dedaec9773dff59299f7040a67dbdf6ff2671831dcecb55c8f4c;
test4438aca08de0afce63f8dfc10049bcc0a143be47e3cd77e1df9ce4d508eb7ccc.
One reference-oracle issue was reported: historicalCounts uses readdir/isFile,
including hidden.md names but excluding file symlinks, whereas Bash *.md excludes
dotfiles and -f follows file symlinks. No such current .md entries were found, so
the real current count check passes; only.gitkeep hidden entries exist. Align the
helper and fixture before claiming generic equivalence across those cases. No
production/test edit was made by the reviewer. Linux batching and forthcoming
owned-child helper proof remain separate mandatory acceptance obligations.

## Revised state/workflow review — helper lifecycle acceptance held

The revised historical reference excludes dotfiles, follows valid file symlinks,
skips broken links, and tests a symlinked architect response plus exact fixture
counts. This resolves the reported reference mismatch. Status invocation now awaits
the owned async helper; Linux fixture uses its2s inner lifecycle deadline. CI adds
a required isolated six-file subprocess proof with /usr/bin/time -v, followed by
the unchanged full bun test suite under the same resource reporter. No retry,
continue-on-error, test filter or reduced full-suite scope is introduced.

Personally ran project-status.test.ts plus fiscal-replay-workflow.test.ts:
8 pass,1 explicit Unix fixture skip,0 fail,87 assertions,4.67s. Native valid-report
2936.54ms and invalid metadata1666.84ms. Typecheck and scoped diff-check pass.
State hash remains97749654; revised status2a01445d15de3db620e1d34aa85145c78bdae1405a261e5396fac4df15e4569e;
workflow78d3e8bcbd4961a9f348f1987bb3d495d4c99d6cf03fbf310968df5a40cc0726;
workflow test12bab528c802545e299ad71a492f16d7f391e0b305b40f44c17c87eb98adde85.

Reviewer inspected the still-unfrozen helper and callers, reporting two additional
lifecycle concerns before final acceptance. Import-checker CLI wraps a potentially
never-settling exit/stream Promise.all only in finally; an outer test timeout is not
an inner cancellation mechanism and does not itself guarantee that finally runs.
Use a bounded lifecycle for that caller. Status's4.5s execution allowance plus the
helper's2s cleanup allowance can exceed the unchanged5s test deadline, so it cannot
yet guarantee cleanup before the outer timeout. Stream cancel/read settlement also
needs the pending inherited-pipe regression before calling total cleanup bounded.

Final helper/test proof is explicitly held pending the builder's cleanup fix/freeze.
This record does not approve current helper lifecycle behavior or claim Linux cause
identified. No WSL, database mutation, CI dispatch, source edit or merge occurred.

## Frozen owned-process helper — independent bounded acceptance

Reviewer inspected final helper014437f04f5c5ff7285c93aa3b7e5cd3a428207eb8ba18501c8ff91f25e2ffd3,
testa9e7d31a53940f8d396718057e6b41173d097a5e6a2b75f43c18a6da475ff1ce,
and import test a1fe14dafe84089bd64bcc3e8e5b3e84c550fd025bbb56797759fed8983dc92a.
These exact hashes match before/after personal execution. Previously reported
lifecycle concerns are resolved in this frozen source: timeoutMs is a total budget,
with up to250ms reserved inside it for cleanup, measured from a monotonic absolute
deadline. Termination and both reader cancellations start concurrently; allSettled
observes every rejection and the remaining absolute budget bounds waiting. Failure
to prove all cleanup complete yields CleanupError, never successful cleanup.
Import CLI now uses the same helper with3s total budget; status retains4.5s total
inside its unchanged5s test limit. Output tails are byte-bounded on both streams.

The fixture cleanup re-reads only its own recorded positive safe-integer PID and
nests directory removal in finally, so a failed PID lookup cannot bypass directory
cleanup. The deliberately detached descendant is separately terminated by its
own fixture after proving that helper pipe cancellation did not kill it. No global
process-name kill or service ownership is introduced. This remains test tooling,
not a production supervisor or a claim that the old Linux failure is diagnosed.

Personally executed exactly the agreed lightweight set, with no browser overlap:

```text
bun test tests/owned-proof-process.test.ts tests/project-status.test.ts \
  tests/import-boundaries.test.ts tests/fiscal-replay-workflow.test.ts
22 pass, 1 explicit Unix-fixture skip, 0 fail, 141 assertions, 11.07s
```

Actual child timeout/reap784.20ms and inherited-pipe reader cancellation766.24ms
both pass; oversized and multibyte tail, nonzero exit, private error text and
pre-spawn validation cases pass. Real CLI430.66ms, valid PowerShell state3346.10ms
and invalid metadata1677.35ms pass. Scoped diff-check passes. Slightly longer total
than the coordinator's earlier run is recorded honestly; no extra run was made.

This frozen small harness is accepted for development publication. Unix batching,
three updated browser cases and the full exact-source isolated/full quality gates
must still pass on Linux; mandatory current80 database/readiness/fiscal/referee CI
also remains required before independent integration. Reviewer did not run browsers
during the coordinator's full suite, alter product/tests, touch databases/services,
dispatch/rerun CI or merge. Review evidence now freezes pending publication.
