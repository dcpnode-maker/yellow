# Order440 Lane A review — fiscal submission lifecycle

Reviewer: `/root/native_migration_assembly` (non-implementer)
Date: 2026-09-06
Scope: Lane A only — `src/contexts/tax-fiscal/fiscal-provider.ts`,
`src/contexts/tax-fiscal/fiscal-submission-state.ts`, and
`tests/fiscal-submission-state.test.ts`, per Order440.

## Personally executed proof

Command:

```text
bun test tests/fiscal-submission-state.test.ts
bun run typecheck
```

Result: 14 passed, 0 failed, 66 `expect()` calls; TypeScript `tsc --noEmit`
passed. No database, service, migration, HTTP route, provider, or external
submission was used.

The tests exercise exact input/state/event snapshots, UUID/SHA/provider-key
binding, all four modes, mode-correct terminal results, pending/timeout/duplicate
lookup, known-not-sent-only retry, attempt/document/payload/tenant/provider
mismatch, terminal immutability and exact replay, hydrated mutable-state replay,
proxy/accessor/symbol rejection, and provider-pending normalization.

## Review result

Lane A is acceptable for its admitted pure contract. The reducer has explicit
closed transitions, mode conflict rejection, terminal replay protection,
known-not-sent retry gating, and frozen copied outputs. The provider interface is
provider-neutral and does not itself confer fiscal authority.

One integration note is intentionally deferred, not a Lane A failure: the
provider-port binding carries tenant/provider/attempt/document/payload identity
but not `FiscalSubmissionMode`; the durable caller/adapter integration must bind
mode when selecting and validating a provider result. Do not infer that the
current interface is sufficient for database or HTTP integration without that
follow-on check.

This review approves only the private Lane A types/reducer and these unit tests.
It does not approve Order440 as a whole, provider activation, IRP sandbox or
production registration, migration/schema changes, durable request/attempt/
receipt persistence, or Phase 7 completion.

Frozen source hashes (SHA-256):

```text
fiscal-provider.ts           7B1A0610B314A9EBF694F542B3AF7F6ED0DA10E38FC24ED58B7E3CD641F9BE60
fiscal-submission-state.ts   726269CAE184F23727DD32A5208CF846D197C7FF681A1FDB5B9098079C81E17D
fiscal-submission-state.test.ts
                              19ACEB02B730C42177464815A47D150F7BEEC855ECC455D3FF1DFDFD385034ED
```

## Q197 issued-wire projection receipt

Coordinator metadata correction2026-09-06: the Lane A reducer digest above was
missing its final `D`; rehashing the unchanged file verifies the full SHA-256.
This corrects the receipt transcription, not the reviewed implementation.

Reviewer: `/root/native_migration_assembly` (non-implementer), 2026-09-06.
This receipt is limited to the private Q197 projection; it is not a provider,
database-writer, network, or Order440 completion approval.

Commands personally executed:

```text
bun test tests/india-irp-issued-wire-candidate.test.ts
bun run typecheck
bun test tests/india-irp-issued-wire-candidate.integration.test.ts
```

Results:

- Unit: 10 passed, 0 failed, 52 expectations.
- Typecheck: `tsc --noEmit` passed.
- Genuine PG proof on `127.0.0.1:55503/yellow_order440_wire_20260906`, using
  only `yellow_deploy` and `yellow_runtime` with the supplied proof password:
  4 passed, 0 failed, 230 expectations. The three real issued invoices covered
  Karnataka, Chandigarh, and Maharashtra/Karnataka; the cross-tenant source
  isolation case also passed.
- Gating: with no URLs and `YELLOW_REQUIRE_ORDER440_DATABASE=1`, the process
  failed closed with the explicit missing-URL error (exit 1). With both URLs
  absent and the require flag unset, the integration explicitly skipped 6 tests,
  0 passed, 0 failed.

The proof verified stored source-byte hash before projection, deterministic
wire/hash replay, seven-section shape, `Version`/`DocDtls` identity, seller and
buyer preservation, fixed Qty/Unit compatibility values, bigint amount
conservation and numeric wire lexemes, unchanged document/series/journal/
posting/fact/outbox/submission/origin rows, and tenant-context isolation. The
projection returns `authenticatedProviderSandboxCertified: false`; no provider
was contacted and no IRP authority result is claimed.

Hashes before and after proof were unchanged:

```text
india-irp-issued-wire-candidate.ts             FC9787C120458D709A5DF521474A31435DAB2A0EBECC7E8AEB529C0972DFA7EB
india-irp-issued-wire-candidate.test.ts        1D561522595387D728CB28F32E038D0CFA668F9237728B1C528691C984F93C87
india-irp-issued-wire-candidate.integration.test.ts
                                                CD7FBA74653B5AD2312910AA7232B5573CF9BBCCAC25F6910D913111AE01B104
```

## Q197 CI workflow receipt

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.
Scope: `.github/workflows/ci.yml` Order440 isolated-proof step only.

Static inspection confirms the step runs after the six Order434 native suites,
while the migrated `yellow_ci_order434_native_template` remains alive. It creates
the fixed CI-owned `yellow_order440_ci` database from that pristine template,
passes explicit deploy/runtime URLs and `YELLOW_REQUIRE_ORDER440_DATABASE=1`, runs
`tests/india-irp-issued-wire-candidate.integration.test.ts`, tracks the database
in the existing `native_clones` EXIT trap, and drops it with `WITH (FORCE)` after
the proof. The existing native template/clones and other proofs are unchanged.
Database names are fixed workflow literals; no provider or external submission is
introduced.

Personally executed:

```text
bun test tests/release-workflow.test.ts
git diff --check -- .github/workflows/ci.yml
```

Result: 4 passed, 0 failed, 53 expectations; diff check passed. The focused
workflow contract test and direct YAML block/indentation inspection passed. A
PowerShell YAML parser was unavailable on this host, so no claim of a full parser
library validation is made. No CI dispatch, database, runtime, or file outside
the admitted review receipt was used.

## Q197 Lane A revoked-proxy regression receipt

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.
Scope: the private fiscal submission reducer/provider and its unit tests only.
This review does not approve a database writer, provider activation, network
submission, durable persistence, or Order 440 completion.

The repaired reducer moves the `Array.isArray` check inside the existing guarded
record validation. This preserves the invalid-input result and frozen output while
ensuring revoked proxies cannot throw before the reducer's typed `Result` boundary.
No state transition, terminal/replay rule, mode validation, provider binding, or
source authority behavior was weakened or changed. The added tests cover revoked
proxy inputs at initial creation, hydrated state, and event boundaries.

Personally executed:

```text
bun test tests/fiscal-submission-state.test.ts tests/project-status.test.ts tests/current-management-demo-status.intentional-red.test.ts
bun run typecheck
```

Results: 22 passed, 0 failed, 134 expectations; `tsc --noEmit` passed.
No database, runtime, migration, grant, or network access was used.

Frozen source hashes (SHA-256):

```text
src/contexts/tax-fiscal/fiscal-provider.ts
  7B1A0610B314A9EBF694F542B3AF7F6ED0DA10E38FC24ED58B7E3CD641F9BE60
src/contexts/tax-fiscal/fiscal-submission-state.ts
  D5A72B07F215DB2FD605848CA105D52E7566ACB9ACFAEDE8EC1D22DE8140DAA4
tests/fiscal-submission-state.test.ts
  D8DA387F7DDF3533C52726732AFDD27AC20FAA05F29F13ED74DF9FC61A9D1DC6
```

## Q199 durable foundation independent clone receipt

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.
Scope: disposable `yellow_order440_durable_20260906_v8` cloned from
`yellow_order434_production`; no template or other database was changed.

Personally executed against PostgreSQL 16.15 on `127.0.0.1:55503` with the
admitted deploy/runtime roles and `YELLOW_REQUIRE_ORDER440_DURABILITY=1`:

```text
bun test tests/fiscal-submission-durability.integration.test.ts
17 passed, 0 failed, 190 expectations, 77.54s
bun test tests/fiscal-submission-worker.test.ts tests/fiscal-submission-state.test.ts tests/india-irp-issued-wire-candidate.test.ts
40 passed, 0 failed, 207 expectations, 411ms
bun run typecheck
tsc --noEmit passed
```

The durable integration covered the four late-outbox rollback paths, real
history pruning, both audited seal schedules, and 100 concurrent claims. A
schema-only dump was captured before cleanup. The durable draft added one
table and one policy to the 77-migration baseline (`128` public tables / `118`
policies versus the baseline `127` / `117`); it is not represented by a
`schema_migration` row. The clone was dropped with `WITH (FORCE)` and a final
activity query reported zero sessions for both the clone and the production
template.

The separately seeded fresh clone's protected referee invocation was **not**
accepted as a full proof: `tests/referee-typed-parent-fixtures.integration.test.ts`
returned `8 passed, 3 failed of 11`. The three failures were TC-12.1,
TC-12.3, and TC-12.5 (zero occupancy winners/claims/throughput), plus the
typed-parent observer's temporary table lacked runtime INSERT privilege during
the P2 forced-exclusion path (`42501`). This is a proof-environment/fixture
boundary, not evidence that the durable functions passed the referee. No
catalogue promotion, migration-row insertion, canonical schema update, or
Tier-3 approval is claimed; the draft remains outside the migration runner.

Canonical referee correction: on a new v9 clone, the frozen draft was applied
inside one transaction, then the exact `tests/seed_fixture.sql` was loaded and
`py -3.13 tests/run_invariants.py order130` was run with the deploy DSN and
UTF-8 output. It returned `RESULT: 11 passed, 0 failed of 11` (TC-12.1/12.3
occupancy races, TC-12.4 direct INSERT denial, TC-12.5 throughput, journal,
seal, numbering, and both RLS checks). The earlier 8/11 result was the
historical `referee-typed-parent-fixtures.integration.test.ts` observer test,
which creates invoker triggers and is not the canonical CI referee command;
that earlier failure remains recorded but is not a durable-foundation defect.
The v9 catalogue was `77` migration rows, `128` public tables, and `118`
policies. Its normalized schema-only dump was byte-identical to the prior v8
draft dump (raw pg_dump wrapper tokens differ); comparison with the historical
`tests/schema/expected.sql` necessarily diverges at the draft function section.

Static worker inspection found repository `ok:false` envelopes are checked
before worker success/reconcile results are returned; no public ordinary
transaction wrapper currently calls these draft functions. This does not
constitute application-writer integration proof.

## Q199 disposition

The private durable foundation is approved for development publication and for
subsequent canonical-migration admission, limited to the draft repository,
worker, and SQL contract. This is not approval of Order 440 as a whole,
provider activation, runtime/database deployment, or Phase 7 completion.

The remaining implementation finding is explicit: any future ordinary
transaction command wrapper must inspect a failed repository `Result` and
abort before its enclosing commit. No such public wrapper exists in this
candidate, so this is a required integration condition rather than a failure
of the privately tested worker.

Frozen SHA-256 hashes for the five private foundation artifacts:

```text
handoff/drafts/order440/0078-fiscal-submission-durability.sql
  65323A81A999A11E3D55893411C994C0B841AF9B0465CA7E80630FD78D0FFAE6
src/contexts/tax-fiscal/fiscal-submission-repository.ts
  2839062C0BAC75339AC52158BADA74AA8BFCBDB71BDF8E71C5EAAD20ED305E2F
src/contexts/tax-fiscal/fiscal-submission-worker.ts
  67F96C18029C2B8C74D2E6AE1A126AD2B35561348F5C03B8383C1BE1651D4470
tests/fiscal-submission-durability.integration.test.ts
  A83DA64C55EEA0BCAD0609E8094BCB8F69BB2305DD9A3DDC58B11A1710C91886
tests/fiscal-submission-worker.test.ts
  8B852BC39EC95298E3FA3BC8F69918EA8A17943DFAE359DAAC2994CEC5BE7D49
```

The canonical `tests/schema/expected.sql` remains unchanged at the 77-migration
baseline; no migration admission or catalogue promotion is claimed here.

## Q201 canonical integration — implementation proof, 2026-09-06

The preceding Q199 statements are historical. Q201 promotes the frozen draft
byte-exactly to canonical78 (SHA65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6)
and adds application request/retry commands. No HTTP/provider activation or
retained local migration is included.

Root personally executed on two new55503 synthetic clones:

```text
bun test tests/fiscal-submission-durability.integration.test.ts
19 pass, 0 fail, 223 assertions, 93.33s
bun test tests/india-irp-issued-wire-candidate.integration.test.ts
4 pass, 0 fail, 230 assertions, 16.33s
focused command/worker/state/wire/setup/release/readiness units
56 pass, 0 fail, 353 assertions
bun test
1624 pass, 1227 explicit database skips, 0 fail
21975 assertions / 2851 tests / 492 files / 171.40s
```

Both root clones were dropped; the pristine77 template and merged-main preview
were untouched. Typecheck,175-file import boundaries,23-package licence policy,
dependency audit and diff checks pass.

The first full run had1621pass/1223skip/2fail/1error: unchanged browser geometry
and status-report timeouts. Status passed isolated4/4. A separate geometry run
reproduced Windows EBUSY reading DevToolsActivePort. The scoped harness repair
retries only EBUSY/ENOENT within the existing loop and propagates other errors;
its deterministic regression and all unchanged geometry cases pass5/5(51).
The existing30-second timeout was not increased and no UI code or assertion was
removed. The complete rerun above is the accepted standing result.

Non-implementer `/root/fiscal_integration_map` inspected the commands and
personally passed their7tests/57assertions. Its independent readiness inspection
found a real gap: a named but wrong/permissive tenant policy could report ready.
Root repaired exact policy count/name/command/roles/predicates, PUBLIC denial and
exact function configuration, adding restoration-based database negatives.
Independent execution of the repaired readiness is still pending at this checkpoint.

Non-implementer `/root/fiscal_command_integration` independently verified unchanged
1–77 bytes, exact canonical78, all78 actual ledger hashes,78/128/118/118/27/13/2
catalogue, byte-equal normalized schema and same-backend77→78 migration on another
new clone. It personally executed the canonical referee11/11 and static
catalogue/readiness/release9/9(89). This does not review its own command code.

The mapper's first full fresh migration run was42pass/1fail: both Q201 upgrade/
equivalence cases and all historical434 cases passed, but the existing auth
metadata check lacked28P01 under a private `postgresql://` test URL. Normalizing
that disposable environment to project-standard `postgres://` made the exact
auth test pass1/1 without runner/test weakening; a full rerun is underway.
No whole-Q201, exact-head CI, main/local promotion, Order440 or Phase7 completion
is claimed until those remaining integration receipts are recorded.

### Final native checkpoint in this turn

Mapper BUILDER rerun of the full migration suite passes43/43,257assertions,
282.27s with project-standard PostgreSQL URL scheme. This is not an independent
review of its own migration-test implementation.

Independent repaired-readiness execution printed all12 named cases as pass twice,
then the Bun1.3.14 Windows process exited abnormally. Changing pool shutdown from
timeout0 to bounded graceful timeout5 did not cure it:75 rejection,77 rejection
and78 acceptance passed, then a silent exit before the remaining cases. No clean
readiness-suite result is claimed. Stop repeated crash retries and retain the
runtime defect as open; Linux CI has not yet supplied a target-runtime result.

The distinct migration/catalogue/CI reviewer personally confirms exact78 schema/
ledger, direct positive runtime readiness, referee11/11, static9/9(89), types and
175-file boundaries. No remaining source finding was raised in that assigned
review. Each reviewer excludes its own implemented lane from approval.

Root stopped the verified temporary PostgreSQL process10400 on loopback55513;
the existing preview10856 on3000 and retained PostgreSQL14964 on55503 remain.
Three exact D: proof directories remain after policy-blocked recursive cleanup,
including two aborted initialization attempts; no alternative deletion was tried.

### Exact Linux CI checkpoint — 2026-09-06

Root retrieved completed job101420142538 logs from
[CI34008495909](https://github.com/dcpnode-maker/yellow/actions/runs/34008495909),
exact827be46703d85e87def0615f71e9c5bd4d485e75. All five jobs pass. Required
database stages personally inspected: migrations43/43(257), seed10/10(63),
native six suites116/116, current issued-wire4/4(230), canonical durability
19/19(223), containment/readiness15/15(59), released compatibility89/89,
acceptance24/24(69), and canonical referee11/11. The twelve repaired readiness
cases individually pass and the process exits cleanly; subsequent compatibility,
acceptance, app/login and cleanup stages run successfully.

This is exact Linux CI evidence, not a new claim that an agent personally ran
another agent's local tests. Preserve the distinct non-implementer reviews above.
The Windows native Bun crash remains unresolved: source inspection suggests a
lazy pool activation/finalization edge, but does not prove a cause. No crash retry,
runtime upgrade or local restart was performed. Canonical integration's target-
runtime CI condition is met; provider/HTTP/worker activation and whole Order440
or Phase7 completion are not.

### Independent Linux readiness follow-through and Q203 CI boundary

Non-implementer `/root/fiscal_integration_map` personally dispatched exactc1dfaacc
CI34009685141 and retrieved database job101423353803. All12 repaired readiness
cases passed within15/15(59) and the Linux Bun1.3.14 process exited cleanly;
canonical referee11/11 also passed. All five original jobs succeeded. That run's
separate ARM64 wheel-lock failure was repaired under Q202 without changing the
readiness implementation. This supplies the earlier independent target-runtime
follow-through; it does not repair or reclassify Windows Bun crashes.

The same agent independently inspected root's Q203 CI addition only: its new
database is a separate canonical78 native-template clone, registered for cleanup
before creation, with distinct deploy/runtime URLs and mandatory HTTP proof flag.
It personally ran the permanent CI contract1/1(12), parsed valid YAML with six
jobs, and compared the unchanged ARM64 job with HEAD. No CI finding or widened
runtime authority. This bounded CI review does not approve the concurrent HTTP
implementation or substitute for personally executed real-database HTTP review.

### Q203 independent HTTP acceptance — 2026-09-06

Fresh non-implementer `/root/fiscal_http_acceptance` inspected the complete new
identity directory, both operator handlers, application/server composition,
fixture, database proof, required CI clone and the coordinator's two legacy
constructor-expectation updates. It made no implementation edits.

Personally executed on existing isolated `yellow_order440_q203_90601`/55503:

```text
bun test tests/fiscal-submission-adapter-availability.test.ts \
  tests/operator-fiscal-submission.intentional-red.test.ts \
  tests/operator-fiscal-submission.integration.test.ts
13 pass, 0 fail, 125 assertions, 12.58s
bun test tests/operator-business-day-seal.integration.test.ts \
  tests/operator-reservation-travel.integration.test.ts
11 pass, 0 fail, 75 assertions, 310ms
```

All five genuine signed-session PostgreSQL cases executed; the remaining eight
checks cover directory/input/target/transaction/CI behavior. Read-only postproof
census confirms78migrations, zero residual injected constraints and zero other
proof-database sessions. Integration-test SHA256 remains491c86a7b9bc5b317c2b369803bb7ce8726c3fdc1a90c0ddb9c703a0e40278f1;
canonical78 remains65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6.

No blocking finding: middleware owns the sole tenant transaction, failed Results
and malformed/mismatched receipts throw before commit, and errors are sanitized
after rollback. Exact receipt bindings and current database permissions survive
replay. Actual other-tenant resources preserve both tenants' delivery/financial
snapshots. Production adapters are empty and no new role grants/transport exist.
The commit-failure case is a connection double; late-outbox rollback is genuine
PostgreSQL. The two legacy tests retain every prior constructor argument/assertion.

Root separately completes full standing1635pass/1234explicit DBskips/0fail
(22058assertions,496files,101.53s), types,176-file boundaries and23-package
licences. The interrupted pre-reboot rerun has no result and is not counted.
The earlier1633pass/2fail run exposed stale constructor strings, now permanently
corrected and independently exercised above. Local bounded approval is conditional
on combined exact-head CI; no live provider, sandbox registration, worker activation,
merge, deployment, whole Order440 or Phase7 completion is claimed.


## Q203 exact-source CI acceptance

Non-implementing reviewer `/root/fiscal_http_acceptance` personally dispatched
and inspected [CI34017067690](https://github.com/dcpnode-maker/yellow/actions/runs/34017067690)
at cb9a87ff5e94b47a9172f7e0f919c4df0e6f2ef5; root separately retrieved its status
and database log. All six jobs passed. Database job 101442779655 records required
HTTP proof 9/9 (89 assertions, 11.74 s), including each of the five genuine
signed-session PostgreSQL cases and isolated database cleanup. Durable submission
19/19, migrations 43/43, containment/readiness 15/15, deployment 24/24 and canonical
referee 11/11 passed. ARM64 job 101442779664 verifies the same revision at frontier78.

This discharges the exact-head CI condition on the bounded Q203 acceptance.
It does not merge the branch, activate a provider or complete Order440/Phase7.
The later Q200 resume-helper source is not covered by this earlier commit's CI.

## PR87 independent integration review — blocking replay finding

Reviewer: `/root/fiscal_http_acceptance`, non-implementer and not the PR-authoring
agent. Date: 2026-09-06. Immutable candidate:
`b5ef70842b658183f7b5b4c650c8e78c7a0b513d..cb9a87ff5e94b47a9172f7e0f919c4df0e6f2ef5`.
The complete 71-file candidate, retained Order440/442/443 acceptance, frozen SQL,
schema and worker identities, canonical CI, native supervisor and recovery scope
were inspected. Earlier bounded acceptance above is superseded by the blocking
finding below; green existing suites do not establish late-replay correctness.

### Personally executed supplemental candidate proof

```text
pwsh -NoProfile -File tests/run-native-review-bounded.test.ps1
PASS: 21 assertions, 9.30s
bun test tests/fiscal-submission-commands.test.ts tests/fiscal-submission-worker.test.ts \
  tests/runtime-storage-containment.test.ts tests/free-host-arm64.test.ts \
  tests/release-workflow.test.ts tests/setup-current-catalogue-oracle.test.ts
31 pass, 0 fail, 261 assertions, 201ms
```

The supervisor proof owns only synthetic PowerShell children and four newly named
GUID fixtures under `D:/Yellow/temp`; these are retained. It starts no application,
database, WSL or Docker service, fills no disk, and does not exercise the known
crashing Windows Bun readiness suite. No review source edits preceded these runs.

### P2: old request/retry keys return a later attempt's mutable head

[Automated discussion3943264423](https://github.com/dcpnode-maker/yellow/pull/87#discussion_r3943264423)
first identified the missing case. The independent reviewer checked the claim
against source and personally reproduced it with genuine signed HTTP and native
PostgreSQL, rather than accepting the automated description as proof.

`migrations/0078_fiscal_submission_durability.sql` lines708,723 and816 return
`india_fiscal_submission_receipt(v_head,true)` on matching historical request/retry
keys. They load the current mutable head, not the operation's immutable history
snapshot. `docs/CONTRACTS.md` lines47–48 require exact successful JSON replay;
D-443/D-444 specifically reject replacing a stored HTTP creation representation
with a later/replayed representation. Q199 contains no current-head exception.
The existing permanent tests check immediate replay, identity or the replay flag,
but do not replay an old operation after subsequent attempts have advanced.

Executed command: native Bun1.3.14 `bun -e $q203Proof`, with the JavaScript supplied
as a PowerShell in-memory here-string. Exit0,3.22s. No harness file was created or
retained; the full invocation/output is retained in this review agent's tool
transcript. The harness method is reproducible from these exact existing helpers:

1. In-process, load only `YELLOW_DEPLOY_DATABASE_URL` from
   `D:/Yellow/runtime/order442-review/seed.env` and `YELLOW_RUNTIME_DATABASE_URL`
   from `app.env`; require hostname127.0.0.1 and port55503, replace only pathname
   with `/yellow_order440_q203_90601`, and verify current database plus frontier78.
   Neither credentials, URL values nor tokens were printed.
2. Create one new synthetic scenario using
   `createFiscalSubmissionHttpScenario(deploy,database)` from
   `tests/fixtures/order440-fiscal-submission-http.ts`; compose
   `fiscalSubmissionHttpApp`, `Hs256TokenSigner` and `fiscalToken` exactly as in the
   permanent HTTP suite. Use a fresh UUID-suffixed request key and two distinct
   UUID-suffixed retry keys. Every HTTP operation must return201.
3. Request through `app.handle(fiscalRequest(...))`; retain the original receipt.
   In separate direct runtime transactions, set local tenant, call
   `claim_india_fiscal_submission(tenant,submission,60)`, commit its claim, then
   reconcile its exact tenant/provider/document/wire/attempt/token binding with
   normalized `transport_result/known_not_sent`. This is synthetic transport
   evidence, not an external provider call.
4. Retry through `app.handle(fiscalRetryRequest(...))` with the first retry key;
   retain that receipt. Repeat the genuine claim/known-not-sent reconciliation
   and submit the second retry key. Finally replay the original request key and
   the first retry key using their original HTTP selectors.
5. Compare opaque attempt identities and report only attempt number, retry count,
   status, transition sequence and replay flag; close all three connection pools.

Observed results (all statuses pending):

| Operation | Attempt | Retry count | Transition | Replayed |
|---|---:|---:|---:|---|
| Original request | 1 | 0 | 1 | false |
| First retry | 2 | 1 | 4 | false |
| Second retry | 3 | 2 | 7 | false |
| Original request-key replay | 3 | 2 | 7 | true |
| First retry-key replay | 3 | 2 | 7 | true |

Both old-key responses changed attempt UUID. This conclusively demonstrates the
original request and first retry misattributing a later attempt as their response.
The existing HTTP test also deliberately changes body `replayed` on immediate
replay; the repair must reconcile that representation with D-443/D-444 rather than
merely adding a status-only assertion.

Only the existing named Q203 disposable database received synthetic fixture and
delivery writes. No migration, clone, seed command, role provisioning, production
DB, pristine77 template, provider call or unrelated cluster was touched. SQL78
remained SHA256
`65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6`.
Concurrent uncommitted Q204 provider/worker/repository changes were excluded from
the immutable candidate review. The reproduction's HTTP `FiscalSubmissionService`
request/retry implementation is unchanged by that repository diff; claim/reconcile
were direct SQL, not the uncommitted worker. Thus the defect is in candidate78.

### Disposition

WITHHOLD PR87 merge and complete Q203/integration approval. Root accepted the finding
and will admit a forward-only repair without changing applied78. Require permanent
late-request and late-retry replay tests, unchanged canonical HTTP body/replay-header
behavior, fresh independent genuine proof, and new exact-head CI before approval.
Do not resolve the automated thread or bypass the conversation-resolution gate on
the strength of the old green run. No PR merge, comment-resolution or implementation
edit was performed by this reviewer.

Existing manually dispatched exact-candidate CI34017067690 passed all six jobs as
recorded above. PR-triggered CI34018171495 is still being observed without duplicate
dispatch/restart/cancellation: five jobs plus all CodeQL checks passed; database is
in progress after successful migration and seed suites. Its eventual green result
cannot close this independently reproduced test-coverage gap.

Final observation: PR CI34018171495 completed SUCCESS, all six jobs, with database
job101445870506 completing in15m54s. All four displayed CodeQL checks also passed.
Reviewer personally retrieved the completed database log: required Q2039/0(89;
12.22s), all five signed-session cases, explicit Q203 database drop and subsequent
absence, durability19/0(223;64.78s), containment/readiness15/0(59), deployment24/0(69),
canonical referee11/11 and runtime/cleanup job steps passed. PR remains OPEN,
MERGEABLE but BLOCKED by unresolved conversation; its exact head/base are unchanged.
The P2 and WITHHOLD disposition remain in force. No merge was performed.

## Q205 independent forward-repair acceptance — 2026-09-06

Reviewer `/root/fiscal_http_acceptance` remains independent of all repair product
and test implementation. It read the complete Q205 admission, migration79, expanded
permanent test and fixture, and the exact operator response delta, using the
PostgreSQL patterns skill. Review edits are append-only in this admitted record.
Q204's concurrent runtime/provider/health changes are explicitly excluded.

### Source inspection

The new owner-private `india_fiscal_submission_history_receipt` projects the exact
recorded submission/provider/document/attempt/state/transition fields from the
append-only command history row. It neither reads the live head nor reconstructs
financial evidence. It is owner-owned, invoker-mode, STRICT, fixed-search-path and
non-executable by PUBLIC/app_role/yellow_runtime. Existing request/retry signatures,
SECURITY DEFINER owner, authority checks, semantic request hashes, locks, first
effects and runtime claim/reconcile remain unchanged.

An independently executed in-memory Bun comparison extracted both complete function
bodies from78 and79, normalized only CREATE OR REPLACE, and proved byte equality
after exactly two request and one retry replay-return substitutions. Migration79
contains no data update/backfill or new table. Applied1–78 have no tracked diff
against cb9a87f, and each stored ledger hash matched its canonical file after upgrade.
The HTTP body's existing `replayed` field is always false; the original service
receipt metadata still controls `Idempotency-Replayed`. The prior Q203 immediate
replay oracle now compares the entire canonical body rather than expecting drift.

### Personally executed genuine upgrade and permanent proof

The reviewer verified exact `yellow_order434_production` on127.0.0.1:55503 contained
77 migrations,127 public tables,zero tenants and zero other sessions, with owner
yellow_deploy; every stored1–77 hash matched canonical bytes. After confirming the
target did not exist, it created only `yellow_order440_q205_review_90601` from that
pristine template through the existing deploy principal. No roles were provisioned.

PowerShell New-Item/Copy-Item mechanically copied the exact78 canonical migration
files into new `D:/Yellow/temp/q205-review-5581619b128544f9ad1fdbe2932a902a`.
`runMigrations({databaseUrl,migrationsDirectory:prefix,logger:()=>{}})` discovered78
and applied only `0078_fiscal_submission_durability.sql` to the new reviewer DB.
Neither the source template nor a retained hotel/review database was migrated.

Native Bun1.3.14 then personally executed:

```text
YELLOW_REQUIRE_ORDER440_REPLAY=1
YELLOW_ORDER440_REPLAY_APPLY_UPGRADE=1
bun test tests/fiscal-submission-immutable-replay.integration.test.ts
target: yellow_order440_q205_review_90601
5 pass, 0 fail, 447 assertions, 13.72s

YELLOW_REQUIRE_ORDER440_REPLAY=1
YELLOW_ORDER440_REPLAY_APPLY_UPGRADE=0
bun test tests/fiscal-submission-immutable-replay.integration.test.ts
target: existing yellow_order440_q205_90601 at79
5 pass, 0 fail, 451 assertions, 13.81s
```

Each child had command-scoped `YELLOW_ORDER440_REPLAY_DEPLOY_DATABASE_URL` and
`YELLOW_ORDER440_REPLAY_RUNTIME_DATABASE_URL`, loaded privately in-process from
the existing protected seed/app env files. Host and port were required to be
127.0.0.1:55503 and only the pathname was replaced. No credential, URL value or
bearer token was printed. The initial pre-freeze already79 run5/0(285;14.25s) is
retained as provisional history, not a substitute for these frozen expanded runs.

The actual upgrade branch creates and commits an original request and first retry
under78, captures complete sorted JSON rows for fiscal_submission, history, fact,
outbox, document, series, journal and posting_line, applies only79 with the canonical
runner, and proves all eight snapshots unchanged. Those pre79 operation keys then
retain their original status201 and exact HTTP bytes after later attempts and
terminal acceptance. A second genuine family proves terminal rejection.

The expanded permanent proof retains the original request and all three explicit
retry keys, reaches attempt4/retry3, and performs five concurrent repetitions per
retained key at the relevant pending/in-flight/terminal stages. It checks exact
body bytes,201 status,replay-only header,no-store and unchanged eight-table state.
Immediate replay, revoked current request/retry permission, changed document
identity, genuine other-tenant authority and owner-private helper metadata pass.

Additional personally executed SQL invoked the history helper with a non-null
synthetic composite value under direct yellow_runtime and SET LOCAL ROLE app_role;
both denied with SQLSTATE42501. An initial NULL argument probe was uninformative
because STRICT NULL folding avoids invoking the function; that harness assertion
was corrected to a non-null composite, not counted as a product failure or proof.
Final reviewer DB census:79 exact matching ledger hashes,128 public tables,zero
other sessions. Pristine template recheck:77 migrations,127 tables,zero tenants,
zero other sessions. All pools closed; new reviewer DB and prefix are retained for
coordinator-managed bounded follow-on proof. No cleanup, restart or live activation.

Frozen accepted source hashes (SHA256):

```text
0078_fiscal_submission_durability.sql
65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6
0079_fiscal_immutable_command_receipts.sql
b233821d0b683810542f91834458e98f657996268d81bc81398f6c15f86ca52f
fiscal-submission-immutable-replay.integration.test.ts
46eaef35e3f63db6da4f265dbe891d672ad62ad1538d55ec3deb77c00656031e
order440-fiscal-immutable-replay.ts
54ff7192b03c5180fa748ffd48bc1b38a5e634bb31af5ecd6b8d5d8c9145be23
```

### Narrow disposition

The reproduced P2 is repaired in this frozen Q205 local source, with independently
executed real78→79 and all-key late-replay evidence. No new blocking finding in the
bounded repair. This is not approval of excluded Q204 work or a merge authorization
for old cb9a87f: combined current-frontier/schema/full repository gates and fresh
exact-source CI must complete, followed by final PR head/base/check review. The old
PR87 remains unmerged and its discussion is not resolved by this local record alone.

## Q205 independent current79 referee, schema and gate review

Reviewer `/root/fiscal_http_acceptance`, 2026-09-06, independently completed the
coordinator-requested current-frontier proof before repaired PR publication. This
does not reuse the older77/78 referee result. PostgreSQL patterns were re-read and
the canonical seed/referee path was checked against setup.sh before execution.

Only new `yellow_order440_q205_referee_90601` was created, using existing
yellow_deploy authority after target-absence and exact pristine-template checks:
`yellow_order434_production` on127.0.0.1:55503,77 migrations,127 public tables,zero
tenants,zero sessions. The canonical runner discovered79 and applied exactly78
and79. No role, cluster, application, retained review database or template changed.

Native PostgreSQL16.15 `pg_dump --schema-only --no-owner --no-comments` against the
new target was captured in memory. The repository's `normalizeSchemaDump(...,true)`
removed only its validated random wrapper pair and normalized line endings. The
result exactly equals `tests/schema/expected.sql`:1,616,718 UTF-8 bytes, SHA256
`fc3b1af4c6f9d929acd8f58d4907f56fcda6bc926f3ef896daa7de0dc5bbda63`.
No expected-schema edits or normalization weakening were performed by the reviewer.

Then executed the normal unwrapped seed and canonical referee (native paths, with
password/YELLOW_DSN supplied only through child-scoped environment):

```text
E:/yellow/toolchains/postgresql-16.15/pgsql/bin/psql.exe \
  --host 127.0.0.1 --port 55503 --username yellow_deploy \
  --dbname yellow_order440_q205_referee_90601 --no-password --no-psqlrc \
  --set ON_ERROR_STOP=1 --file tests/seed_fixture.sql
canonical seed succeeded

C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe \
  tests/run_invariants.py yellow_order440_q205_referee_90601
RESULT: 11 passed, 0 failed of 11
```

Actual results: exclusive50-thread race1 winner; private/bed claims never coexist;
40-thread capacity race exactly6; direct app INSERT42501;162 committed throughput
claims in0.57s; unbalanced commit denied,balanced commit accepted; sealed-day posting
denied;100 fiscal numbers gapless1–100;118/118 tenant-table RLS/policies and both
security-invoker views enforce real tenant isolation. No Order130 observer wrapper,
fixture mutation, Docker/WSL invocation or copied implementer output was used.
The synthetic referee database is retained; no material resource was deleted.

### Current-frontier and required-CI inspection/proof

The reviewer inspected the Q205 CI block and its surrounding fail-fast cleanup
trap, the new pure workflow test, current79 build/launcher/setup/release constants,
database catalogue/hash addition and fresh-current proof checks. The exact historical
77→78 migration/durability tests now use a mechanically copied prefix78 rather than
accidentally consuming79. The added79 migration suite preserves rollback, ledger,
no-op, checksum-drift and fresh-versus-upgrade assertions. No applied SQL or historical
hash was rewritten. These are admitted Q205 frontier/proof changes, not Q204 runtime.

The new CI target is registered for cleanup before creation, starts from exact78,
passes distinct deploy/runtime URLs plus both REQUIRE and APPLY_UPGRADE flags, and
runs the whole immutable replay test without filtering or error suppression. It
executes actual pre79 receipts and forward migration inside the permanent test,
then removes its own proof DB. Existing six CI jobs, ARM64 native execution and
release source/revision gates are unchanged except for current79 expectations.

Personally executed:

```text
bun test tests/fiscal-replay-workflow.test.ts tests/build-readiness.test.ts \
  tests/free-host-arm64.test.ts tests/release-workflow.test.ts \
  tests/setup-current-catalogue-oracle.test.ts tests/schema-drift.test.ts
17 pass, 0 fail, 156 assertions, 401ms
```

These readiness tests are pure HTTP/probe tests, not the known crashing Windows
database-readiness suite. Both workflow files additionally parse as valid YAML
with Bun.YAML: CI6 jobs,release1 job. Focused diff-check passes. CI SHA256
`f85f1539bc213f57a401e1c19f8cbe1c460d828161808f1a8f49d51a0ab0bb98`;
new workflow-test SHA256
`bc54650948a166567e9d2790fd131aba2b85b0892ef4a7d159fe863834db583b`.

No additional blocking finding in these gates. Current79 canonical referee/schema
conditions are personally discharged. Full repaired-candidate standing gates,
fresh exact-source CI and final independent PR head/base/conversation/check review
remain required before merge. This reviewer made only this appended review record;
no push, merge, PR-thread resolution, provider call or activation occurred.

## Published b6ecada integration observation — CI withheld

Independent reviewer `/root/fiscal_http_acceptance` verified PR87 head and remote
branch exactly `b6ecada300762342d0b299a86c7efc1fac65838b`, base/main exactly
`b5ef70842b658183f7b5b4c650c8e78c7a0b513d`. It inspected the published39-file delta,
confirmed Q204 production is excluded, and compared immutable git-object SHA256s
for78,79,schema,replay test/fixture and CI against the accepted hashes above; all
match. The added Q204 admission is prospective work, not activated runtime code.

The new Q200 resume helper and all307 test lines were independently read, together
with the retained non-implementing root review and actual-resume evidence. Reviewer
personally ran the exact published helper/test source:

```text
bun test tests/native-review-resume.test.ts
7 pass, 0 fail, 19 assertions, 6.62s
```

Only synthetic AST/function/fixture checks executed. The reviewer did not launch
the real helper, change the stable local preview, or touch its process/database.
No additional implementation finding in that bounded recovery slice.

Automatic pull-request CI34020729817 was observed without any dispatch, restart
or cancellation. Five jobs passed:local-review,windows-state,quality,container-smoke
and free-host-arm64. Database job101452922367 FAILED during the migration suite:
44 pass,1 fail,264 assertions,109.39s. Both new Q205 tests (exact rollback/upgrade/
no-op/checksum and fresh79-versus-upgraded78 schema equivalence) passed. The failed
case is `stages historical lineage then applies correction, repair and all India
fiscal evidence exactly once`: its current full-runner appliedFiles expectation
ends at78, while actual correctly adds `0079_fiscal_immutable_command_receipts.sql`.
Its subsequent upgraded-ledger length and no-op discoveredFiles expectations also
remain78 and must be updated to79. Preserve its exact predecessor44 ledger and
no-op assertions; do not bypass current-source coverage by pinning that case to78.
The required downstream Q205 HTTP/replay stage did not execute in this failed run.

All normal CodeQL checks passed. The separate dynamic GitHub Advanced Security
run34020730334 failed before analysis with Copilot entitlement403, `You are not
licensed to use Copilot`; it is not a code finding or a displayed required PR check.
No entitlement, repository protection, paid service or bypass was changed.

Disposition: KEEP PR87 UNMERGED. The original P2 discussion remains unresolved
pending a repaired published candidate and complete exact-source gates. Root owns
the scoped three-point migration-test frontier correction. The passing local Q205
repair proof is retained but cannot substitute for the failed full CI run. No PR
comment-resolution, merge, push or production edit was performed by this reviewer.
