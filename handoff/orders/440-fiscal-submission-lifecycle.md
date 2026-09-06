# Order 440 — Durable fiscal submission and reconciliation

**Status:** ACTIVE — Q205/Q204 and private Q206 decoder/JWS are independently merged through PR87/88/89 with complete CI and fresh post-merge80 schema/referee11/11. Original-source invoice/QR binding is independently verified in development; full authenticated provider and signed-receipt integration remains current work.
Order434's exact candidate is accepted and merged; no provider is activated.
**Phase:** 7, planned sequence item6.
**Owner:** Codex coordinator; bounded internal builders, separate high-risk reviewer.
**Date:** 2026-09-06
**Base:** Accepted Order434 candidate92346674c784b552356934e168d60e4b9650497a,
merged through PR83 as443e3826b47025106d1829fcbb406ce6302fbbba.

## Outcome

Current checkpoint2026-09-07: PR89 exactd300 passes all six CI34053928779 jobs
and normal CodeQL, including actual ARM64 decoder/JWS25/25. Nonimplementer
fiscal_http_acceptance normally merges43fc758 and personally executes the separate
fresh post-merge80 exact schema/seed/referee11/11. Main80 and local77 stay separate.
Q206's new private invoice/QR binder passes root55/0(582) and112 adversarial
assertions; source/test hashes are recorded in its review. It is source-bound
signature evidence, not provider acceptance. Complete standing passes1719/0 with
1264 explicit environment skips and22813 assertions after independently proved
native batching/outsider-cwd and transient browser startup-read repairs. Both prior
failed full runs remain recorded. Types,180 boundaries and23 licences pass.
New candidate CI must actually run the binder on native ARM64 before integration.
The full provider/SQL/receipt/operator/sandbox outcome remains unfinished.

Historical D1399 runtime checkpoint:

Current D1399: exacte4399cf passes all-six CI34049699932 and normal CodeQL;
non-implementer fiscal_http_acceptance verifies actual full gates and merges PR88
as2a0ba41. Separate genuine post-merge80 schema and seed/referee11/11 pass.
Question206 admits private exact JSON and RS256 dependencies of the complete
authenticated provider/signed receipt/read-model outcome. It does not yet admit
the prospective81 migration. Main80 and stable local77 remain separate.

The following Q204 checkpoints retain historical failure/repair evidence.

Q204's latest harness checkpoint is D1397. Actual CI34046418901 proves the Linux
batch fixture and owned-child cleanup, but fails the first browser at the new8s
inner budget; later quality/database gates are skipped. The admitted correction
shares one55s/85s monotonic budget across all twelve cases inside unchanged60s/90s
test limits. Root's genuine browser/helper/workflow15/15 (213 assertions), complete
standing1,674/0 with1,264 explicit skips (22,293 assertions), types/boundaries/
licences pass. Independent frozen-delta focused23/23 plus one Unix skip and actual
browser4/4 (120 assertions) approve publication. Fresh full CI remains required;
this changes no production code, SQL, provider or retained local app.

[Question205](../questions/205-fiscal-immutable-command-replay.md) supersedes the
earlier integration approval: original request/retry keys incorrectly returned a
later head. Forward79 and canonical HTTP body repair now pass independently executed
78→79 and all-key replay proof. No applied migration or stored financial row changes.
Exact15f5204 passes all six CI34039764089 jobs, including the repaired Linux readiness
and canonical referee. PR87 is independently merged as22f1bed; a separate actual79
post-merge schema/referee11/11 also passes. The single founder preview remains77.

[Question204](../questions/204-supervised-fiscal-delivery-runtime.md) implements
supervised discovery→claim→transport→reconciliation with frozen migration80, bounded
adapter lanes and cancellation, database-clock lookup cadence and common process
shutdown. Independent genuine two-tenant HTTP/worker proof11/11(95), extra lock/ACL
proof and current80 schema/referee11/11 pass. New discovery authority is included
in startup readiness, with historical79 rejection and hostile ACL/config tests.
Restart-safe lookup receives detached original issued bytes, not only internal IDs;
the fresh-worker actual database proof needs no prior in-memory submit. Final
standing1,664/0 with1,263 explicit database skips, types,177 boundaries and23 licences
pass. Complete current80 CI and actual Linux process/readiness proof remain required
before integration. Real authenticated provider/sandbox remains unfinished.

[Question203](../questions/203-fiscal-submission-http-integration.md) admits both
authenticated request/retry HTTP persistence paths after Q201 exact Linux CI.
They remain unavailable by default: no role grant or adapter is activated.
Independent real-database signed-session proof now passes: root personally13/13(125),
including five actual PostgreSQL cases. Exactcb9a87f all-six CI34017067690 now
passes, with required HTTP9/9(89), including all five genuine cases, and referee11/11.
Delivery-worker integration and authenticated provider/sandbox remain unfinished.

[Question201](../questions/201-canonical-fiscal-submission-integration.md) admits
canonical78, release/catalogue/CI proof and transaction-safe request/retry commands
after Q199's independent execution. It does not activate a provider or refresh the
stable local app. Historical private-scope restrictions below remain the record of
those stages; Q201 names the exact newly admitted paths.

Register an already-issued eligible fiscal document through a replaceable provider
port, preserve the exact issued bytes, record every delivery attempt and receipt,
and make a timeout recoverable without blindly sending another invoice. The domain
must distinguish local issuance from provider registration and preserve the document,
number, accounting and fiscal chain unchanged on every outcome.

This is one implementation order, not completion of Phase7. No sandbox result may
be called real authority registration. A live authenticated sandbox round-trip remains
required for the Phase7 IRP exit; credentials, taxpayer authorization and any spending
remain founder-controlled at action time. Building provider-neutral code and local
contract tests does not require choosing a commercial vendor.

## ADR-440 — delivery reliability within the existing monolith

**Status:** accepted technical direction; integration details require the scoped
follow-on admission below before database or runtime edits.
**Decider:** Codex under the founder's implementation directive.

Constraints: strict TypeScript/Bun, PostgreSQL16 authority, one modular monolith,
existing outbox/consumer cursors, no new dependency, broker, model or infrastructure.
An outbound request cannot share an atomic transaction with a remote authority.

Decision: claim durable work in a short database transaction, perform transport
outside database locks, then reconcile a verified, document-bound result in another
transaction. Timeouts and duplicates request lookup; neither creates success nor
permits automatic resubmission. Only an explicitly known-not-sent result may become
eligible for another bounded attempt. Accepted/cleared and definitive rejected results
are terminal for the exact payload. Correction is a new document, never a payload edit.

```text
issued document -> durable request -> claim -> provider transport
                                             | verified receipt -> terminal result
                                             | unknown/duplicate -> lookup -> receipt
                                             | known not sent -> bounded retry
```

Alternatives: holding database locks across HTTP delays staff work and still cannot
guarantee atomicity; a separate broker/service adds cost and operational ownership;
blind retries lose the distinction between response loss and rejected delivery.
The selected outbox approach reuses Yellow but requires explicit attempt identity,
reconciliation and crash-recovery tests. Revisit worker partitioning only after
measured queue/latency pressure, without weakening invoice identity or retry safety.

## Verified provider facts, not activation authority

[Question206](../questions/206-clearirp-protocol-and-signed-receipts.md) preserves
the latest directly read ClearIRP protocol evidence, existing artifact-storage gaps
and independently critiqued proposal for authenticated transport, immutable signed
receipts and an authorized read model. Only its exact private decoder and JWS
and original-source binding paths are admitted; the full provider/SQL/read integration remains to be
admitted. Its direct core lookup evidence must not be confused with the commercial
gateway's separate protocol. Q204 is merged; Q206 is current implementation.

The official GSTN IRIS IRP6 pages document Generate IRN and retrieval by document
number/date/type. Generation checks duplicates across IRPs. Document lookup has a
documented recent-data window; older access may depend on the provider's service.
Sources checked2026-09-06:

- https://einvoice6.gst.gov.in/content/core-apis-wiki/
- https://einvoice6.gst.gov.in/content/kb/generate-irn/
- https://einvoice6.gst.gov.in/content/kb/get-by-document-details/

These do not establish provider-specific wire URLs, credentials, cryptographic
envelopes, unrestricted historical lookup, retry guarantees or certification. The
unknown-response policy above is Yellow's conservative technical design, not an
asserted IRP guarantee. Keep document timeliness, e-invoice eligibility and transport
availability distinct. Do not infer taxpayer eligibility merely from a B2B payload.

### Issued-source handoff findings

Canonical0077 stores the approved ordinary sections plus server-derived `DocDtls`,
including `Version:1.1`, and hashes exact PostgreSQL `content::text` UTF-8 bytes.
Amounts/rates are exact decimal strings. The ordinary intermediate item candidate
omits Qty/Unit, but canonical0077's final `preDocumentJson` selects the compatibility
items, so the issued document includes Qty1.000/UnitOTH. Root traced this through
`compose_india_native_fiscal_completion_evidence` and the commit function on2026-09-06;
the earlier statement that the issued items omitted these fields was incorrect.
The provider wire payload still needs an explicit validated projection; do not claim existing content is
already a certified provider request. Do not recalculate tax from mutable current
configuration or convert arbitrary bigint amounts through a lossy JavaScript Number.

IRN is a separate authority identity, not Yellow's content hash or fiscal-chain
hash. The official [IRN description](https://einvoice6.gst.gov.in/content/irn-2/)
documents identity from supplier GSTIN, financial year, type and number, and further
document-number restrictions. A provider rejection must not silently uppercase,
renumber or edit an issued Yellow document. Stored IRN/acknowledgement/signed-invoice/
signed-QR artifacts must bind back to the immutable document ID/hash and validated
provider identity, never replace `document.content` or `document.sha256`. The baseline
fiscal_submission response fields exist, but their governed writers, tenant-coherent
references and receipt/attempt history still require integration design and proof.

## Lane A — currently admitted scope

Implement and test private provider-neutral types and a pure transition reducer.
This preparatory lane runs alongside Order434 CI and changes no existing exported
capability, migration, database, HTTP route, UI, dependency or runtime.

```text
handoff/orders/440-fiscal-submission-lifecycle.md
src/contexts/tax-fiscal/fiscal-provider.ts
src/contexts/tax-fiscal/fiscal-submission-state.ts
tests/fiscal-submission-state.test.ts
handoff/reviews/440-fiscal-submission-lifecycle.md
```

The initial state model uses the existing persisted status vocabulary:
pending/submitted/cleared/accepted/rejected/error. Carry explicit tenant/provider,
attempt identity, document/payload binding and reconciliation/retry disposition rather than treating
all errors as retryable. Clearance resolves to cleared; reporting/peppol/exchange
resolve to accepted. A submitted/uncertain request cannot be blindly reclaimed.
Transport outcomes remain untrusted until a provider adapter verifies and normalizes
them; TypeScript types or a submitted reference do not establish fiscal acceptance.
No fake-success adapter is exported as a production provider.

Tests must exhaust valid/invalid transitions, matching attempt/document/payload,
duplicate/timeout reconciliation, known-not-sent retry, pending lookup, terminal
immutability, exact replay and stale/conflicting results. Use explicit typed Result
at the reducer boundary, no permissive default transition, no wall-clock/global state,
no secrets/provider bodies in errors. Freeze returned values without mutating inputs.

Root's first executable inspection found three Lane A defects before integration:
hydrated-state replay returned an unfrozen value; a provider-port pending transport
result was rejected by the reducer; and a reporting state incorrectly labelled
cleared was accepted on replay. Add exact regressions and repair the value/state
contracts without weakening unknown-response or terminal protection. These failures
belong to this new private lane, not to the published Order434 candidate.

## Current-status admission after native acceptance

[Question198](../questions/198-concurrent-reviewed-source-integration.md) additionally
admits exact integration of concurrent reviewed PR84 hotel-journey/schema/design
work with this fiscal lane and Order441's Astra Ultra RMS research. Preserve both
descriptive Order440 histories; no scope or capability is silently removed.

[Question196](../questions/196-native-closure-status-admission.md) admits the exact
current status/plan/source/test paths listed there. This is recorded build
truth only, not durable integration or runtime activation. Root's additional proxy
inspection exposed validation of snapshots followed by reads of original objects;
the repair now consumes validated snapshots only. Independent Lane A proof passes
14/14 with66 assertions and full typecheck. Its review approves only the private
contract; historical-attempt uniqueness, retry bounds and authenticated provider
normalization remain future integration obligations.

## Subsequent integration admission (not yet a file-edit authorization)

[Question197](../questions/197-issued-fiscal-wire-candidate-admission.md) now admits
the exact private issued-source projection and genuine-issued fixture paths below.
This first integration step distinguishes source bytes from transmitted bytes before
admitting durable writers. It does not yet authorize DDL, database grants, provider
activation or a network submission. No new Qty/Unit policy is inferred: the candidate
preserves only the compatibility values already present in canonical0077's document.

```text
handoff/questions/197-issued-fiscal-wire-candidate-admission.md
src/contexts/tax-fiscal/india-irp-issued-wire-candidate.ts
tests/india-irp-issued-wire-candidate.test.ts
tests/india-irp-issued-wire-candidate.integration.test.ts
.github/workflows/ci.yml (required isolated Order440 proof step only)
```

The projection accepts the exact `document.content::text` bytes and stored SHA-256
from a tenant-scoped, native-origin-authenticated reader. It verifies byte integrity,
checks the fixed issued source shape, preserves fiscal identity and exact amounts,
and serializes decimal strings as validated JSON numeric tokens without Number
conversion. A matching caller-supplied hash proves byte integrity only, not database
authenticity. Production readers/writers remain a subsequent admission. Unit and
genuine-issued integration proof are both required; this candidate is not certified
by an authority and may not be sent to a live provider by this private module.

[Question199](../questions/199-durable-fiscal-submission-admission.md) now admits the
complete durable foundation draft, private repository/worker and executable proof.
It preserves legacy rows and the audited-seal policy, reuses runtime-login capability
authority, and requires protected immutable receipt history. Canonical migration and
provider/runtime activation remain outside this draft admission.

After434 acceptance, coordinator must inspect the actual issued document source and
existing fiscal_submission privileges, then record exact paths/DDL/signatures before
starting durable request/attempt/receipt persistence, the claim/reconciliation worker,
canonical issued-IRP-payload assembly and HTTP/operator reads. Reuse existing source
truth; do not create a second journal/document or assume caller-hashed payloads are
database-authenticated. Do not widen Lane A silently.

Q197 private projection checkpoint: root genuine-issued proof passed4/4 with230
assertions; a non-implementer personally reran final unit10/10(52), genuine-issued
4/4(230), typecheck, explicit missing-environment failure and honest absent-DB skip.
The final projection also rejects revoked proxies and malformed Unicode and bounds
input before byte-buffer allocation. Whole standing proof passes1595/0 with1195
explicit DB skips(21771 assertions), and boundaries171/licences23/audit pass. The
required CI proof is wired to an isolated clone; its new exact-revision execution is
still pending. This is not durable submission, authenticated transport or full440.

Full-order acceptance requires actual native-issued fixtures, tenant/property/actor
denials, concurrent claims, crashes before/after transport, unknown/duplicate outcome
recovery, verified receipt binding, retained audit and immutable document/accounting
census. Migration/schema/11-invariant and independent personally executed proof apply
to that later high-risk integration. Lane A unit tests alone do not close this order.

## Q199 durable foundation checkpoint

The private SQL draft, repository and one-step worker are implemented without a new
dependency or live provider. Root and independent native_migration_assembly each
personally passed17 genuine PostgreSQL tests with190 assertions, including100
competing claims, three GST wire families, unknown-outcome lookup, bounded retries,
source/financial preservation, full write rollback, history retention and both actual
audited seal commit schedules. Worker/state/wire40/40(207) and typecheck pass. Root
standing1613/0 with1214 explicit database skips(21877;490 files) is separate evidence.

Real red tests found null-result-family acceptance, leases consumed while waiting
for locks, a concurrent same-request race, nullable mixed legacy/durable metadata,
and the missing promised history-read grant. All have permanent regressions and
repairs in the frozen draft. Request correlation IDs do not change semantic replay
identity; actor/property permission is always checked again. Earlier partial runs and
test-harness stalls remain in the logs, not counted as successful complete runs.

Draft source SHA-256:
`65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6`.
The draft is not in the migration runner: canonical main stays77/127, while the
disposable draft catalogue is128 tables/118 policies. Independent reproducible
schema-dump comparison and the canonical Python referee11/11 now pass; review440
approves the private foundation and subsequent canonical migration/CI admission. No operator
command, authenticated provider, serving local app or complete Order440 is claimed.
