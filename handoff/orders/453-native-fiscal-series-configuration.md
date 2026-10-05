# Order453 — Authenticated native fiscal-series configuration

**Status: ACTIVE — functional implementation admitted, 2026-09-08.** The founder
requires functional build only. UI/UX stays paused. Root published Order452's
tested46-file tree as557dd0315945bb551a3409704d70ff1cf9d4c4a3 to existing draftPR92.
The completed publication receipt verifies all2106 previous tracked working files,
all outside staged entries and exact projected index semantics preserved. The
earlier new-file-only lane now expands ONLY to this order's enumerated typed/API
and governance scope. Independent native/release execution remains separately gated.
This is not permission to execute SQL, start a database, publish or promote an app.

**Native acceptance, 2026-09-08:** Root personally executed upgrade4/0 with1
canonical-only skip(34), final authority12/0(933) and signedHTTP5/0(376).
Final8ce8a4fa preserves every prior row and all protected databases/host state.
Exact draft67802156 is now canonical0090 source. The enumerated root-release scope
below is active for source implementation in parallel; actual canonical upgrade,
referee/readiness, standing, publication and live promotion remain separate gates.

**Canonical acceptance, 2026-09-08:** Root now executed populated89→90/no-op,
clean77→90/no-op, identical normalized schemas f96a2876, unchanged11/11 referee,
and50 actual runtime-readiness fault denials/restorations. Full original series
pg_proc/OID is preserved after every series case; final whole-state equals
b94f0e78. Complete release/standing and publication remain open. Existing paused
UI/staging and the older live app remain untouched.

## Outcome and authority

Complete the already approved Q187/D1302 and Order430 fiscal-series setup with an
authenticated command/API. Reuse the existing fiscal-series capability and repair
its active-tenant/tenant-coherent role validation before exposing it. A genuinely
new series atomically records its configuration fact and outbox event. Repeating
the same series/prefix preserves its existing counter and emits nothing.

This is configuration, not issuance, debit-note valuation/accounting, tax changes,
provider activation, cancellation, prefix editing or Phase7 completion. No new
economic policy is inferred. There is no UI work or new dependency/server.

## SQL and durable event contract

Forward0090 replaces only
`create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid)`, preserving its
six named parameters and nine-column table result. Canonical0089 and unchanged
predecessor definitions must be exact migration preconditions; never edit0074/0087.
Keep yellow_owner SECURITY DEFINER/VOLATILE ownership, owner/app_role EXECUTE
only without grant option, fixed pg_catalog,public,pg_temp search_path and no
PUBLIC/direct runtime/table privilege expansion.

Before absence or replay, reuse unchanged private0087 authority assertion with
the exact `tax-fiscal.series:configure` permission and p_lock=true. Maintain
governed runtime identity/context; active tenant and actor; tenant-coherent roles
and ancestor property grant. Lock authority before dated supplier evidence and
the existing series advisory/row lock. Retain property-local transaction date/FY,
supported document kinds, exact prefix rules and currently active dated supplier
registration. Preserve different-prefix23505, including unused series.

For a new configuration insert exactly one series(next_no=1), one fact_log row
and one outbox row in the same transaction. Fact entity_type=document_series,
fact_type=configured; event=document.series.configured, event_version=1,
aggregate_type=document_series and aggregate_id=new series UUID. Both payloads:

```text
{seriesId,propertyNode,supplierRegistrationId,documentKind,prefix,financialYearStart}
```

All payload values come from the persisted row. No GSTIN/guest/Party data, money,
document content, invoice number, tax, credentials or provider claim. Authenticated
tenant/property/actor, transaction-stable property-local business_date and fact
valid_from=transaction_timestamp are server-owned. Generate one event correlation
UUID with pg_catalog.gen_random_uuid; causation_id=NULL. Existing six arguments
do not carry AuditEnvelope.requestId: do not claim request correlation persistence
or durable request-key idempotency. No overload or fabricated historical backfill.
Same-prefix replay returns current next_no/created=false and changes nothing.

Publication-order clarification: join the established global publication advisory
lock6441674055002974568 last, before the new immutable writes. Like0087, reject a
transaction already holding this publication lock with55000 before taking source/
authority locks, preventing inverse lock order. First perform current nonlocking
authority verification, then the prior-lock guard, then locked authority. This
preserves the unauthorized42501 boundary. The six-argument signature is compatible,
but one state-changing command must own a fresh transaction; configure+issue or
multiple configurations after an earlier publication in the same transaction are
not silently promised. Test actual caller compatibility; do not rewrite old
fixtures or relax lock guards without explicit root scope.

## Typed command and HTTP contract

ConfigureIndiaNativeFiscalSeriesCommand.execute/executeInTransaction delegates
through the public tax-fiscal context and tenant Tx. POST
`/api/v1/properties/:property/fiscal-series` accepts exactly
`{supplierRegistrationId,documentKind,prefix}`, no query or client identity/FY/
counter/date/hash/series selector. Signed scope plus current property grant must
contain tax-fiscal.series:configure; SQL reauthorizes. Construct the existing
server audit-operation envelope without claiming its requestId was persisted.

Return {series: existingResult},201 new/200 replay, no-store;400 invalid,403 denied,
409 conflicting prefix,503 unavailable/corrupt with sanitized errors. No invented
idempotency header. Harden ONLY series input/result decoding: snapshot own data
before await, reject getters/proxies/extra keys, exactly one driver row, exact
bound UUID/kind/prefix, real April1 FY, boolean created, lossless positive int64
nextNo. Reuse existing helpers; leave invoice/credit issuance and math unchanged.

## Scope and parallel ownership

SQL/new-file lane admitted now:

- handoff/drafts/order453/0090_india_native_fiscal_series_configuration.sql
- tests/india-native-fiscal-series-authority.integration.test.ts
- tests/india-native-fiscal-series-upgrade.integration.test.ts
- tests/fixtures/india-native-fiscal-series-fixture.ts

New pure test lane admitted now:

- tests/india-native-fiscal-series-command.test.ts

The following edits are admitted after root's452 publication preservation above:

- src/contexts/tax-fiscal/india-native-fiscal-invoice.ts (series only)
- src/contexts/tax-fiscal/index.ts (narrow exports if needed)
- src/commands/configure-india-native-fiscal-series.ts
- src/http/operator.ts and src/app.ts (one API only)
- tests/operator-native-fiscal-series.integration.test.ts
- tests/india-native-fiscal-invoice.test.ts (Q242: only malformed-series-result
  error import/expectation; genuine23505 and invoice behaviour remain unchanged)
- tests/build-readiness.integration.test.ts (Q242's immediate narrow published452
  canonical88 predecessor-connection lifecycle repair; no frontier change yet)
- docs/EVENTS.md, docs/CONTRACTS.md, docs/PROJECT-STATUS.md
- DECISIONS.log, handoff/LEDGER.md
- this order, handoff/reviews/453-native-fiscal-series-configuration.md
- handoff/questions/242-fiscal-series-native-target-admission.md

Root release scope, only after independently executed draft proof:

- migrations/0090_india_native_fiscal_series_configuration.sql (exact draft)
- src/kernel/build-info.ts
- tests/build-readiness.test.ts, tests/build-readiness.integration.test.ts
- tests/schema/expected.sql (generated from actual canonical90)
- tests/migrate.integration.test.ts, tests/database-acceptance.integration.test.ts
- tests/runtime-database-authority.integration.test.ts
- tests/security-definer-containment.integration.test.ts
- tests/setup-current-catalogue-oracle.test.ts
- tests/native-fiscal-release-containment.integration.test.ts
- tests/fiscal-retry-readiness.integration.test.ts
- tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
- tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
- .github/workflows/ci.yml, .github/workflows/release.yml
- scripts/local-review.sh, setup.sh, setup.ps1
- tests/free-host-arm64.test.ts, tests/release-workflow.test.ts
- tests/fiscal-replay-workflow.test.ts

Private planning/proof helpers only under .yellow/evidence/order453. Any other
path requires an explicit scoped amendment. No conflicting existing-file edits.

Q242 standing-diagnostic amendment: tests/india-irp-provider-configuration.test.ts
is additionally admitted ONLY to include the existing sanitized failure code in
the positive-control assertion message. The unchanged production loader and
acceptance assertion remain binding. This makes43 candidate paths; preserve the
old42path manifest/failed evidence. No retry, test skip or production relaxation.

## Required executable acceptance

1. Intentional pure red before implementation. Hostile input/getter/proxy/result
   cases fail closed with no unintended SQL calls. Old service compatibility stays.
2. Separate-login SQL and signed HTTP: create/replay; wrong property/supplier,
   missing/revoked permission/membership, inactive actor/tenant and foreign role
   deny creation AND replay. Verify authority revocation contention under real locks.
3. Concurrent equal requests converge to one series/fact/event and one created
   result. Differing prefix conflicts. Valid distinct property/supplier/kind/FY
   keys remain separate. Existing0047 permits only one registration per exact
   property/jurisdiction identity: prove same-tenant second-property/current-FY
   success, untouched prior-FY coexistence, and23505 exclusion of a same-property
   duplicate registration. Do not invent alternate jurisdiction evidence or change
   registration policy to manufacture an unsupported second-supplier success.
   Genuine previously issued series replay preserves advanced next_no.
4. Failure during fact/outbox and after publication rolls back the entire graph.
   No retroactive events on historic series. Exact three-row new effect; all prior
   rows/counters/documents/hashes/journals/tax/submissions/provider state preserved.
5. Independent agent that did not implement must personally execute native proof,
   production89→90/late rollback/no-op and clean/upgraded schema equality with
   unchanged11/11 referee. The order itself grants no database target authority.
6. Frontier90 readiness pins exact replaced function/body/metadata/ACL; old89 and
   drift fail closed, restored90 passes. Unchanged129tables/119RLS/119policies/
   28FORCE/2views/15clean permissions. Existing INV/CRN proofs stay required.

Keep452 current89 at explicit prefix<=89 and upgrade88 at<=88; preserve older
447/446 targets. Add dedicated453 current90/upgrade89 mandatory suites. Move only
full-current retry readiness to a separate90 target; never relabel historical
tests to accept89-or90. CI/full standing and safe selective publication are later
root gates. No main merge, live promotion, dependency copy or Docker/WSL execution.
