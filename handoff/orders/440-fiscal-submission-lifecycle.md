# Order 440 — Durable fiscal submission and reconciliation

**Status:** ACTIVE — private contract independently accepted; durable integration next.
Order434's exact candidate is accepted and merged; no provider is activated.
**Phase:** 7, planned sequence item6.
**Owner:** Codex coordinator; bounded internal builders, separate high-risk reviewer.
**Date:** 2026-09-06
**Base:** Accepted Order434 candidate92346674c784b552356934e168d60e4b9650497a,
merged through PR83 as443e3826b47025106d1829fcbb406ce6302fbbba.

## Outcome

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
Amounts/rates are exact decimal strings. Ordinary stored items do not include the
separate compatibility projection's Qty1.000/UnitOTH fields. Thus the provider wire
payload needs an explicit validated projection; do not claim existing content is
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

[Question196](../questions/196-native-closure-status-admission.md) admits the exact
current status/plan/source/test paths listed there. This is recorded build
truth only, not durable integration or runtime activation. Root's additional proxy
inspection exposed validation of snapshots followed by reads of original objects;
the repair now consumes validated snapshots only. Independent Lane A proof passes
14/14 with66 assertions and full typecheck. Its review approves only the private
contract; historical-attempt uniqueness, retry bounds and authenticated provider
normalization remain future integration obligations.

## Subsequent integration admission (not yet a file-edit authorization)

After434 acceptance, coordinator must inspect the actual issued document source and
existing fiscal_submission privileges, then record exact paths/DDL/signatures before
starting durable request/attempt/receipt persistence, the claim/reconciliation worker,
canonical issued-IRP-payload assembly and HTTP/operator reads. Reuse existing source
truth; do not create a second journal/document or assume caller-hashed payloads are
database-authenticated. Do not widen Lane A silently.

Full-order acceptance requires actual native-issued fixtures, tenant/property/actor
denials, concurrent claims, crashes before/after transport, unknown/duplicate outcome
recovery, verified receipt binding, retained audit and immutable document/accounting
census. Migration/schema/11-invariant and independent personally executed proof apply
to that later high-risk integration. Lane A unit tests alone do not close this order.
