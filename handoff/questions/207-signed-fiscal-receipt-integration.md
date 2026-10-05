# Question 207 — Complete authenticated fiscal receipt integration

**Status:** ACCEPTED technical implementation admission under Order440; no live
provider, taxpayer registration, credential use, local promotion or deployment.
**Date:** 2026-09-07. **Decider/coordinator:** Codex, under the founder's standing
implementation authority. Independent non-implementing executable review remains
mandatory. Q206's original-source/signature binder is published at21794c5 in PR90;
that PR is still in CI when this admission is written. No phase exit is claimed.

## ADR-440-207: one end-to-end outcome, existing durable primitives

Deliver authenticated provider submission/recovery, atomic signed receipt storage,
and an actor/property-authorized receipt read. Follow with the operator invoice and
print journey, not a collection of private helpers labelled a finished feature.
Keep Q205 command receipts byte-stable. The immutable issued document, original
accounting and number/hash chain are never changed by any provider response.

Natural-solution test: existing fiscal_submission.response, response_sha256 and
qr_payload plus immutable history/fact/outbox already hold the required evidence.
Use these, with one forward migration0081; no new table, balance, queue, object
store, infrastructure or dependency. JSONB retains explicit base64 byte snapshots;
never claim that hashing jsonb::text hashes the original provider bytes.

Alternative new artifact table/object store is rejected: it adds another lifecycle
and access path without demonstrated need. Hash-only retention cannot render or
independently verify a signed receipt. Storing credentials in receipt JSON is forbidden.

The cost is bounded duplication of encrypted response, decrypted response and signed
tokens for auditability. Do not copy these into history, fact_log or outbox: those
retain hashes and transition identity. Limits below are Yellow resource policy,
not statements about provider limits. Small ordinary receipts stay small.

## Source and type contract

The owner-controlled successful claim adds exactly `sourceContentJson`, obtained
by the existing tenant/document-bound join as document.content::text. It is bounded
to1MiB UTF-8 and checked against existing documentSha256. Do not add another source
hash. Keep wireJson/wireSha256 independent. Pass the source JSON and documentSha256
to both submit and fresh-process lookup in FiscalProviderSubmission/Lookup; neither
comes from an HTTP body or reconstruction of parsed wire.

Provider results retain nonterminal pending/timeout/duplicate/known_not_sent.
For newly signed India results, accepted carries authorityRef=IRN, responseSha256
and `receipt`. Rejected carries responseSha256 and receipt, with NO authorityRef.
Provider_cancelled carries responseSha256 and receipt, with NO authorityRef.
The worker adds existing attempt/tenant/provider/document/wire binding unchanged.
SQL must reject new unsigned terminal writes. Preserve *existing* legacy terminal
response replay before applying the new receipt-only validation to a new transition.
Other provider modes in the private generic reducer retain their documented legacy
forms; the registered India production worker never emits unsigned acceptance.

### Persisted receipt v1 (exact keys, no secrets)

All variants share these keys:

`version`, `kind`, `protocolProfile`, `environment`, `providerKey`, `documentId`,
`documentSha256`, `wireSha256`, `receivedAtUnixMs`, `rawResponseBase64`,
`decryptedDataBase64`, `decryptedDataSha256`.

- version is1. protocolProfile is `clearirp_direct_v1_04_v1_03_v1`.
- environment is sandbox or production, preserved as evidence, not certification.
- receivedAtUnixMs is a nonnegative safe integer supplied by the runtime clock.
- rawResponseBase64 is canonical padded standard base64 of the exact successful
  authenticated Invoice/lookup HTTP response body, at most6MiB decoded bytes.
  responseSha256 hashes those decoded bytes. Never retain authentication responses.
- decryptedDataBase64 is canonical padded standard base64, at most4MiB decoded
  bytes. decryptedDataSha256 hashes these exact bytes. For ErrorDetails it means
  exact decoded ErrorDetails bytes, not an invented encrypted Data response.
- Nonempty decoded strings are strict UTF-8. Base64 must decode/re-encode exactly.
- Full serialized receipt is bounded to18MiB UTF-8 before durable reconciliation.
- Bound providerKey/documentId/documentSha256/wireSha256 to the claimed row.

Accepted kind is `accepted_signed_v1`, adding exactly:
`irn`, `ackNo`, `ackDt`, `signedInvoice`, `signedInvoiceSha256`, `signedQRCode`,
`signedQrSha256`, `verification`.
IRN/ack grammar and actual calendar checks are the Q206 binder's rules. Both token
hashes cover the exact compact ASCII/UTF-8 string; qr_payload equals signedQRCode.
`verification` has exactly `profileVersion`, `issuer`, `verificationUnixMs`,
`invoiceKeyId`, `invoiceKeySpkiSha256`, `invoiceBundleVersion`, `qrKeyId`,
`qrKeySpkiSha256`, `qrBundleVersion`, populated from the genuine internal binder.
Both signatures AND authenticated provider Status=ACT are required for acceptance.
The binder's signature-only false flags are not overwritten or reused as authority.

Rejected kind is `rejected`, adding exactly `errorCodes`:1–32 distinct bounded
printable ASCII codes (1–64 characters), not raw provider error text. Only codes
explicitly configured as definitive rejection may produce this terminal result.
Mixed/unknown/duplicate/not-found codes remain uncertain lookup, never an inferred
known-not-sent or rejection. Error messages and raw/decrypted bodies are not in GET.

Cancelled kind is `provider_cancelled`, adding exactly `providerStatus: "CNL"`.
It requires an authenticated lookup result, not a cancellation request. It becomes
error/none/provider_cancelled, immutable/non-due/non-retry and visible to operators.
Do not infer acceptance, fabricate an IRN, or change an already accepted head.

## Forward81 and authorization

1. Replace claim and reconcile functions without changing their SQL signatures.
   Keep delivery_version=1 and all pre81 rows unchanged. Do not edit applied1–80.
2. Extend the exact existing head/history constraints for provider_cancelled.
   Rejected receipt-v1 may have null authority_ref; old rejected rows are unchanged.
   Every new accepted result requires the entire checked envelope atomically.
3. Exact original terminal replay remains supported; conflicting terminal results
   fail. Q205's receipt function and immutable POST response are unchanged.
4. Extend durable head protection to DELETE and terminal error/none cancellation.
   Preserve request/claim/reconcile/history/fact/outbox atomic rollback behavior.
5. Add read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid) RETURNS
   jsonb, arguments tenant/property/submission/actor. Require direct app-role call,
   exact transaction-local tenant context, active tenant/user, property containment
   and current `tax-fiscal.submissions:read` permission. Register the permission;
   grant it to no role/user automatically. Return null for a missing scoped row.
6. Revoke broad app_role SELECT on head/history. Retain only head column SELECT
   (tenant_id,document_id,status) for existing business-day readiness. Audit actual
   table/column/inherited grants and owner-function consumers before final approval.
7. Update runtime readiness to require81 plus this exact read capability, expected
   ownership/search_path/grants, and preserve the existing five worker capabilities.
   Old binaries cannot be activated against81: rollout keeps worker disabled until
   the matching current binary and profile are installed. SQL independently rejects
   any new unsigned terminal outcome from a stale worker. No live rollout here.

## Authorized GET / display contract

GET /api/v1/properties/:property/fiscal-submissions/:submission/receipt uses the
existing verified session + governed transaction. Recheck current role/property
grants in HTTP and SQL on every call, including revocation. No idempotency key,
command replay headers or adapter-presence prerequisite for reading past receipts.
Return no-store200 `{fiscalSubmissionReceipt: ...}` with exact common fields:
`kind`, `submissionId`, `tenantId`, `propertyNode`, `documentId`, `documentSha256`,
`wireSha256`, `providerKey`, `attemptId`, `attemptNumber`, `status`, `disposition`,
`transitionSeq`.

- pending: common fields only (includes unresolved/retry-required head).
- legacy_hash_only: adds authorityRef (nullable), responseSha256 (nullable).
- rejected: adds environment, responseSha256, errorCodes.
- provider_cancelled: adds environment, responseSha256, providerStatus=CNL.
- accepted_signed_v1: adds environment, responseSha256, irn, ackNo, ackDt,
  signedInvoice, signedQRCode, signedInvoiceSha256, signedQrSha256, verification.

Never expose raw/decrypted response bytes, request wire, claim token, credentials,
unfiltered provider messages or tenant-unrelated data. Missing and inaccessible
resources must not leak existence. Legacy records are never relabelled signed.
Printing must use the exact signed QR payload and immutable invoice source, with
clear sandbox/not-registered indicators; no fabricated signature or fiscal validity.
Actual operator invoice/print UI scope is admitted separately below before UI edits,
after read/issuance discovery contracts are inventoried; it remains part of the
required product outcome, not waived by successful API proof.

## Direct ClearIRP adapter, offline construction and activation boundary

Use Q206's primary direct-core paths, not the separate commercial gateway. Pin the
single protocol profile above. An explicit validated deployment configuration must
supply HTTPS origin, environment, encryption SPKI/provenance, signing bundle/issuer,
credential reference, SEK plaintext encoding (raw32 or base64-text32), token expiry
UTC offset and definitive rejection/duplicate/not-found code sets. No default origin,
NIC issuer, key, credential, token timezone or code list. No token-supplied network
URL/key, redirects, telemetry, secret/error-body logging or new dependency.

The selected profile implements standard base64 of auth JSON, RSAES-PKCS1-v1_5,
32-byte random AppKey, AES-256-ECB/PKCS7 for SEK/Data, exact documented paths and
headers. These explicitly selected algorithms are an offline protocol capability,
NOT confirmation of a particular current provider account. Activation needs the
actual provider onboarding packet to confirm them. Unknown encoding is rejected,
never auto-detected. Validate all source/hash/GSTIN binding before authentication.

Authenticate per bounded operation initially, avoiding an unbounded credential/token
cache. Respect the existing AbortSignal/deadline across auth+submit/lookup+body reads.
No automatic resend of Invoice. Auth failure before submit is known_not_sent;
lookup auth failure and any uncertainty after submit become lookup/pending/timeout.
Document-details lookup uses original immutable DocDtls and seller identity; a fresh
worker cannot require the prior process's token, SEK or IRN. CNL requires lookup.
Use strict lossless JSON for money/AckNo and duplicate field rejection. Decoder may
gain an explicit bounded-size overload up to8MiB; its default1MiB/depth32/node100000
behavior and existing tests stay unchanged. Never parse signed numbers via Number.

Provider secrets are resolved only from an explicitly configured deployment file,
referenced by a protected file path, not HTTP/config text from operators. File content
is bounded and snapshotted. The environment's validated profile list constructs the
same immutable registry consumed by worker and HTTP readiness. Missing configuration
leaves registry empty; enabling the worker without it fails before any transport.
No current file, provider identity, tenant, credentials or registry is activated.
Offline tests use generated keys and fictional invoice data with an injected trusted
HTTP transport implementing the complete auth/encrypt/decrypt/signature protocol.
Injection is constructor-owned test composition, never a network/user parameter.

## Exact editable scope / ownership

Coordinator contracts/integration (no conflicting simultaneous writers):
src/contexts/tax-fiscal/fiscal-provider.ts
src/contexts/tax-fiscal/fiscal-submission-repository.ts
src/contexts/tax-fiscal/fiscal-submission-worker.ts
src/contexts/tax-fiscal/fiscal-submission-state.ts
src/contexts/tax-fiscal/fiscal-submission-receipt.ts
src/contexts/tax-fiscal/index.ts
src/http/operator.ts
src/app.ts
src/server.ts
src/kernel/build-info.ts
src/contexts/tax-fiscal/india-irp-provider-configuration.ts
tests/fiscal-submission-receipt.test.ts
tests/fiscal-submission-worker.test.ts
tests/fiscal-submission-state.test.ts
tests/fiscal-submission-commands.test.ts
tests/operator-fiscal-submission-receipt.integration.test.ts
tests/server-fiscal-runtime.test.ts
tests/india-irp-provider-configuration.test.ts

Database builder owns only:
migrations/0081_fiscal_signed_delivery_receipts.sql
tests/fiscal-signed-receipt-durability.integration.test.ts
tests/fixtures/order440-signed-fiscal-receipt.ts

Protocol builder owns only:
src/contexts/tax-fiscal/clearirp-direct-adapter.ts
tests/clearirp-direct-adapter.test.ts
src/contexts/tax-fiscal/fiscal-exact-json.ts
tests/fiscal-exact-json.test.ts

Coordinated compatibility/release evidence scope:
.github/workflows/ci.yml
scripts/local-review.sh
tests/build-readiness.test.ts
tests/build-readiness.integration.test.ts
tests/free-host-arm64.test.ts
tests/release-workflow.test.ts
tests/database-acceptance.integration.test.ts
tests/migrate.integration.test.ts
tests/fiscal-submission-delivery-runtime.integration.test.ts
tests/fiscal-submission-durability.integration.test.ts
tests/fiscal-submission-immutable-replay.integration.test.ts
tests/operator-fiscal-submission.integration.test.ts
tests/runtime-database-authority.integration.test.ts
tests/fiscal-replay-workflow.test.ts
tests/fixtures/order440-fiscal-submission-http.ts
tests/fixtures/order440-fiscal-immutable-replay.ts
tests/fixtures/order440-fiscal-delivery-runtime.ts
tests/schema/expected.sql
docs/SCHEMA-GUIDE.md
docs/STATE-MACHINES.md
docs/EVENTS.md
docs/CONTRACTS.md
docs/EXTENSIONS.md
docs/PROJECT-STATUS.md
BUILD-PLAN.md
handoff/PHASE-7-PLAN.md
handoff/ROADMAP.md
src/project-status.ts
tests/project-status.test.ts
tests/founder-status.integration.test.ts
tests/current-management-demo-status.intentional-red.test.ts
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/questions/206-clearirp-protocol-and-signed-receipts.md
handoff/questions/207-signed-fiscal-receipt-integration.md
handoff/reviews/440-fiscal-provider-and-receipts.md
handoff/LEDGER.md
DECISIONS.log

Anything outside these paths requires an explicit scoped amendment before editing.
No dependencies/install, existing database reset, new worktree/cluster, global role
change, stable-local restart or WSL/Docker action is included. Database execution
targets must be explicitly named before creation/application. Root owns any schema
snapshot regeneration and coordinates tests so resource-heavy suites do not overlap.

## Required proof and completion boundary

Independent real PostgreSQL80→81 no-op/rollback/drift, legacy terminal replay and
Q205 byte-stability; first acceptance requires genuine bound signed artifacts;
forced failures roll back head/history/fact/outbox; cross-tenant/actor/property/read
revocation denials; direct sensitive-column and terminal DELETE/UPDATE denial;
rejected-without-IRN and CNL non-discovery/non-retry; existing day-close consumers.
Execute the complete synthetic protocol→actual worker→PostgreSQL→session GET
journey, including response loss then fresh-worker lookup, exact unsafe cent/AckNo
rejection, bad signatures, expiration, malformed/oversized/duplicate envelopes,
deadline cancellation, secret non-disclosure and same-document identity throughout.
Required target CI runs decoder/binder/adapter tests on native ARM64, current81
schema and canonical seed/referee11/11, all existing compatibility gates and full
standing/type/boundary/licence checks. Keep failed proofs and actual evidence.
Real sandbox onboarding and invoice/print visual/functional proof remain explicit
requirements; no offline fixture, generated signature, test count or PR merge alone
proves those or Phase7 completion. The full roadmap goal stays active.

### Exact adapter configuration clarification

Factory is async createClearIrpDirectAdapter(configurationJson: unknown,
secrets: unknown, options?: {fetch?: typeof fetch, clock?: () => number}), returning
a typed Result<FiscalDocumentProvider>. Its factory creates the real binder itself;
no caller-supplied verifier, verified boolean or random-bytes bypass is admitted.
Exact configuration keys are protocolProfile, providerKey, environment, apiBaseUrl,
encryptionSpkiDerBase64, issuer, profileVersion, trustBundleJson, sekEncoding,
tokenExpiryUtcOffsetMinutes, definitiveRejectionCodes, duplicateCodes, notFoundCodes.
sekEncoding is raw32 or base64-text32; the integer offset is explicit, within
-840..840 minutes. No arbitrary algorithm/path/base64 selectors are added: those
belong to the single fixed protocol. Exact secret keys: clientId, clientSecret,
userName, password, gstin. Secrets are snapshotted and never serialized into errors.
Trusted fetch/clock injection is only application/test composition, never HTTP input.

### PR90 normal merge and exact post-merge proof admission

Root personally rechecked all six CI34057881483 jobs and normal CodeQL at exact
21794c5/base43fc758. Independent fiscal_http_acceptance inspected the complete
terminal evidence and normally SHA-guarded merged PR90 at2026-09-06T20:46:58Z:
merge4ba1d6f3e7a37956d565b3c980c7b7796524f668, parents43fc758 and21794c5,
treed87615d2d779acd10009742a2234d862103f2424, equal to tested source.

Admit one NEW-ONLY database yellow_order440_q207_postmerge_90607 on the existing
127.0.0.1:55503 cluster, cloned from pristine yellow_order434_production77. Check
target absence first; if present stop rather than reset/drop/reuse. Reconstruct the
exact merged4ba1d6f85 canonical inputs from binary Git objects in one uniquely owned
D:\Yellow\temp source directory, not the concurrently changing workingtree81.
Run the genuine canonical80 schema/seed/referee11/11 after exact-source validation.
Capture template/global-role attributes and membership before/after; preserve them
and the founder preview, with zero lingering target sessions. No new cluster, retained
target reset, global-role changes, WSL/Docker/local restart or overlapping heavy suite.
The reviewer owns this execution; root defers other DB/full suites until it finishes.

### Independent forward81 proof admission and boundary corrections

The post-merge80 proof above is complete. Root read the entire prospective81 SQL,
fixture and suite. Independent fiscal_http_acceptance identified that the original
"pre81" case fabricated a legacy-shaped terminal row with owner DML after81; it
does not prove migration preservation. Root also confirmed the missing role-tenant
join and new unsigned owner-transition allowance. Prospective81 now joins the role
to the same tenant and guards new terminal INSERT/UPDATE while preserving unchanged
old terminal rows. Byte validation bounds decoded allocations and rejects leading
UTF-8 BOM, matching the application contract. Applied1–80 remain unchanged.

Admit these two NEW-ONLY proof databases on existing127.0.0.1:55503:

- yellow_order440_q207_upgrade_review_90607: clone pristine
  yellow_order434_production77; apply exact committed78–80, create genuine80
  accepted/rejected/known-not-sent/in-flight histories via the old governed functions,
  capture original request/all retry results and complete row snapshots, then apply
  prospective81 through the actual migration runner. Prove byte preservation,
  legacy replay, current new unsigned denial, no-op and drift/transaction rollback.
- yellow_order440_q207_sql81_review_90607: separate pristine77 clone, apply canonical
  78–80 and prospective81, run empty81 signed durability then actual session GET
  and hostile permissions/late-write rollback proofs. Generated signatures prove
  signed storage only, not authenticated transport or live registration.

Check absence before creation; any existing target means stop, never reset/drop or
reuse. Snapshot template, global-role attributes/memberships and canonical input
hashes before/after. Only one heavy database suite at a time. No retained-target
changes, new cluster, global-role mutation, WSL/Docker or preview restart. Prospective
SQL hash8412f2a5bac88013e945e5717e95867745ec490076844b0a932a8d8c67392891
is frozen for this initial independent execution; any repair must retain failing
evidence and cannot rewrite a target's applied migration ledger. The reviewer may
update only the already admitted signed durability test and signed fixture to replace
the invalid legacy proof and add personally executed adversarial cases. It must not
edit production SQL. Publish exact commands/results and all limitations.

### Protected deployment composition contract

The coordinator admits loadIndiaIrpAdapterRegistrationsFromEnvironment(environment,
options?) in the existing Q207 configuration-module scope. The sole environment key
is YELLOW_INDIA_IRP_PROVIDERS_FILE; absence returns an immutable empty registry.
It is an explicit absolute local file path (max4096 characters, no NUL/URL). No
environment inline credentials, inferred profile, default endpoint or active config
is created. Reading configured files and constructing adapters performs no network
request. The existing worker flag remains independently default-off.

Manifest is strict duplicate-rejecting JSON, max4MiB, exactly
{version:1,providers:[...]}, at most16 entries. Each entry has exactly
providerExtensionId (UUID), providerExtensionVersion (positive safe integer),
protocolConfigurationJson (the exact Q207 adapter JSON string) and credentialsFile
(explicit absolute local path). Credentials JSON is a separate bounded16KiB regular
file, exactly the adapter's five secret fields. Both files must be snapshotted from
one opened handle, refuse directories/symlinks and growth beyond bounds, and close
handles on all paths; on POSIX refuse group/other-accessible secrets and mismatched
ownership. Windows deployment must protect these paths with the runtime account's
ACL; do not claim POSIX permission bits prove Windows ACLs. Never print path/content
or propagate filesystem/provider exceptions in returned errors.

Only the real ClearIRP factory constructs submit/lookup. Duplicate exact registry
identities or malformed entries fail the entire load, not partial activation. Freeze
the resulting registrations and use the same list for HTTP adapter availability
and delivery workers. Fetch/clock options are trusted application/test composition
only; no injected verifier or file-reader bypass. Export via tax-fiscal/index.ts;
load before server database pools/listening and fail sanitized on invalid config.
No current machine's profile, secret file, registry or worker is activated by this
implementation. Real account/protocol activation remains a separate onboarding gate.

### Full synthetic provider-to-operator journey proof scope

Additionally admit tests/fixtures/order440-clearirp-protocol.ts and
tests/fiscal-signed-provider-journey.integration.test.ts to execute the complete
real adapter→real worker→actual81 PostgreSQL→signed-session GET journey. Reuse
existing genuine native document/request fixtures; generate ephemeral test signing
and encryption keys, implement actual fixed-protocol auth/SEK/AES and source-bound
signed responses inside the injected trusted fetch. Do not substitute a provider
returning verified:true for protocol execution. Include response-loss followed by a
fresh adapter/worker's document lookup and no duplicate POST, terminal rejection and
cancellation, and bad signed source values staying unresolved. No network account,
secret or provider activation. Use the same explicitly admitted synthetic81 target
only after the independent empty-target suite finishes and closes connections;
never reset it. Protocol builder owns these two new test files; existing SQL fixture
remains independently reviewer-owned. No other scope is widened.

### Failed prospective81 proof, correction and continuation

The independent reviewer executed frozen8412f2a5 on the admitted new upgrade target
after actual canonical78–80. A transient canonical81 transaction plus a late
assertion demonstrated that PUBLIC column SELECT grants survived; the whole81
transaction rolled back. A separate genuine positive-control predicate probe
demonstrated acceptance of NULL status, disposition and resolution source. Its
entire81 DDL transaction also rolled back. Neither is a successful migration or
release. The invalid earlier JSON-encoded positive control is retained as an invalid
probe, not used as evidence. Applied1–80 and the ledger are unchanged.

Prospective81 is corrected to reject absent required bindings and mismatched result
source, and to assert every effective app/runtime column grant on both head and
history. Unexpected PUBLIC or inherited sensitive grants reject the full migration;
the migration does not change global role membership or silently revoke unrelated
deployment authority. Keep the original failed-source evidence and execute the
permanent hostile-ACL and genuine NULL-input regressions on the repaired source.

Explicitly continue the already-created yellow_order440_q207_upgrade_review_90607
for its originally admitted upgrade proof, only after rechecking that it remains
the same owned, empty canonical80 target with no81 ledger entry/read function and
no sessions. This is continuation of its interrupted proof, not reset, replacement
or reuse of unrelated data. No drop, recreation or ledger rewrite is authorized.
The separate yellow_order440_q207_sql81_review_90607 remains NEW-ONLY and must
still be absent before creation. Freeze and publish the corrected81 hash before
successful application; later defects cannot rewrite applied bytes.

### Release metadata consistency

Additionally admit .github/workflows/release.yml solely to advance its current
image migration-frontier metadata from80 to81 together with the matching source,
readiness and CI schema gates. This does not dispatch a release or deploy an image.
Preserve release approvals, exact-source provenance, architecture checks, default-off
workers and all existing job/security gates. The assigned release-wiring builder
owns this file and its already-admitted tests; historical80 fixture expectations
are not re-labelled81.

### Clean81 canonical referee and current-worker compatibility

Admit one additional NEW-ONLY target yellow_order440_q207_referee_review_90607
on existing127.0.0.1:55503, cloned only from reverified pristine
yellow_order434_production77. Verify absence before creation; never reset or reuse
an existing target. Apply canonical78–81 with frozen81 SHA256
d2e4e34a4587f4ee12ed5c43f8fac9d4186345877bdbb75ac74217460f0e06ac, compare its
normalized schema with the two independently matching81 proof targets, then run
the unmodified canonical seed and 11-invariant referee. Preserve all source hashes,
template data, global-role metadata and local preview; close all owned sessions.
Root mechanically regenerates tests/schema/expected.sql from the independently
captured canonical81 normalized artifact, not an invented SQL snapshot.

Additionally admit setup.sh and setup.ps1 solely to correct current migration-range
messages from1–80 to1–81; the128-table and actual11/11 assertions are unchanged.

The existing Q204 runtime suite imports the current worker. It must therefore run
on81 and retain its complete discovery/concurrency/retry/late-result/transaction
coverage using genuinely bound synthetic receipts. It must not run new binaries
against80 and fabricate missing source/receipt evidence. Its already-admitted test
and fixture paths may be updated for this actual current contract; CI upgrades that
one isolated Q204 clone to81 while retaining separate historical80 source fixtures.
The canonical77→78 durability suite remains historical. Its one current-worker
integration case must explicitly prove current-binary rejection on old78, while
the full preserved current worker integration runs on81. Preserve historical SQL
tenant-denial/transaction/replay assertions and identify any relocated coverage.
No production compatibility bypass, applied-migration rewrite or weaker acceptance
is admitted by these test repairs. Independent executable proof remains required.

The matching tests/setup-current-catalogue-oracle.test.ts is additionally admitted
only to derive and assert the real81-file/81-frontier/128-table catalogue and both
setup entrypoints' current messages. Historical catalogue assertions remain intact.

### Independent current and historical runtime compatibility execution

Admit two additional NEW-ONLY proof targets on existing127.0.0.1:55503, each cloned
from the reverified pristine yellow_order434_production77. Verify absence before
creation; do not drop, reset, overwrite a ledger or change any global role.

- yellow_order440_q204_signed_review_90607: apply canonical78–81 and execute the
  complete current delivery-runtime suite, including genuine signed acceptance,
  max-one-connection commit-before-transport, competing workers, abort/late result,
  fresh lookup without resend and explicit retry.
- yellow_order440_durable_signed_review_90607: leave the clone at canonical77 for
  the existing full historical durability suite's actual77→78 runner. Its updated
  current-binary case must reject the missing-source claim with a rolled-back
  transaction and zero transport; all historical SQL/tenant/replay proofs stay intact.

The nonimplementing reviewer owns serial execution after its focused review. Freeze
all source/test hashes before each run, record failures without resets, preserve
template/global-role/source metadata and close handles. Root defers the full standing
suite while either database proof is live. No preview, live provider or new cluster
is touched. These tests do not grant production activation or complete Order440.

### Current-frontier oracle audit

A separate read-only pre-CI audit found four assertions still expecting80 although
their targets are migrated with the full current directory. Additionally admit
tests/native-fiscal-release-containment.integration.test.ts,
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
and tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
solely to correct their current81 migration count/frontier expectations. Correct
the matching live readiness assertion in already-admitted .github/workflows/ci.yml.
Preserve table/RLS/role/capability, receipt, isolation and other exact assertions.
Explicitly prefix-pinned historical74–80 paths remain unchanged; the runtime-named
capability count stays15 because the new read capability is not runtime-prefixed.

### Current81 fixture failure and independent repair proof

The first complete current81 runtime proof on
yellow_order440_q204_signed_review_90607 failed with six passes/five failures,
88 assertions. The shared genuine signed factory returns a reconciliation envelope,
not a provider resolution; the new fixture incorrectly demanded a `verified` field
that the envelope does not contain. Every accepted fixture result threw, and the
production worker correctly retained uncertainty. Preserve that failed target and
evidence; do not weaken production normalization or inject an unsigned acceptance.

The assigned fixture builder must validate the actual envelope and project a provider
resolution only after the genuine source/signature factory succeeds, with a focused
non-DB regression. After exact-source independent inspection, admit NEW-ONLY
yellow_order440_q204_signed_repaired_review_90607 on existing55503, cloned from
reverified pristine77 then applying canonical78–81, for the complete unchanged runtime
suite. Verify absence, freeze inputs, preserve template/global-role metadata and close
all handles; no reset, new cluster or preview change. The separately admitted
historical77→78 proof proceeds independently of this fixture repair.

### Full-standing composition oracle correction

The first complete Q207 standing run recorded1762 passes,1294 explicit skips and
four failures. Two status oracles still expected PR88/89 wording; the two old Q203
composition guards still required a hard-coded empty array instead of Q207's admitted
protected loader. Additionally admit tests/operator-fiscal-submission.intentional-red.test.ts
only to reflect that composition, alongside the already-admitted HTTP integration
and status tests. Preserve default-off behavior, empty registry when unconfigured,
all-or-nothing load before pools/listen, same registry for HTTP/worker, no inline
secrets, complete HTTP composition and historical database proof. Do not restore
stale hard-coded production or weaken snapshot, phase or activation assertions.

### PR91 provider row-identity consistency

Exact2381bd4 automated review identifies a constructor disagreement: the protected
loader accepts two entries sharing providerExtensionId when their version/key
differs, but the HTTP availability projection rejects them after pools are created.
Independent reproduction confirms that disagreement, not a valid rolling-version
recovery failure. Canonical extension.id is the row primary key; referenced fiscal
provider id/version pairs cannot represent two simultaneous versions of one row.
Valid old/new provider versions have distinct row UUIDs and must remain loadable.

Within the already admitted configuration module and its test, reject any repeated
providerExtensionId as sanitized invalid_manifest before reading that repeated
entry's credentials or constructing its adapter. Preserve exact version/key binding,
all-or-nothing loading, offline construction and the immutable shared registry.
Test same UUID/different version, same UUID/different key, exact duplicates, and
valid distinct UUIDs for the same provider key with different versions. The valid
result must compose through both the real worker registry and HTTP availability
projection; invalid results must return no partial registrations or sensitive data.

Native configuration builder owns these two existing paths. A nonimplementing
reviewer personally executes the final composition proof. Existing PR91 CI remains
baseline evidence only; repaired exact-source CI and normal CodeQL are required
before a normal guarded merge. No migration, runtime configuration, pool/worker
activation, retained database or local preview change is admitted by this repair.

### Bounded CI failure diagnostics

Baseline CI34064668277 passed native81/upgrade and compatibility steps but failed
deployment step17; final referee and app readiness were skipped. Its subsequent
unbounded Compose log dump remained live for more than six minutes, withholding
downloadable job logs. The original deployment assertion is not yet known.

Within the admitted ci.yml and fiscal-replay-workflow.test.ts, bound only that
supplementary failure-log step: one-minute step deadline, a20-second command with
five-second forced termination grace, at most40 records per container and64KiB of
printed tail. Explicitly label partial output and report pipeline exit statuses.
The diagnostic may succeed after reporting truncation; it never changes the failed
acceptance step or permits a merge. Preserve every required test/schema/referee/
readiness gate and unconditional disposable-CI cleanup. No running job is cancelled
or restarted by this source correction. Its first deployment failure remains open
until the actual assertion is retrieved and addressed.

### Independently reproduced catalogue-order correction

The retained81 read-only capability test separately reproduces a deterministic
oracle defect: `ORDER BY expected.name` returns claim/read/reconcile/request/retry/
runtime, while the published expected array places reconcile before read. The
already-admitted database-acceptance.integration.test.ts changes only those two
entry positions. All six full signatures, owners, security-definer settings,
search paths and exact app/runtime/PUBLIC grants remain asserted. Builder red0/1
and green1/0, then nonimplementer green1/0, use the exact named catalogue test;
23 other tests are filtered, not claimed executed. No DDL/DML or schema changes.

Baseline run34064668277 ended cancelled at23:21:41Z after the earlier deployment
failure. Its final referee/readiness remain skipped and job logs remain unavailable
at this checkpoint. The independently reproduced test defect is sufficient for
this bounded correction; it is not falsely identified as the original observed
CI assertion without that log. Fresh exact-source full CI must discharge every
required gate before independent merge. Root's final complete local standing is
1768/0 plus1294 explicit environment skips,23591 assertions,110.19s; independent
workflow15/0 and catalogue1/0 pass. GNU timeout runtime execution remains a Linux
property; native source-wiring proof does not claim it was executed on Windows.
