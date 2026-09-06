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
