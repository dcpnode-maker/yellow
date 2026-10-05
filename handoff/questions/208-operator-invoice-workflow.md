# Question 208 — Operator invoice review, issuance, delivery and print

**Status:** Accepted technical direction under Order440. Production implementation
starts after the PR91 repair is published as a frozen candidate; it must not be
included accidentally in that candidate's proofs or release. The detailed SQL
contract and exact new proof targets must be appended before DDL execution.
**Date:** 2026-09-07. **Decider:** Codex, under the founder's implementation directive.
Independent nonimplementer-executed financial/tenant proof remains mandatory.

## ADR-440-208

### Full-suite integration oracle repair — 2026-09-07

Publication index check found five trailing spaces in the byte-pinned upstream
Nayuki QR library (lines52,640,644,790,816); the earlier tracked-only diff check
did not cover this then-untracked artifact. After nonimplementing reviewer
inspection, admit `.gitattributes` only for the exact vendored path's
`whitespace=-blank-at-eol` attribute, plus the existing invoice-print test's
attribute assertion. Preserve upstream bytes, export-only adaptation, both
pinned hashes, every other path/whitespace check and the full MIT notice. This
is a documented vendor-format exception, not a production algorithm, licence,
canonical SQL or test-assertion weakening. Rerun the staged check before publication.

Follow-up: the full run after the browser synchronization repair records
1832 passes / 1310 explicit skips / 1 failure at the provider configuration
exact-byte credential ceiling (line271). Independent focused 26 runs do not
reproduce it; no cause is asserted. A separate 100-manifest probe tested the other
boundary, not the failed credential branch, and does not exclude crypto/config
causes. Admit only
`tests/india-irp-provider-configuration.test.ts` to add the existing sanitized
error code and bound/delta to assertion diagnostics. No raw paths, credentials,
file contents, retries, sleeps, relaxed bounds or secure-loader changes. Preserve
the failed full-run receipt until a fresh whole-suite run passes.

The first complete current-source run records 1829 passes, 1310 explicit
environment skips and four failures. Three old navigation/icon assertions still
count the pre-invoice shell; one fiscal composition assertion still expects the
old one-argument availability constructor. Admit these exact test paths only:

```text
tests/operator-adaptive-experience.test.ts
tests/operator-flagship-motion.test.ts
tests/operator-management-demo-navigation-finetune.intentional-red.test.ts
tests/server-fiscal-runtime.test.ts
```

Update exact structural expectations for the added invoice navigation and the
validated provider-presentation argument. Preserve all accessibility, existing
route, authority, pre-pool validation, privacy and default-off assertions. Do not
skip tests, loosen matching to arbitrary counts, change production behavior, or
use this repair to implement the separate Astra redesign. The founder's latest
UI direction is contextual workflow, not the obsolete expertise selector; that
replacement is a separate integration, not silently asserted as already done.

### Context

Yellow already issues a real native India accommodation invoice through one
accounting/numbering transaction and preserves authenticated provider receipts.
Staff cannot yet discover those invoices, select the legal buyer in context, issue
from a folio, return after a reload, or print the immutable invoice with its signed
QR. A receipt endpoint requiring a previously known submission UUID is not that
workflow. The newer staff-workbench direction replaces global Simple/Advanced/
Expert with contextual disclosure; PR86 contains reusable appearance mechanics
but retains obsolete depth-mode behavior and must not be merged wholesale.

Constraints: one existing Bun/TypeScript/PostgreSQL monolith, current authentication,
property scope, exact integer money, immutable financial evidence, existing command
transactions, no new infrastructure, and the stable local77 left untouched until a
separate verified promotion. Main80, PR91 candidate81 and this next work are distinct.

### Decision

Implement a single Finance/Invoices workflow with a desktop queue and selected
document, and a focused phone detail view whose Back restores queue and focus.
Enter from the finance workspace or a specific reservation/folio window. Use the
existing document, series, native origin/timing, valuation and fiscal submission
primitives. No new invoice table, balance, event queue or parallel tax engine.

Read-only list/detail/print receives a new least-privilege
`tax-fiscal.documents:read` permission, registered but assigned to no role by the
migration. It does not imply issue, submission, retry or configuration authority.
Issue retains both existing `tax-fiscal.documents:issue` and
`tax-fiscal.india-valuation:finalize` permissions. Existing receipt, request and
retry permissions remain separately enforced by HTTP and PostgreSQL. No seed role
is silently promoted. Synthetic acceptance fixtures grant only explicitly named
permissions to their own test roles.

### Options considered

| Option | Complexity | Cost | Scalability | Team familiarity |
|---|---|---|---|---|
| Compose existing domain services and owner-mediated reads | Medium | Existing runtime; no new service | Bounded tenant-leading queries and cursor pagination | Existing Yellow patterns |
| Reimplement invoice/tax state in the browser | High ongoing | Duplicate maintenance | Divergent state and extra synchronization | Conflicts with repository invariants |
| Separate invoicing service or external rendering platform | High integration | New hosting/vendor/data transfer | Separate operational and failure boundaries | New stack and authority surface |

The first preserves one source of truth and shared screen/voice/integration
commands. It requires genuine discovery and authorization work, rather than a raw
UUID form. The other options duplicate fiscal authority or add infrastructure
without evidence of need. These are technical trade-offs, not performance claims.

## Staff journey and contracts

1. **Find:** paginated property-scoped invoice queue, linked reservation and folio
   window, legal number, issue date, buyer and amount. Search terms containing guest
   data stay out of URLs and persistent browser storage. Filters and counts have
   the same scope. An unsupported jurisdiction is not a fabricated empty result.
2. **Review:** use session tenant/actor, exact route property/reservation/folio and
   server-persisted evidence. The operator explicitly selects the recipient GST
   registration, even when only one candidate exists; no account, guest, room,
   window-name or first-row inference. Show legal name/GSTIN/place and evidence
   dates, not an unexplained list of internal IDs.
3. **Confirm and issue:** discovery and the confirmed native issuer run in the same
   governed transaction, with one retained command identity. PostgreSQL must compare
   the displayed confirmation after all existing source/day/series locks and before
   the first write; comparing before the issuer acquires its locks is insufficient.
   Never issue from browser-calculated
   tax, cached readiness or an advisory token. Number allocation, accounting, origin,
   fact, outbox and immutable command replay remain the existing domain's job.
4. **Read back:** load the exact issued document and its immutable source. Reload or
   direct navigation can rediscover document-to-submission identity through an
   authorized read, without broad sensitive-column SELECT or an active adapter.
5. **Deliver:** separately request configured provider registration and distinguish
   queued/unknown/known-not-sent/rejected/provider-cancelled/accepted/legacy-hash-only
   outcomes. Retry uses the existing eligible command and original identity rules.
   No live provider or paid service is configured by this implementation.
6. **Print:** use the issued content and exact retained signed QR, not today's
   mutable guest/configuration data. Sandbox, not-registered, rejected and cancelled
   states remain prominent. Do not call a pending registration a registered invoice,
   and do not imply that every B2C/non-IRP document globally requires an IRN.

The first complete live slice uses the currently implemented native India
accommodation path. Other fiscal modes, governed calendar intake, correction
documents and all remaining Phase7 requirements remain in the plan; they are not
waived by this slice or a successful print demonstration.

## Server discovery and authority

Browser input is the explicit recipient registration and, only where required,
separately governed calendar evidence. Internal selectors are not user fields.
Derive the sole current successor-free native consideration valuation for the
exact folio/account/window/reservation. Its recorded service snapshot determines
the unique payment and ordinary-regime roots. Use the actual service-date history,
property registration/location/classification and exact time-of-supply dated
supplier/recipient status graph. Do not choose `LIMIT 1`, highest version or latest
timestamp when more than one root satisfies a required identity.

Reuse owner-private readers from canonical77: `read_india_native_issue_authority`,
`read_india_native_intake_source`, `read_india_native_valuation_evidence`,
`read_india_native_rate_history_day`, `read_india_native_invoice_timing_source`,
`read_india_native_statutory_root_graph` and `compose_india_native_quoted_tax_source`.
Readiness must not call the writing `prepare_india_native_fiscal_invoice_v2`, even
inside a rollback, to pretend it is a read. Issue still calls the actual issuer.
Any internal preview identities must be explicitly non-issued, never a legal number,
and cannot become readiness authority or enter persisted financial records.

Return a discriminated `issued | selection_required | ready | blocked` result.
Already consumed windows return a coherent issued document, not a generic error.
Partial/incoherent origin is blocked. Internal selectors stay in server composition;
public results contain only purpose-limited labels, evidence, actions and typed
blockers. The dependency order is scope/authority, consumed state, open folio,
valuation/lineage, buyer selection, supplier graph, timing/status/classification,
calendar, business day, and series. Missing governed working-day data is an explicit
`working_day_calendar_required`, never inferred weekends or holidays.

The discovery audit also found a possible D1314 issue-date supplier-status gap:
canonical77's document context checks the base registration and its statutory graph
checks time-of-supply status. Independently trace all reachable preparation/commit
checks and execute an intentional counterexample before calling this a confirmed
defect. If confirmed, forward82 must enforce the existing active-at-issue policy
without rewriting74/77, changing D99 lock order, or invalidating completed replay.
This is enforcement of an existing decision, not a new fiscal policy.

## QR rendering and presentation

Use a pinned, locally served copy of Project Nayuki's MIT QR encoder rather than a
remote QR service or a new algorithm. Primary references checked2026-09-07:
[author's library](https://www.nayuki.io/page/qr-code-generator-library) and
[v1.8.0 source](https://github.com/nayuki/QR-Code-generator/tree/v1.8.0), whose tag
resolves to commit720f62bddb7226106071d4728c292cb1df519ceb. The published ES6 artifact
is45,336 bytes. Record the retrieved artifact hash and retain its full licence
before vendoring; no transitive runtime package or network call is needed.

Encode the exact signed compact token. Preserve black-on-white modules and a quiet
zone, use accessible text alongside the image, and test independent decoding back
to the original token. Detect the encoder's real capacity before expensive work;
oversized payloads produce an explicit print blocker, never truncation or a fake QR.
Print has its own fixed stylesheet independent of theme/skin, with no app chrome,
decorative assets, animation or hidden legal fields. Screen effects must not alter
data, action identity, permissions or focused input.

## Exact implementation scope and ownership

Root coordinates all overlapping composition and release files. Assign each file
to one builder before production edits. No new files outside this list without an
explicit amendment:

- migrations/0082_india_native_fiscal_operator_workflow.sql
- migrations/0083_india_native_fiscal_operator_calendar_bounds.sql
- migrations/0084_india_native_fiscal_operator_query_execution.sql
- migrations/0085_india_native_fiscal_operator_command.sql
- src/contexts/tax-fiscal/india-native-fiscal-operator.ts
- src/contexts/tax-fiscal/india-native-fiscal-document-read.ts
- src/contexts/tax-fiscal/india-native-fiscal-invoice.ts
- src/contexts/tax-fiscal/fiscal-submission-adapter-availability.ts
- src/contexts/tax-fiscal/index.ts
- src/commands/issue-india-native-fiscal-invoice.ts
- src/http/operator.ts, src/app.ts, src/server.ts, src/kernel/build-info.ts
- src/http/operator/index.html, src/http/operator/operator.js,
  src/http/operator/operator.css, src/http/operator/invoices.js,
  src/http/operator/invoice-print.js
- src/http/operator/vendor/qrcodegen-v1.8.0-es6.js
- src/http/operator/vendor/QR-CODE-NOTICE.md
- tests/india-native-fiscal-operator.test.ts
- tests/india-native-fiscal-confirmed-issue.test.ts
- tests/india-native-fiscal-operator.integration.test.ts
- tests/operator-invoices.integration.test.ts
- tests/operator-invoices.browser.test.ts
- tests/operator-invoice-print.test.ts
- tests/fixtures/order440-operator-invoices.ts
- tests/india-native-fiscal-source-completion.integration.test.ts
- tests/fixtures/india-native-fiscal-source-completion-fixture.ts
- tests/fixtures/india-native-fiscal-persisted-source-factory.ts
- tests/schema/expected.sql, tests/database-acceptance.integration.test.ts,
  tests/migrate.integration.test.ts, tests/build-readiness.test.ts,
  tests/build-readiness.integration.test.ts, tests/runtime-database-authority.integration.test.ts
- tests/setup-current-catalogue-oracle.test.ts, tests/release-workflow.test.ts,
  tests/free-host-arm64.test.ts
- .github/workflows/ci.yml, .github/workflows/release.yml, setup.sh, setup.ps1
- docs/CONTRACTS.md, docs/SCHEMA-GUIDE.md, docs/UI-SPEC.md, docs/DESIGN.md,
  docs/design/UIUX-DIRECTION.md, docs/design/STAFF-WORKBENCH-SPEC.md,
  docs/PROJECT-STATUS.md, BUILD-PLAN.md, handoff/PHASE-7-PLAN.md,
  handoff/ROADMAP.md, src/project-status.ts, tests/project-status.test.ts,
  tests/founder-status.integration.test.ts,
  tests/current-management-demo-status.intentional-red.test.ts
- handoff/orders/440-fiscal-submission-lifecycle.md,
  handoff/questions/208-operator-invoice-workflow.md,
  handoff/reviews/440-operator-invoice-workflow.md, handoff/LEDGER.md, DECISIONS.log

### Forward83 correction admission

The builder committed82 on its admitted synthetic target at hash
`702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185` before discovering
initial contract defects: absent calendar incorrectly blocks the canonical ordinary
single-version branch, and the SQL search limit allows240 rather than120 Unicode
scalar values. The actual82 interface run then returns1pass/4fail and exposes two
additional SQL runtime defects: unqualified table-return variables collide with list
CTE columns (42702), and PostgreSQL16 has no min(uuid) aggregate (42883) in discovery
and by-document receipt. Preserve82 and its ledger; do not rewrite an applied file.
Admit forward `0083_india_native_fiscal_operator_calendar_bounds.sql`, owned by
`native_resume_builder`, solely to correct those functions with existing canonical
timing behavior, the frozen query bound, explicitly qualified list columns and
PostgreSQL16-supported deterministic UUID aggregation after uniqueness validation.
Never turn an ambiguity into first-row selection. Existing Q208 tests/fixtures prove
these defects before repair. This is implementation repair, not a changed legal policy.
The builder subsequently executes an authentic D1314 counterexample and positive
control: fresh v2 issues on a new synthetic property civil date without an active
supplier-status row for that date. Admit83 enforcement of the existing policy across
all affected fresh native preparation entrypoints, including v2 and v3, preserving
their signatures and completed replay. A v3-only fix leaves a bypass and is insufficient.
Acquire the sorted/distinct time-of-supply and issue-date status rows within the
existing statutory-source stage, before business-day/series/document-context locks;
do not introduce a backward stage acquisition. Independent locking inspection and
personal counterexample/replay proof are mandatory before acceptance.
First run source/shape checks and transactional rollback syntax/contract probes;
then apply83 to the same owned synthetic build target and run actual integration.
No local/main migration or phase-completion claim is implied.

### Forward84 execution correction admission

Actual post83 execution (2 passes,4 failures) found two still-lazy SQL errors:
the discovery's original schema-qualified COALESCE raises42883, and the list's
UNION-level ordering raises0A000. Preserve applied82 and83 exactly. Admit
`0084_india_native_fiscal_operator_query_execution.sql`, owned by the same SQL
builder, only to replace that special-syntax qualification and wrap the union in
an explicitly aliased outer ordered query. No authorization, filter, cardinality,
money, confirmation, lock or replay semantics may change. First execute every
affected capability against genuine synthetic rows inside the same rollback-only
transaction as the candidate DDL; merely creating a PL/pgSQL function does not
parse all its statement branches. Independently inspect the exact source, then
coordinate committed application on the same admitted build target. No new target,
local migration or applied-file rewrite is authorized by this correction.

Independent actual rollback84 proof then confirmed two authority/bounds gaps and
one unsupported-property ambiguity: an actor linked only to another tenant's role
passed all four new read/provider checks; NULL fetch limit passed instead of22023;
an authorized AED property produced a successful empty list. Extend the still
unapplied84 to enforce the canonical same-tenant role join in all four capabilities,
explicit non-NULL fetch-limit guard, and an explicit unsupported-property outcome
after current authorization. Reuse the existing property/jurisdiction predicate,
not a currency-only inference of India. Use SQLSTATE P2082 for unsupported fiscal
mode; TypeScript maps this own driver field to unsupported_jurisdiction and HTTP422.
No wider role assignment or table/column grant is admitted. Preserve the actual
positive controls and add permanent hostile role, NULL, unsupported and revoked
permission cases before committed application.

Two consecutive actual discovery calls then returned ready with equal selectors
but unequal confirmation hashes, without a source write. The entire quoted-tax
composition bound preview-generated nativeTiming/prospective document identities and
their derivative hashes, contrary to this ADR's explicit exclusion. Extend still
unapplied84 to correct the owner-private confirmation composer only. Preserve the
six existing composition members and their types: keep the three stable component
family/levy canonical strings and full taxPreview; deterministically serialize the
stable quote and final-tax projections into their existing canonical-string fields.
The quote keeps kind, rateSelection, reservationLineage, components and predecessor
attributionSnapshot, levyComponentIdentity, ordinaryRegimeRecording,
paymentReceiptProjection, paymentReceiptRecording, reservationLineage,
serviceProvisionProjection and serviceProvisionRecording. The final tax keeps kind,
valuationId, generation, rateSelectionKind, roomNights, taxMinor, grandTotalMinor and
those stable predecessors plus finalValuation and nativeConsiderationBasis.
Omit quote evidenceHash/nativeTiming and predecessor nativeInvoiceSource/nativeTiming/
rateSource; omit final-tax evidenceHash/nativeTimingId and predecessor
nativeInvoiceSource/nativeTiming/quotedRateApplicability/rateSource. Stable timing is
already separately bound by confirmation.timing. Correct the configuration content
hash member to the actual taxPreview.selectedContentHash rather than a missing key.
No public/native issuance source is weakened or rewritten; this comparison projection
is not the document's immutable source basis. Require repeated discovery stability,
genuine positive confirmed issuance, changed buyer/configuration/money/timing/stable
source rejection after locks with zero writes, and completed replay preservation.
Source fields with missing or unexpected structure must fail closed, not disappear
from the confirmation. Independent exact-field inspection and actual proof remain.

Actual ready output also proves buyer=NULL:82 selects a nonexistent buyerDetails
member although the authenticated prepared-source contract calls it
recipientRegistration. Admit that exact composer mapping correction in84; require
the explicit selected registration to match the purpose-limited buyer's identity and
legal fields. Repeated-ready/issue proof must compare the actual buyer legal name,
GSTIN and address/place details that staff see, and a changed buyer must reject the
old confirmation before writes. Missing buyer data is an error, not an empty review.

Actual immutable genesis invoice read also showed previousHash is legitimately
NULL. The detail DTO is corrected to string|null, preserving the original NULL;
never synthesize a predecessor hash. Existing document hash/source validation still
applies. Real Bun PostgreSQL errors expose errno42501 with code
ERR_POSTGRES_SERVER_ERROR; inspect own code/errno/sqlState descriptors without
executing accessors and map current permission denial correctly.

### Public staff command and durable replay composition

The public staff command must work after consumption and after the short-lived API
idempotency row expires. Existing native timing plus immutable quoted applicability
already retain its exact selectors and calendar identity; do not add another store.
Admit forward85, owned by native_resume_builder, without modifying frozen84. Add
prepare_india_native_fiscal_invoice_v4(tenant uuid, property uuid, actor uuid,
reservation uuid, folio uuid, recipient uuid, calendar_authority text,
calendar_source_hash text, calendar_through date, calendar_dates date[],
calendar_states text[], idempotency_key text, request_id uuid,
expected_selector_hash text, expected_confirmation_hash text). Return the existing
five preparation columns plus internal_selectors jsonb, available only to server
composition. Fixed search_path, explicit yellow_owner ownership, current role and
both issue permissions, app-only EXECUTE and no broad SELECT grants are mandatory.

Authenticate first. For a completed durable native command matching the tenant/key
hash, bind actor/property/reservation/folio/explicit recipient, recover its ten exact
selectors from immutable timing/applicability, and call existing v3 with the CALLER'S
calendar and hashes. Never replace a changed caller calendar with the stored one.
The v3 original request identity and current authority remain mandatory. A different
key on an already-consumed window is conflict, not replay. For a fresh key, compose
read-only discovery with v3 in the caller transaction; only ready may proceed. V3
still compares confirmation after its locks and before its first write. Serialize
concurrent same-key discovery/composition using the existing command financial-lock
discipline; a wait must re-read completed identity before selecting current roots.
No expected hash is an authorization token. No financial computation is duplicated.

Forward85 also replaces only discovery and provider-options jurisdiction preflight:
after exact current actor/property authorization, reuse84's property-jurisdiction
predicate and raise P2082 when unsupported. No currency-only inference, data-dependent
empty success or pre-authorization jurisdiction disclosure. Missing document detail
and by-document receipts retain their existing scoped NULL/not-found semantics.

Provider_transport_builder owns the existing invoice service/command and confirmed
unit test for the new public-input entrypoint. Snapshot exact session route,
recipient/calendar, both hashes, idempotency and audit before awaiting. Validate the
returned internal selectors and reconstruct the existing native input only inside
the service; share its unchanged completion/accounting/source-binding implementation.
Root owns context exports, operator read service, HTTP, UI and other tests.
Root takes final presentation-only ownership of invoice-print.js and its existing
unit test after the frozen print lane. Repair the independently measured46mm QR
column clipping, preserve exact signed bytes and50mm print dimensions, and show an
explicit full-size-print instruction instead of a clipped/unscannable QR on narrow
screen previews. The phone workbench retains its compact summary and real print
action. Independently execute visible-geometry and decode proof after repair.

Public POST routes are /api/v1/properties/:property/reservations/:reservation/folios/
:folio/invoice-readiness and the corresponding /invoice-issue. Readiness body is
exactly recipientRegistrationId (UUID or null) and calendarEvidence (existing exact
calendar contract or null). Issue body adds expectedSelectorHash and
expectedConfirmationHash and requires a selected recipient. Header Idempotency-Key
is mandatory; actor, tenant and audit request identity come from the signed session
and server request context. Both routes require current documents:issue and
india-valuation:finalize scopes AND current property grants. No URL query parameters,
client selectors, monetary amounts or authority fields are accepted.

Readiness public envelope is {readiness: value}. Selection value retains exactly
kind and recipients; each candidate has recipientRegistrationId, legalName, gstin,
stateCode. At most500 candidates are returned; exceeding this bound is an explicit
recipient_selection_too_broad blocker, never an incomplete successful selection.
Issued has kind and documentId. Blocked has kind and a fixed server code. Ready has
kind, selectorHash, evidenceHash and confirmation with exactly buyer, seller,
placeOfSupplyStateCode, issueDate, timeOfSupplyDate, serviceProvisionDate,
paymentReceiptDate, seriesPrefix, financialYearStart, currency, taxableMinor,
taxMinor, totalMinor, configuration and roomNights. Buyer/seller contain legalName,
gstin, stateCode, addressLine, locality and postalCode; buyer also contains the
explicit recipientRegistrationId. Configuration contains extensionId, version and
contentHash. Each room night contains ordinal, businessDate, taxableMinor, taxMinor,
aggregateRateBasisPoints and the exact configured components from persistenceRoomNights.
Validate shape, dates, money strings, source binding and configuration before
projecting; no internal selector graph, raw intake or mutable guest data is returned.
Issue returns {invoice: existing immutable command receipt}; created is201, replay200.
Stale displayed evidence is409, permission403, unsupported jurisdiction422; failures
roll back the middleware transaction and expose no database/source details.

The subsequent provider_transport_builder browser lane owns only invoices.js and
its existing browser test. Extend the existing controller with showIssue({reservationId,
folioId}) and optional constructor returnToFolio(folioId) callback. Root handles
the exact deep route /p/:property/invoices/new/:reservation/:folio and the current
folio's explicit Review invoice entry. Use the frozen readiness/issue routes above.
Explicit recipient selection precedes authoritative confirmation; amounts and dates
are server values. A deliberate confirmation control issues, never opening the view.
Keep one retry key for the same confirmation on ambiguous failures; disable competing
submission and ignore late results after property/view/logout changes. Already-issued
readiness opens its exact document. Typed blockers, back/focus and honest permissions
remain actionable; no calendar guesses or silent recipient selection. Governing a new
working-day calendar remains separate product work, not an ad hoc JSON form.

Permanent proof must cover same-key concurrent fresh requests, completed retry after
API-row expiry, changed route/actor/recipient/calendar/key, changed source after
display, zero-write readiness, all-scope/current-property denial and exact response
minimization. One rollback transaction cannot prove committed replay: perform that
case in separate transactions only after independent committed-application approval.

## Consequences and action items

### Canonical85 release integration and delegated ownership — 2026-09-07

The read-only integration audit identifies current-release oracles still pinned to81.
Admit these additional exact paths solely for current85 release verification:
`scripts/local-review.sh`, `tests/fiscal-replay-workflow.test.ts`,
`tests/native-fiscal-release-containment.integration.test.ts`,
`tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts`,
`tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts`.
Historical77/78/79/80/81 suites and their exact-prefix proofs stay historical; they
must not be relabelled or weakened to pass head85. No retained local startup or
credentials change is admitted. Applied82–85 remain byte-for-byte immutable.

Bounded ownership for this integration replaces the earlier builder assignments
only for the following files; builders do not edit one another's paths:

- native_resume_builder: database-acceptance and migrate integration tests,
  setup.sh/setup.ps1, setup-current-catalogue oracle, expected.sql, and the three
  current containment/quoted-rate/final-component compatibility tests above.
  Write exact current catalogue and81-to85 proofs, preserving historical coverage.
  No PostgreSQL execution until the coordinator releases the heavy-test lane.
- provider_transport_builder: src/kernel/build-info.ts, both build-readiness tests,
  runtime-database-authority integration test, scripts/local-review.sh,
  release-workflow/free-host-arm64/fiscal-replay-workflow tests, and CI/release YAML.
  Require current85 capabilities, private-helper isolation, exact fixed function
  configuration and indexes. Keep historical CI targets pinned to their actual
  prefixes and add a distinct required current85 Q208 proof; no provider activation.
- fiscal_http_acceptance: independent personally executed strengthened replay proof
  and clean schema/referee proof, with evidence only in the existing Q208 review.
  Do not implement the source or acceptance assertions being reviewed.
- Root: provider-choice/HTTP/UI composition, remaining contracts/tests and governance.

Separately admit new-only proof databases `yellow_order440_q208_fresh85_20260907`
and `yellow_order440_q208_upgrade85_20260907` on the existing55503 cluster. Before
creation require exact absence, source-hash inventory, protected pristine77/template
and global-role fingerprints, and no competing heavy proof. The fresh target is
empty and runs canonical1–85 only after verifying the runner cannot change existing
global-role authority. The upgrade target starts from pristine77 and applies exact
78–81 before the separately tested81-to85 upgrade. If this cannot preserve global
roles, stop target creation and report the concrete conflict; no role workaround.
No existing target may be reset or dropped. Only synthetic seed/fixtures are used.
Mechanically generate normalized schema from actual current85; never synthesize a
schema snapshot from concatenated migrations. Fresh unassigned-permission, retained
historical ledgers, rollback/drift/no-op, schema equivalence and genuine11/11 referee
remain distinct executable checks. Close owned handles and serialize heavy work.

### Configured-provider presentation contract — 2026-09-07

Root additionally owns `src/contexts/tax-fiscal/india-irp-provider-configuration.ts`
and `tests/india-irp-provider-configuration.test.ts` for one secret-free metadata
projection from the same successfully validated protected configuration snapshot.
Admit `tests/operator-fiscal-submission.integration.test.ts` solely to update its
synthetic successful configuration fixture to this added presentation contract;
preserve every prior command, replay, authority and no-activation assertion.
Also admit `tests/operator-fiscal-submission.intentional-red.test.ts` for the same
exact two-argument availability-constructor wiring assertion; keep its existing
default-off, single-snapshot, pre-pool validation and no-secret environment checks.
Successful loader results add immutable `presentations` with exact provider key,
extension UUID/version and sandbox/production environment. Credentials, URLs, trust
material and functions remain private. Existing worker registration shapes and
transport behavior do not change. Default-off returns two empty arrays.

The identity availability service accepts this optional second array, validates
exact identity matching and at most16 entries, and exposes only frozen presentation
records. Existing identity-only request/retry callers remain compatible; omitted
presentation never guesses an environment or exposes a selectable provider.
GET `/api/v1/properties/:property/fiscal-provider-options` requires request scope
and current property authority, no query parameters. It reads the existing SQL
provider-options capability in the same tenant transaction, restricts rows to the
configured UUID set, validates exact identity/version/key and returns
`{providers:[{providerExtensionId,providerExtensionVersion,providerKey,label,environment}]}`.
Even with no configured providers, SQL authorization and unsupported-jurisdiction
checks execute; absence is not an authority bypass. No credentials/configuration
are accepted from staff or returned. This read sends nothing to a provider.

The invoice UI loads these choices only after an explicit registration intent and
an authorized not-requested receipt. Staff explicitly select even one provider and
confirm sandbox versus production before the existing fiscal-submissions command.
Keep a single key through ambiguous response failures, suppress late completions
on navigation/logout, and refresh the authorized by-document receipt after success.
An unknown outcome is not permission to create another submission or choose another
provider. Existing terminal/lookup/legacy outcomes never expose a blind retry.
Reload-safe exact provider binding for retry-only users remains separately required;
this request composition does not falsely claim that missing piece complete.

After freezing its nine-file catalogue lane, native_resume_builder takes only
`src/http/operator/invoices.js` and `tests/operator-invoices.browser.test.ts` for
the configured-provider request UI above. Root retains all HTTP/domain/config/CSS.
Reuse scoped controls and show environment confirmation without a new design system
or dependency. Permanent rendered browser proof covers no request on open, explicit
one-option selection, same-key ambiguous replay, receipt refresh, default-off,
permission denial and late-result suppression. Update the stale static prohibition
on provider IDs to enforce no secrets, no configuration and no automatic request.

### Synthetic85 application and current proof boundary — D1409

Forward84 is applied on the admitted build target at exact SHA256
e9d8b75f832e687f567806e82faaece7672cdbcf4ee8813c9c7b56cfc78ecd69 after
independent actual rollback proof. Forward85 is applied there at exact SHA256
c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c. The
independent reviewer personally checked84 ledger/source hashes, both dynamic-replace
predecessor bodies, absence of v4, ownership/ACL/configuration, zero other sessions,
unchanged pristine77 template and global-role fingerprint before authorizing this
synthetic-only application. This admission permits separate committed transactions
to prove replay and concurrency; it is not functional, merge or local-release approval.
Applied82–85 and their ledgers are immutable. Heavy database proof remains serialized.

Builder functional proof passes9/9, including real public DTO readiness, concurrent
same-key winner/waiter, original receipt after short-lived API idempotency removal,
changed actor/route/recipient/calendar/key denial and zero fiscal-artifact delta.
The fresh-target no-auto-grant oracle is not claimed on this retained test database,
which now has explicitly granted fixture roles. Independent personal functional
proof and a canonical new-only schema/seed/referee target remain required.

The public readiness mapper originally rejected genuine Bun SQL array metadata.
Root preserves intentional19pass/2fail before its narrow detached numeric-row repair
and malformed UTF16 guard;45 focused tests and independent57 hostile assertions pass.
Only the SQL result wrapper ignores metadata. Nested JSON arrays retain exact shape,
bounds and accessor/proxy denials. Root also moves the new command type import through
the existing context barrel; types,185 import boundaries and23 licence checks pass.

The UI controller and root main-shell wiring now cover explicit buyer/confirmation,
same-key ambiguous retry, typed blockers, exact issue deep links and property/logout
suppression. The main-shell proof substitutes synthetic HTTP responses; it cannot
establish real database issuance. Root owns semantic-token styling; the browser-test
builder may add real rendered geometry/screenshots in the same admitted test file.
No original founder preview, credentials, provider configuration or cloud host changes.

- [ ] Freeze the detailed public DTO, SQL capability signatures and ownership before
  implementation; separately name each new-only native proof target before use.
- [ ] Implement owner-mediated list/detail, discovery, same-transaction issue and
  reload-safe submission retrieval; preserve unassigned permissions and exact scopes.
- [ ] Implement the real contextual staff workflow and locally rendered signed QR.
- [ ] Independently execute actual two-tenant/current-role/read-revocation proof,
  one-effect retry/concurrency, full rollback census and unchanged historical replay.
- [ ] Prove readiness performs zero writes and issue-time source changes cannot use
  an old confirmation; test missing/ambiguous evidence without silent fallback.
- [ ] Execute authenticated desktop/phone flows, focus/back/draft/error states,
  print layout and independently decoded genuine synthetic signed QR.
- [ ] Run canonical migration/schema/referee11/11, compatibility, full standing,
  types/boundaries/licences and exact-source Linux/ARM64 CI before independent merge.

## Detailed implementation admission — D1408

PR91 repair978a2d66548fa7f4ab9684c9f7438c0b1e3b4631 is published and frozen.
Q208 develops on `phase-7/operator-invoice-workflow` in the same existing worktree.
It does not change PR91's tested tree, provider configuration or local77.

### Ownership

- `native_resume_builder`: forward82; the actual database Q208 integration test;
  `tests/fixtures/order440-operator-invoices.ts`; and the three listed native source
  fixture/integration files only where the D1314 executable counterexample needs
  them. No catalogue/CI/schema-oracle edits or commits until coordinated.
- `provider_transport_builder`: native invoice service and command confirmed-issue
  entrypoint; `tests/india-native-fiscal-confirmed-issue.test.ts`. Preserve the
  historical `issueNative` v2 path and share its accounting/commit implementation.
- Root: document-read/operator services, public DTOs, remaining tests, context exports,
  HTTP/runtime/UI, documentation, integration and release paths.
- Additional bounded print lane, `provider_transport_builder`: only
  `src/http/operator/invoice-print.js`, the two listed Nayuki vendor/notice files,
  and `tests/operator-invoice-print.test.ts`. Root owns all route, asset and main UI
  wiring. Use the existing validated document/receipt contracts, no new renderer
  service or mutable invoice facts. Independent QR decoding and rendered browser
  evidence remain separate gates; a generated matrix is not decoding proof.
- Subsequent bounded browser-workbench lane, provider_transport_builder: only
  src/http/operator/invoices.js and tests/operator-invoices.browser.test.ts.
  Root continues to own main HTML/CSS, route/authentication and asset integration.
  Implement the real authenticated queue/detail/receipt/print flow with the existing
  public read contracts, not fictional in-app data. Use exported
  createInvoiceWorkbench({root,request,propertyNode,timezone,navigate}) returning
  show(documentId|null), suspend() and dispose(). Keep PII filters in memory only;
  navigate receives only an opaque document UUID or null. Root handles main history
  and cross-workspace draft guards. The module uses scoped invoice-* classes and
  existing semantic tokens, bounds pagination, ignores late responses after route/
  property/logout changes, preserves Back focus, and distinguishes unavailable
  receipt access from not-requested registration. Import the existing print artifact
  lazily from /assets/operator-invoice-print.js only upon preview/print intent.
  No autonomous issue or provider request is implied by a read/print action.
- Independent `fiscal_http_acceptance`: no production implementation. Finish PR91
  exact-source integration, then personally execute Q208 high-risk proof on separately
  named new-only targets. A builder's output is never its approval.

### Confirmed preparation: preserve one financial engine

Forward82 adds `prepare_india_native_fiscal_invoice_v3` with the exact22 v2
arguments followed by `p_expected_selector_hash text` and
`p_expected_confirmation_hash text`. It returns the same five-column preparation
row. It preserves the existing ordered financial prefix, authority, configuration,
statutory and document-context locks, and existing accounting and commit path.
Completed replay checks the supplied selector against the original request hash and
current authority but does not compare historical confirmation to today's sources.
Fresh confirmation is checked immediately after the locked document context and
BEFORE `api_idempotency` INSERT (the first write) and BEFORE D99/outbox/numbering.
Mismatch raises SQLSTATE `P2081` with sanitized stale-evidence wording. No authority
is carried in a caller-controlled session setting. The old v2 capability remains
unchanged for historical command callers.

Two owner-private helpers are admitted:

```sql
read_india_native_document_context_candidate(
  p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid,
  p_actor uuid, p_supplier_registration uuid
) RETURNS jsonb;

compose_india_native_operator_confirmation_v1(
  p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid,
  p_recipient_registration uuid, p_selector_hash text,
  p_timing jsonb, p_valuation_evidence jsonb, p_prepared_source_json text,
  p_service_supply_nature_json text, p_quoted_tax_composition jsonb,
  p_document_context jsonb
) RETURNS jsonb;
```

The first is a read-only counterpart, not a call to a locking/writing prepare.
The second extracts already-computed values into one canonical confirmation-v1
projection and SHA256; it does not calculate tax. Discovery and locked preparation
use the same composer. Bind explicit buyer, seller/recipient/legal/place/classification
evidence, stable timing/calendar, valuation and recording-root hashes, selected
configuration/version/content hash, room-night/component money, issue date, open-day
assertion and series ID/supplier/year/prefix. Exclude generated preview UUIDs,
transaction ID/timestamp and derivative hashes containing them, series counter/tail
and prospective legal number. Staff see series/prefix; the legal number is assigned
on issue, never promised in advance. Source-basis construction consumes the same
post-lock artifacts rather than rereading unprotected source data.

### Owner-mediated read capabilities

Each capability validates current app-role tenant context and exact actor/property
authority in PostgreSQL, with explicit owner, fixed search_path and app-only execute;
private helpers are not granted. New document-read permission is unassigned.
Cross-tenant/property identity never comes from a browser-selected tenant or actor.

```sql
list_india_native_fiscal_documents(
  p_tenant uuid, p_property uuid, p_actor uuid,
  p_issued_from date, p_issued_before date, p_reservation uuid, p_folio uuid,
  p_query text, p_after_business_date date, p_after_issued_at timestamptz,
  p_after_document uuid, p_fetch_limit integer
) RETURNS TABLE(document_id uuid, business_date date, issued_at timestamptz,
                summary jsonb, matching_count bigint);
read_india_native_fiscal_document(
  p_tenant uuid, p_property uuid, p_document uuid, p_actor uuid
) RETURNS jsonb;
discover_india_native_fiscal_issue(
  p_tenant uuid, p_property uuid, p_actor uuid, p_reservation uuid, p_folio uuid,
  p_recipient uuid, p_calendar_authority text, p_calendar_source_hash text,
  p_calendar_through date, p_calendar_dates date[], p_calendar_states text[]
) RETURNS jsonb;
read_india_fiscal_submission_delivery_receipt_by_document(
  p_tenant uuid, p_property uuid, p_document uuid, p_actor uuid
) RETURNS jsonb;
list_india_fiscal_submission_provider_options(
  p_tenant uuid, p_property uuid, p_actor uuid
) RETURNS TABLE(extension_id uuid, extension_version integer, provider_key text,
                label text);
```

Queue bounds: required half-open property-local issue-date range, at most366days;
public page limit1..100, SQL fetch limit2..101 for one sentinel row; stable descending
`business_date, issued_at, document_id` keyset, never OFFSET. Cursor is version1,
property/filter-hash bound, with that last tuple. Filter hash includes the dates,
reservation, folio and normalized query; query is at most120 Unicode scalar values,
no control characters. Search uses a POST body, no PII in URL/storage/logs.
The coherent CTE derives rows and pre-cursor filtered count from the same authorized
native document graph. Missing jurisdiction support is explicit, not empty success.
An empty page returns exactly one metadata-only SQL row with all four document
columns NULL and the coherent pre-cursor count; this preserves totals after the last
cursor. Nonempty pages contain no metadata row. `issuedAt` is canonical UTC with
six fractional digits; preserve PostgreSQL microseconds through keyset serialization.
Root SELECT formats the typed timestamp and decimal-string count explicitly.
Use tenant-leading document/issue lookup indexes; no generic sensitive-column grant.

The SQL summary is exactly `{documentId, documentNumber, businessDate, issuedAt,
reservationId, folioId, recipientRegistrationId, buyerName, buyerGstin, currency,
taxableMinor, taxMinor, totalMinor}`. Money is nonnegative signed64-range integer
strings in INR, never JSON numbers. The permanent source supplies legal buyer and
amounts, not today's party profile. IDs, counts, order and document binding are
validated again by the TypeScript read boundary. The public list adds only
`items`, decimal-string `matchingCount` and `nextCursor`.

Detail is exactly `{kind:"india_native_invoice_v1", documentId, propertyNode,
reservationId, folioId, seriesId, documentNumber, businessDate, issuedAt,
recipientRegistrationId, sourceEvidenceHash, documentSha256, previousHash,
contentJson}`. The exact issued content text is authenticated against stored hash
and the existing issued-wire validator before it is returned. Printable seller,
buyer, lines and totals are derived from that validated immutable content, not
independently queried mutable records. Signed provider receipt remains separately
authorized; successful document-read does not confer receipt permission.

Readiness discriminates `issued | selection_required | ready | blocked`; only the
explicit recipient registration can select a buyer. Ready contains purpose-limited
confirmation data, selectorHash and evidenceHash; internal native selectors are
available only to the server command, never public JSON. Blockers are typed and
sanitized. Unique current valuation/intake/status roots are mandatory; ambiguous
roots block instead of selecting the first/latest. Missing governed calendar is
`working_day_calendar_required`. Confirmation carries hashes plus route selections,
calendar, idempotency key and audit envelope; the service validates a snapshot and
uses the confirmed SQL capability. Existing command retries preserve immutable replay.

By-document receipt is discriminated `not_requested | legacy_unsupported |
ambiguous | receipt`; exactly one durable submission projects the existing receipt,
not the newest attempt or an arbitrary row. Provider choices use the existing
effective/current India IRP1.1 predicate and intersect the server registry's exact
extension row UUID/version/key. Environment comes from protected provider configuration,
not an invented extension field. Explicit provider selection is required even for
one option; absent configuration never activates an adapter.

### New-only executable proof target admission

Only the existing native PostgreSQL16.15 cluster at127.0.0.1:55503 is used; no WSL,
Docker, new cluster, reset, retained-hotel mutation or local-preview promotion.
Admit `yellow_order440_q208_build_20260907`, created only after exact absence check,
as a clone of pristine `yellow_order434_production` (frontier77). Before and after, verify the
template catalogue/zero-tenant state and global-role fingerprints unchanged. Apply
the exact78–81 Git blobs from frozen978a2d6, checking migration hashes against the
recorded baseline, before any82 proof. Synthetic fixtures only. Once an82 migration
is successfully applied its ledger/hash is immutable; corrections require a newly
admitted target or a rolled-back uncommitted DDL transaction, never editing its ledger.
This target is builder evidence, not independent referee proof. Serialize heavy
local PostgreSQL suites with the independent reviewer; close owned sessions.

The D1314 issue-date-status suspicion is not yet a confirmed defect. First reproduce
it through actual native services and a positive control on this synthetic target;
do not delete immutable evidence or fabricate an issued document. Only a demonstrated
gap admits enforcement of the already-recorded policy, with existing lock order and
completed replay preserved.

PR91 base acceptance is separately admitted on the NEW-only target
`yellow_order440_q207_postmerge81_20260907`. Independent reviewer first checks exact
absence on55503 and the unchanged pristine77 template/global-role fingerprints,
then clones only `yellow_order434_production` (frontier77). Reconstruct the canonical86-input
proof bundle from merged3503b0c01f336637d2583963c17b792f6ad59efe Git objects; require
its treeaa5da9a0ae25f93355225ddfdf89fbef4209b07e equal frozen978a. Apply exact78–81,
verify canonical81 schema, run actual canonical seed and all11 referee invariants,
and compare protected template/role/source fingerprints afterward. No working-tree82
input is eligible. Reviewer owns this target, gets the next local heavy-proof slot
and must release it explicitly to the Q208 builder. Existing databases stay untouched.
Results belong in existing `handoff/reviews/440-fiscal-provider-and-receipts.md`;
root integrates those postmerge notes separately from the frozen PR91 candidate.

No mock-only screen, static screenshot, test count or merged helper establishes
the full operator outcome, provider certification or Phase7 completion. Preserve
failed evidence and the separately verified local app throughout.
