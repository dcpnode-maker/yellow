# Question199 — Durable fiscal delivery foundation

**Status:** RESOLVED technical admission; implementation and independent proof pending.
**Order:** 440-fiscal-submission-lifecycle. **Date:** 2026-09-06.

Build the next part of existing Order440 without creating a second financial ledger,
changing statutory policy, activating a provider or modifying an applied migration.
The current published candidate remains separate from this work in progress.

## Natural-solution test and authoritative source

Provider selection is existing `fiscal_provider` extension configuration. Delivery
state is the existing `fiscal_submission` head. Documents, numbering, money, facts,
outbox and actor permissions reuse their existing primitives. Generic `fact_log`
cannot be the authoritative attempt receipt:0016 gives app_role generic INSERT and
does not reserve a fiscal discriminator. Prunable outbox cannot be receipt storage.
One narrowly protected append-only `fiscal_submission_history` is therefore justified;
it stores delivery transitions and receipt bindings, not balances or documents.

Persist exact native-issued document identity and separate wire digest. The owner
function reads the document through its tenant/property-coherent native version2
origin, validates its stored source digest and derives the fixed Q197 wire projection.
Caller-provided JSON, digest, number, date, status or fiscal identity is never source
authority. Prove byte equivalence to Q197 on actual issued invoices and hostile cases;
do not introduce a second tax calculation. Only current India reporting/native invoice
inputs are admitted; other mandate modes remain future provider implementations.

## Storage and migration discipline

Develop a complete forward-only SQL draft outside the migration runner first. Add
nullable versioned head metadata with an exact all-or-none constraint; retain every
legacy row byte-for-byte. Never backfill invented actor, payload or provider evidence.
Uniqueness is tenant/document/logical provider key, not extension version. An existing
legacy submission for a document cannot be silently adopted or bypassed via a changed
provider alias. History has tenant-leading keys, coherent composite references, FORCE
RLS, owner-only insertion and immutable UPDATE/DELETE denial. No direct app_role or
runtime DML is granted. A mutable head is delivery state, not a financial-record edit.

## Capability and lifecycle contract

- `request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)` accepts
  tenant,property,document,provider-extension,actor,idempotency-key,request-id.
  Ordinary app_role command; independently recheck active actor/property permission
  `tax-fiscal.submissions:request` before replay or effect. Resolve immutable eligible
  extension type/version/content and bind its logical provider key. Require the
  document's business day open for a new request; derive date from that document.
- `retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid)` accepts
  tenant,submission,actor,key,request-id. New unassigned property permission
  `tax-fiscal.submissions:retry`; only known-not-sent, at most3 explicit retries.
  New attempt identity; retain all previous receipts. Unknown delivery never retries.
- `claim_india_fiscal_submission(uuid,uuid,integer)` accepts tenant,submission,
  lease-seconds (15–300; adapter default60). Runtime-login-only infrastructure entry:
  session_user yellow_runtime, no active role substitution, owner SECURITY DEFINER,
  exact transaction-local tenant. No caller worker UUID confers authority. Generate
  claim token in PostgreSQL; record only its hash in history.
- `reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb)` accepts tenant,
  submission,attempt-id,claim-token,normalized-result. Same runtime-only boundary.
  Document/provider/wire/attempt bindings and result shape must be exact. Adapter
  authentication is still a separate prerequisite: JSON `verified:true` is not proof
  of provider authenticity and no unauthenticated real adapter may be registered.

Runtime-only claims follow the existing0015 capability/`PostgresEventBus` connection
pattern: grant EXECUTE to yellow_runtime only, revoke PUBLIC/app_role; reserve a raw
runtime connection, explicit BEGIN/local tenant/COMMIT, never hold DB locks over HTTP,
and fail closed if session settlement is not proven. No general raw capability is
added to application-facing `Database`.

One current head transitions pending→submitted before transport. An expired submitted
claim is lookup-only; pending/timeout/duplicate stay submitted. Verified terminal
accepted/rejected are immutable for the exact payload; terminal replay requires the
same receipt. Known-not-sent records error/retry eligibility, never an automatic send.
Stale attempt/token or contradictory receipts cannot change the current head. Preserve
history across outbox pruning. Do not store credentials, signed payload bodies or guest
details in events/errors; bounded normalized receipt fields and hashes only.

Existing audited business-day seal blockers remain unchanged: pending,submitted,
rejected,error. Do not remove an unresolved blocker to make the demonstration pass.
Acquire relation locks in the existing seal's lexical subset order before row/advisory
locks. The submission head, protected history, fact and outbox writes are atomic.
Use event names `fiscal.submission.requested`, `.claimed`, `.reconciled`, `.retry_requested`;
do not emit document acceptance or rewrite immutable document status here.

Private SQL functions return JSONB receipts (not a new public API). Request/retry/
reconcile receipt fields are exactly `submissionId,tenantId,propertyNode,documentId,
documentSha256,wireSha256,providerKey,providerExtensionId,providerExtensionVersion,
attemptId,attemptNumber,retryCount,status,disposition,transitionSeq,replayed`.
Disposition is send/lookup/retry/none. Claim returns `{claimed:false,reason}` with
reason busy/terminal/retry_required when no work is available, otherwise exactly
`claimed,action,claimToken,submissionId,tenantId,propertyNode,documentId,documentSha256,
wireSha256,wireJson,providerKey,providerExtensionId,providerExtensionVersion,attemptId,
attemptNumber`; action is submit or lookup. Reconcile accepts the exact normalized
transport_result/lookup_result event shape already defined in the private reducer,
including complete tenant/provider/document/payload/attempt binding and bounded
terminal authorityRef/responseSha256. Only the registered adapter may construct this
event after verification; a test fixture is never production provider certification.

Private owner-only SQL helpers may use the `india_fiscal_submission_` prefix and
must revoke all PUBLIC/app_role/yellow_runtime execution. Do not expose generic JSON
serialization, receipt append or source-projection functions as caller capabilities.

## Exact editable scope

```text
handoff/questions/199-durable-fiscal-submission-admission.md
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/drafts/order440/0078-fiscal-submission-durability.sql
src/contexts/tax-fiscal/fiscal-submission-repository.ts
src/contexts/tax-fiscal/fiscal-submission-worker.ts
tests/fiscal-submission-durability.integration.test.ts
tests/fiscal-submission-worker.test.ts
docs/CONTRACTS.md
docs/STATE-MACHINES.md
docs/EVENTS.md
handoff/reviews/440-fiscal-submission-lifecycle.md
DECISIONS.log
handoff/LEDGER.md
```

No canonical migrations/SCHEMA/seed/grants outside the draft, HTTP/index/server wiring,
new dependency, provider registration, retained hotel DB or local deployment. The SQL
draft may run only in a verified separately named disposable `yellow_order440_*` proof
database cloned from a pristine migrated77 template, never the template itself. Its
future canonical migration/catalogue/CI admission follows executed complete proof.

Acceptance requires legacy-preserving apply, real native issuance, exact wire parity,
permissions/tenant/property/role denials, replay/conflicts, at least100 concurrent claims,
crash/lease recovery, unknown outcome lookup, bounded explicit retries, stale/terminal
receipt conflicts, atomic rollback, immutable financial census, retained history,
pool settlement, seal-lock concurrency, exact schema and referee11/11. Non-implementer
personally executes proof. No claim of full440 or Phase7 until the whole order closes.
