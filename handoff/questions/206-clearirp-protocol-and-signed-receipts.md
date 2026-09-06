# Question 206 — ClearIRP protocol and immutable signed receipts

**Status:** COORDINATED IMPLEMENTATION, with the exact private decoder lane below
admitted under Order440; remaining protocol/receipt integration is proposed until its
contracts and forward-migration scope are fixed. This record does not authorize a
live provider, registration, account, invoice, spending or deployment.
**Date:** 2026-09-06. **Owner:** Codex coordinator.
**Predecessor:** Q204 exacte4399cf passes all six CI34049699932 jobs and is
independently merged through PR88 as2a0ba41. A separate new post-merge80 database
matches the exact schema and passes the canonical referee11/11. Main is80; the
stable founder preview stays77. This document does not close Phase7.

## Context and intended complete outcome

An accepted invoice needs its provider-signed invoice and signed QR, not merely a
remote reference and response hash. Complete one vertical integration: authenticate
the selected India IRP protocol, submit or recover the exact original invoice,
verify and atomically retain its signed artifacts, and return an authorized
delivery-receipt read model. The full Phase7 product also needs the operator
invoice/print journey and authorized live sandbox acceptance; an API-only slice
must not be called completion of that journey or the whole phase.

Root inspected the existing provider, worker, repository, migrations78/79 and
baseline table. A separate read-only builder cross-checked these sources. A
separate researcher examined public provider documentation. The findings below
distinguish executable facts, published protocol facts and unverified assumptions.

## Verified repository facts

- Native document content/hash and original wire bytes are already immutable.
  Never write provider artifacts into `document.content`, its hash or rendered_ref.
- `fiscal_submission` already has `authority_ref`, `qr_payload`, `response` and
  `response_sha256`. Its accepted/rejected durable head cannot be changed.
- The current worker accepts only normalized outcomes with authorityRef/hash;
  extra receipt/artifact fields are rejected. SQL reconcile stores that normalized
  object in response, not a full signed artifact envelope. qr_payload is not set.
- Append-only fiscal_submission_history retains reference/hash and attempt identity.
  Fact/outbox transitions already carry responseSha256. There is no need to create
  another financial document, queue, journal or mutable source of invoice truth.
- Q205's request/retry receipt is a permanent command response. Its exact POST body
  must not grow with later delivery progress. A separate authorized GET/read model
  is required for current status and signed artifacts.
- Q204 already supplies original issued wire to fresh-worker lookup, bounded
  transport deadlines/cancellation, registered-lane isolation and durable recovery.
- Extension configuration names credential_ref but no real secret resolver or
  provider registration exists. The production registry is deliberately empty.

Source anchors: `migrations/0001_init.sql` fiscal_submission; immutable
`migrations/0078_fiscal_submission_durability.sql`;
`migrations/0079_fiscal_immutable_command_receipts.sql`;
`src/contexts/tax-fiscal/fiscal-provider.ts`;
`src/contexts/tax-fiscal/fiscal-submission-worker.ts`;
`src/contexts/tax-fiscal/fiscal-submission-repository.ts`.

## Primary protocol evidence

Root personally retrieved the public
[ClearIRP specification](https://assets1.cleartax-cdn.com/finfo/wg-utils/retool/c734c4fb-f542-406a-8d93-ae80cbed534a.pdf)
in memory, without saving another local copy. It is63 pages,2,928,387 bytes,
SHA-256 `0f161d15b02d125d90f57f3ff3ff2b21c2ea89f9d4fffeea5876860770baffe6`.
No clear revision date was established. Do not treat this PDF as a live
credential, current tax-law source or certified integration result.

| Pages | Confirmed protocol fact |
|---|---|
| 8–10 | Sandbox onboarding and API credential creation require taxpayer/account verification. |
| 11–14 | POST `<URL>/eivital/v1.04/auth`; client_id/client_secret/Gstin headers; encrypted Data; random32-byte AppKey; AuthToken, Sek and TokenExpiry response. |
| 13 | SEK encryption is AES256 ECB with PKCS7 padding using AppKey. |
| 20–22 | POST `<URL>/eicore/v1.03/Invoice`; encrypted invoice Data; acknowledgement, IRN, signed invoice, signed QR and status response. |
| 22 | SignedInvoice and SignedQRCode use JWT/JWS with SHA256RSA. |
| 48–49 | GET `<URL>/eicore/v1.03/Invoice/irn/{irn}` also returns both signed artifacts. |
| 54–55 | GET `<URL>/eicore/v1.03/Invoice/irnbydocdetails?doctype=...&docnum=...&docdate=...` also returns both artifacts; documented status ACT/CNL. |

These lookup observations are from the **direct ClearIRP core specification**, not
an inference from ClearTax's differently authenticated commercial API gateway.
The `<URL>` placeholder is not a verified environment base URL.

Root separately reads the public gateway GenerateIRN `.md` representation
(18,442 bytes) in memory and decodes the four published compact examples only to
inspect field names. This is **not signature verification** or evidence of current
direct-core behavior. All four sample headers use alg/kid/typ/x5t; outer JSON has
data(string) and iss(NIC). The two invoice inner objects carry AckNo(number),
AckDt,Irn,Version,TranDtls,DocDtls,SellerDtls,BuyerDtls,ItemList,ValDtls. The larger
example also has DispDtls,ShipDtls,PayDtls,RefDtls,AddlDocDtls,ExpDtls,EwbDtls;
the smaller includes ExpDtls. Both item examples include provider ItemNo alongside
SlNo. QR inner fields are SellerGstin,BuyerGstin,DocNo,DocTyp,DocDt,TotInvVal,
ItemCnt,MainHsnCode,Irn; only the second QR includes IrnDt. Therefore do not infer
that IrnDt or every optional invoice field is mandatory from a single sample.
No published taxpayer values/tokens are copied into tests or trusted configuration.

The receipt binder must explicitly define provider-added/default/omitted fields
and exact decimal equivalence, rather than blindly deep-equaling different wire
shapes or ignoring extra financial fields. Provider issuer/date normalization and
signed-envelope schema still require direct-provider confirmation before activation.
Public gateway reference:
https://docs.cleartax.in/cleartax-docs/e-invoicing-api/e-invoicing-api-reference/govt-compatible-apis/generate-irn.md

The official [signed-QR explanation](https://docs.cleartax.in/cleartax-docs/e-invoicing-api/learn-e-invoicing-api-basics)
provides an RS256 sample, points to government certificates, warns keys can change,
and preserves the complete signed JWT as the printable QR payload. Its historical
sample key is not automatically a trusted current ClearIRP key. Public documentation
and examples do not establish our actual key-distribution/rotation procedure.

## ADR-440-206 — reuse durable submission truth

**Status:** Proposed. **Decider:** Codex within the existing technical architecture;
taxpayer authorization, provider credentials and any paid terms remain founder-owned.

### Decision and alternatives

Prefer existing fiscal_submission terminal fields plus a strictly versioned receipt
envelope, bound by exact-byte hashes and existing immutable history. Preserve the
five-argument reconciliation signature and all request/retry receipt semantics.
Use one forward migration only after its exact schema/compatibility scope is admitted.

Alternatives rejected: another invoice/journal duplicates fiscal truth; storing only
hashes cannot render or independently verify receipts; an external object store or
new receipt table adds lifecycle and authorization complexity without demonstrated
need for these bounded artifacts. Existing terminal immutability is a prerequisite,
not a substitute for genuine mutation-denial and replay tests.

Consequences: validate receipt version/size/identity before reconciliation; bind
responseSha256 to exact retained provider bytes and keep separate hashes for the
signed invoice/QR. Do not create an undocumented hash meaning for old rows. A
provider cancellation is not a rejected invoice and cannot rewrite an accepted
terminal head. Any cancellation workflow needs its own explicitly governed effect.

### Independent proposal critique — constraints before admission

The separate read-only builder found the following design gaps. They are not
implemented fixes or new claims about current runtime behavior:

- JSONB is not an exact byte store. The new envelope must name each digest's input:
  raw bounded Invoice HTTP response bytes retained losslessly as base64, decrypted
  Data bytes, signed-invoice JWT bytes and signed-QR JWT bytes. A version tag must
  distinguish this meaning from pre81 hash-only responseSha256. Retaining raw
  encrypted response bytes does not authorize persisting the authentication token,
  AppKey, SEK, API password or secret. Auth responses are never invoice artifacts.
- AckNo can also exceed the safe JavaScript integer range. Reuse/refactor the
  issued-wire lexical validation into an explicitly scoped bounded decoder that
  rejects duplicate decoded names and retains decimal/integer lexemes. Exact
  identity and amount comparison must precede any display conversion.
- Accepted and rejected outcomes need disjoint types through provider, reducer,
  worker, repository and SQL. Accepted requires real IRN plus both verified signed
  artifacts. A rejected submission must not be forced to invent an IRN; define an
  audited rejection receipt with no authority reference when none was supplied.
  Preserve existing historical rejection receipts and their command replay.
- The first submitted-to-accepted transition must require all artifacts, versions,
  hashes and bindings atomically. Partial writes must fail. Audit the effective
  table/column grants and add explicit terminal UPDATE/DELETE denial proof; the
  current UPDATE guard and history foreign key are not enough to assume every
  future deletion route is covered.
- Tenant-only RLS is not property authorization. Existing direct app_role SELECT
  must not expose newly retained sensitive response/QR columns around the new
  actor/property read capability. Inventory actual current consumers, preserve the
  minimal columns they need, and prove both direct sensitive-column denial and
  existing business-day reads. This is a required forward-migration scope item.
- GET has a separate200 read contract, no command idempotency header or Q205
  history-receipt reuse, and explicit legacy_hash_only/pending/rejected/
  accepted_signed_v1 variants. It may advance with delivery; old POST body bytes
  never do. No earlier unsigned row is backfilled or relabelled verified.
- A documented CNL response cannot silently become accepted, rejected or
  known-not-sent. Before activation, define a durable, non-retrying,
  operator-visible discrepancy outcome, without rewriting the issued document or
  inferring authority for a cancellation command. Its exact state/event/read-model
  design remains to be admitted; indefinite silent lookup is not a solution.

### Complete implementation requirements

1. A provider-specific adapter uses confirmed environment URLs and auth/encryption
   rules, the existing AbortSignal/deadline, bounded response collection and no blind
   internal resend. Unknown/not-found/duplicate responses never prove known-not-sent.
2. Validate both signatures against an explicitly configured, versioned trust bundle.
   Pin allowed algorithms outside the JWT, reject unknown keys/critical headers,
   never fetch a token-provided URL/key, and retain verification metadata. Do not
   promote an unsigned caller boolean to fiscal authority.
3. Bind seller, document type/number/date, IRN, invoice items/totals and QR summary to
   the immutable issued wire. Preserve exact monetary decimal tokens; ordinary
   JSON.parse/Number comparison must not round a changed amount into equality.
4. Reconcile a detached, bounded artifact envelope atomically with the existing
   attempt, transition history, audit and outbox. Preserve immutable document,
   accounting, numbering, legacy rows and exact Q205 command replay. No backfill may
   relabel a previous hash-only receipt as signed or verified.
5. Add a separate property-authorized, no-store delivery-receipt read model with
   current permission revalidation. It returns safe status/IRN/acknowledgement and
   authorized signed artifacts, never credentials, claim tokens, raw provider errors
   or unrelated tenant/guest data. Existing POST responses remain byte-stable.
6. Register an adapter only through the same validated immutable registry used for
   runtime readiness and HTTP availability. Missing credentials/trust/config fails
   before activation; extension metadata alone cannot enable transport.
7. Complete independent actual PostgreSQL and protocol proofs before integration.
   Live sandbox evidence remains separate and requires legitimate taxpayer authority.

## Unresolved protocol facts — do not guess

### Repository integration findings2026-09-06 — proposal, not DDL admission

Root's consumer inventory finds one non-fiscal production table read in
`src/contexts/financials/business-day-close-readiness.ts`: its fiscal CTE uses
only fiscal_submission.tenant_id, document_id and status. It joins document for
property/business-date scope and treats pending/submitted/rejected/error as blockers.
These exact three columns are the candidate minimum app-role SELECT grant after
removing the broad table grant. Before migration, also audit functions, views,
policies, triggers and SQL test consumers; do not assume a source search establishes
every effective database dependency. A separate source audit also finds the same
three-column CTE in canonical0064's owner-executed audited seal function and no
additional application-role consumer; actual current catalogue/grant proof remains
mandatory. Raw response, QR, original wire and provider
credentials must not become a property-authorization bypass.

Proposed CNL handling is a versioned `error / none` discrepancy with
`provider_cancelled` reason and retained authenticated lookup evidence. This uses
existing status/disposition vocabulary but needs an explicitly expanded state,
history-outcome and all-or-none constraint contract. It is not `known_not_sent`,
not eligible for retry/discovery, and not an accepted or rejected invoice. Existing
financial readiness already treats error as a blocker; prove this through the real
consumer without changing its business policy. No cancellation request, issued-row
edit or post-acceptance head mutation is implied. The new authorized read must show
the discrepancy and required manual investigation rather than endlessly polling.

The proposed receipt read is a separate tenant/actor/property-checked capability
and HTTP GET. Keep exact Q205 request/retry bytes, replay keys and their historical
helper unchanged; add no command-idempotency header to the GET. Required legacy
variants remain explicitly unsigned/hash-only. Do not use an HTTP status route as
proof of signed fiscal acceptance or expose raw encrypted response bytes by default.

- Exact sandbox/production API origins and current supported versions.
- Authentication RSA padding/encoding details and authoritative encryption key.
- Signing key acquisition, provider/issuer binding, rotation/revocation and trust
  bundle provenance; token kid/x5t are selectors, never trust anchors.
- TokenExpiry/AckDt timezone and exact validation/renewal behavior.
- Documented duplicate/not-found/auth-expiry/rejection codes and lookup horizon.
  The current normalized rejection requires authorityRef, but an unsuccessful
  Generate IRN response may have no IRN. Do not invent an authority reference.
- Provider response/artifact bounds and rate limits. Internal conservative size and
  concurrency bounds must be labelled Yellow policy, not provider guarantees.
- Approved local/deployment secret resolution and actual authorized sandbox account.

Obtain these from primary provider documentation or a legitimate onboarding packet;
do not access denied pages by a bypass, create an account, message support, use real
taxpayer data or spend money as part of this research. Missing live credentials do
not prohibit offline contract work once its exact implementation scope is admitted.

## Proposed editable paths — admission required before code

### Admitted private decoder lane — technical decision2026-09-06

This is an implementation dependency of the complete signed-receipt outcome above,
not a separate phase exit or a substitute for provider/SQL/operator integration.
Root admits only these two new private files while Q204's exact-source CI runs:

```text
src/contexts/tax-fiscal/fiscal-exact-json.ts
tests/fiscal-exact-json.test.ts
```

Coordinator-owned private-lane proof is recorded in the exact new path
`handoff/reviews/440-fiscal-provider-and-receipts.md`; that record cannot approve
unimplemented provider, SQL, signature or HTTP integration.

The existing issued-wire scanner already rejects duplicate decoded names but its
final JSON.parse would round unquoted provider money/AckNo. Do not refactor that
frozen Q204 source while its CI runs. Build a private lossless decoder returning a
deeply frozen discriminated JSON tree: null, boolean, string, number with original
lexeme, array, or object with null-prototype members. Do not coerce numbers, execute
getters, normalize Unicode, or let __proto__/constructor names mutate prototypes.
Reject duplicate decoded names, invalid grammar, trailing input, malformed raw or
escaped surrogate pairs and non-string hostile inputs with sanitized typed Results.

Fixed Yellow resource bounds, not provider guarantees:1MiB exact UTF-8 input,
32 nested containers and100,000 value nodes. Check size before tree allocation;
exhaustion is a distinct bounded failure. Avoid suffix-copying on every number or
otherwise quadratic scans. Numeric exponents remain exact lexical data, never
floating-point arithmetic; monetary interpretation is a subsequent governed step.
Use built-in language/runtime functionality only, no parser package, dependency,
network, database, filesystem I/O, public context export or runtime registration.

Define and test the exact API types in the new module. Intentional red precedes
implementation; cover boundary-minus/exact/plus sizes/depth/nodes, escaped duplicate
keys, prototype names, surrogate handling, negative zero, unsafe integers, huge
exponents and changed-cent values that JSON.parse would collapse. Valid JSON scalar
and nested cases retain type/lexeme and freeze every level. Root did not implement
this builder lane and must personally inspect/execute its proof before integration.
All remaining files below are still proposed; in particular this does not admit
migration81, rewrite applied1–80, activate a provider or alter Q205 POST replay.

Keep this as one coordinated Order440 outcome, not competing worker plans.

### Admitted private JWS verification lane — technical decision2026-09-06

The exact decoder has independent12/12 proof and full standing1686/0 with1264
explicit environment skips. The next concrete receipt dependency is verification
of the unchanged compact token. Coordinator admits only these additional paths:

```text
src/contexts/tax-fiscal/fiscal-signed-jws.ts
tests/fiscal-signed-jws.test.ts
```

Use the existing private exact decoder and built-in WebCrypto RSA verification,
not a new dependency, custom cryptography, HTTP fetcher or runtime registration.
RFC7515 sections3/4/5 and RFC7518 section3.3 establish compact serialization and
RS256 (RSASSA-PKCS1-v1_5/SHA256); they do not authenticate a provider trust bundle.
The production integration must supply a separately authorized bundle. This lane
returns only signature-verified JSON evidence, explicitly NOT fiscal acceptance,
issuer/document binding, certificate-chain validation or provider certification.

Factory input is an unknown **JSON string**, decoded with the exact parser before
snapshotting, with exact shape `{version,keys}`. Keys have exact shape
`{id,spkiDerBase64,notBeforeUnixMs,notAfterUnixMs}` plus optional `x5t`.
Version is1–128 printable ASCII characters; key IDs1–256 printable ASCII, compared
exactly without trimming/normalization. Reject duplicate IDs/SPKI bytes/x5t selectors.
Canonical base64 DER SPKI is imported once as a non-extractable verify-only public
RSA key using SHA256. Accepted modulus sizes2048–4096 bits and exponent65537 are
conservative Yellow policy. No private/symmetric keys, mutable shared inputs or
token-supplied keys/URLs. Bundle validity bounds are exact nonnegative safe integer
milliseconds with start<end; a caller-supplied safe integer verification instant
is checked against the selected key's half-open interval on EVERY verification.
Rotation/revocation replaces the immutable configured bundle; this module does not
discover trusted keys or continue to accept a removed key through another bundle.

Verify only3 nonempty canonical unpadded base64url segments; reject alternate pad
bits, whitespace, padding, malformed UTF-8/BOM, duplicate decoded JSON keys and
non-object headers/payloads. Pin RS256 outside the token; allowed header names are
alg,typ,kid,x5t only, with typ absent or exactly JWT. Reject none/HMAC/PSS, crit,
b64:false, embedded keys/certificates/URLs and every unsupported header. kid, when
present, must exactly name one configured key; x5t, when present, must exactly match
the selected configured20-byte base64url selector. Without kid, x5t may select one
key; without either, only a single-key bundle is unambiguous. An unknown/conflicting
selector never falls back to trying every key. x5t is a selector, never a trust root.

Verify the **original ASCII header.payload**, never reserialized JSON. Bound every
allocation and crypto operation: trust JSON32KiB;1–8 keys; SPKI DER2048bytes/key;
header JSON4KiB; payload JSON1MiB; signature bytes exactly modulusBytes (256–512);
compact input at most1,404,249 characters. These are Yellow limits, not provider
guarantees. Check encoded lengths before decoding. The factory returns a frozen
verifier and sanitized typed errors; verification returns frozen metadata containing
bundle version, selected key ID/SPKI SHA256, original compact token and its SHA256,
exact UTF-8 payload text plus its frozen lossless JSON tree. No getters/coercions,
tokens, payloads, keys or exception detail may appear in error messages or logs.

Intentional red before implementation; generate synthetic test keys using built-in
crypto only. Test genuine RS256, changed header/payload/signature, wrong/expired/
not-yet-valid/removed keys, unknown/conflicting selectors, no-selector ambiguity,
bad SPKI and weak/oversized/other-algorithm keys, exact temporal/size boundaries,
Unicode/duplicate keys/unsafe-number retention, hostile inputs, invalid UTF-8/BOM,
noncanonical base64, immutable outcomes and sanitized errors. Root is independent
of this builder and personally executes adversarial proof. This admission does not
extend existing provider resolution types, SQL, HTTP or the production registry.

Primary references: https://www.rfc-editor.org/rfc/rfc7515 and
https://www.rfc-editor.org/rfc/rfc7518. ClearTax's public signed-QR guidance shows
alg/kid/typ/x5t, but does not establish today's direct ClearIRP trust bundle.

Private-lane implementation checkpoint2026-09-07: both decoder and JWS are built
by native_resume_builder and independently accepted by root after executable
repairs for malformed raw/escaped Unicode, trailing-DER aliases and actual RSA
modulus bits. Final combined proof32/0(301),36 independent additional assertions,
full standing1699/0 with1264 explicit DB/Unix skips(22568;506 files;97.05s), types,
179 boundaries and23 licences pass. See the exact hashes and commands in
the private-lane review. Publication/CI remains separate. No caller can infer
document/issuer binding or provider acceptance from this signature-only result.

```text
handoff/questions/206-clearirp-protocol-and-signed-receipts.md
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-provider-and-receipts.md
migrations/0081_clearirp_india_irp_receipts.sql (prospective; applied1–80 immutable)
src/contexts/tax-fiscal/fiscal-provider.ts
src/contexts/tax-fiscal/fiscal-submission-state.ts
src/contexts/tax-fiscal/india-irp-issued-wire-candidate.ts (bounded lexical validation reuse only)
src/contexts/tax-fiscal/fiscal-exact-json.ts (proposed private lexical decoder)
src/contexts/tax-fiscal/clearirp-india-irp-provider.ts
src/contexts/tax-fiscal/fiscal-submission-worker.ts
src/contexts/tax-fiscal/fiscal-submission-repository.ts
src/contexts/tax-fiscal/fiscal-submission-delivery-receipt.ts
src/contexts/tax-fiscal/index.ts
src/runtime/clearirp-india-irp-registration.ts
src/server.ts
src/app.ts
src/http/operator.ts
tests/clearirp-india-irp-provider.test.ts
tests/fiscal-exact-json.test.ts
tests/fiscal-submission-state.test.ts
tests/india-irp-issued-wire-candidate.test.ts (preserve the existing exact-wire contract)
tests/fiscal-submission-worker.test.ts
tests/fiscal-submission-artifacts.integration.test.ts
tests/operator-fiscal-submission.integration.test.ts
docs/EXTENSIONS.md
docs/CONTRACTS.md
docs/STATE-MACHINES.md
docs/EVENTS.md
docs/PROJECT-STATUS.md
BUILD-PLAN.md
handoff/LEDGER.md
DECISIONS.log
```

Before coding a migration, enumerate the exact fixture, schema/current-frontier,
startup/readiness/catalogue/workflow and migration acceptance files too. This draft
does not authorize a wildcard edit across them or allocate a proof database.

### Admitted architecture-specific verification — 2026-09-07

The non-author PR89 reviewer finds that the existing free-host-arm64 job builds
images and runs migration/referee/login but never imports these private helpers.
Green ARM64 image checks therefore cannot establish their crypto compatibility.
Under Orders440/442, admit exactly `.github/workflows/ci.yml` and
`tests/free-host-arm64.test.ts` to run the decoder and JWS suites explicitly on
the existing native ARM64 runner after frozen dependencies and before image proofs.
Add an intentional-red wiring regression preserving pinned actions, all old gates,
read-only permissions, no publication and unconditional owned-preview cleanup.
No new job/runner/service/dependency, existing timeout increase or platform emulation.
The laptop cannot prove ARM64 execution; new exact-source CI must execute this step.

### Admitted original-invoice/signed-pair binding — 2026-09-07

The next dependency closes the gap between a valid signature and matching the
actual issued invoice. It is still part of the complete provider/receipt/operator
outcome, not a phase exit. Coordinator admits exactly these new private files:

```text
src/contexts/tax-fiscal/india-irp-signed-receipt-binding.ts
tests/india-irp-signed-receipt-binding.test.ts
```

Reuse the unchanged issued-source projector, private exact decoder and pinned JWS
factory. No edits to those reviewed files, public exports, SQL, provider transport,
runtime, dependencies or existing test fixtures. Build with generated synthetic
keys and fictional hotel values; do not copy published taxpayer values/tokens.
Do not edit these files during the coordinator's frozen publication suite.

Factory configuration is an unknown JSON string, maximum256KiB UTF-8, exact keys
`profileVersion,issuer,trustBundleJson`. The only admitted profileVersion is
`yellow_native_india_1_1_v1`; issuer is an explicit1–128 printable ASCII string,
never an automatic NIC/NIC Sandbox default or token-selected value. The embedded
trustBundleJson is passed to the existing factory and its existing32KiB limit.
No injectable verifier or caller-supplied verified boolean/evidence is accepted.
Configuration and time must later come from authenticated runtime policy.

Return a frozen verifier with `verify(input:unknown,verificationUnixMs:unknown)`.
The input is an exact plain/null-prototype record of eight own enumerable data
properties, all strings:
`documentId,documentSha256,contentJson,signedInvoice,signedQRCode,irn,ackNo,ackDt`.
Reject proxies (including revoked), symbols, accessors and prototype surprises
without invoking getters/coercion; snapshot primitives before any await. Cheap
length limits precede work: content1MiB characters with existing projector's
exact UTF-8 bound, each compact token's existing1,404,249-character ceiling,
IRN64 lowercase hexadecimal, acknowledgement1–64 canonical positive decimal
digits and AckDt exactly19 characters. The date is a valid calendar
`YYYY-MM-DD HH:mm:ss` value; no timezone, clock recency or UTC conversion is inferred.
The existing projector independently validates original content/hash/document ID
and produces exact wire/hash; no arbitrary request-supplied wire is authoritative.

Verify both original compact tokens at the same captured safe integer instant
with the internally constructed pinned verifier. Both outer payloads have exact
`data,iss` keys, data is a JSON string and iss equals configured issuer exactly.
Decode each data string with the lossless decoder and all its existing limits.
Do not parse signed amounts/AckNo through JSON.parse/Number. This initial profile
does not claim every direct-provider signed shape is established by public samples.

SignedInvoice requires the seven original wire sections plus AckNo/AckDt/Irn.
Bind every supplied original field, not only amounts selected for display. Object
member order may differ; strings/types/array order may not. Numeric equality is
mathematical decimal equality with no rounding: internally normalize sign,
coefficient and base10 exponent without expanding huge powers. Bound each numeric
lexeme to128 characters and absolute exponent1000; reject negative zero and
unsupported/resource-exhausting forms. Monetary values never pass through Number.
AckNo must equal expected ackNo mathematically and be positive/integral; retain
the exact canonical expected digits, not a rounded number. AckDt/IRN must equal
the supplied expected receipt metadata exactly. The source/tokens remain retained
unchanged regardless of equivalent numeric serialization.

Explicit conservative absent-field allowances are limited to the following
versioned table; an original present field can never be omitted/overridden by it:

| Location | Additional field allowed only when absent from original wire |
|---|---|
| Invoice root | DispDtls,ShipDtls,PayDtls,RefDtls,AddlDocDtls,ExpDtls,EwbDtls: null only |
| TranDtls | RegRev,IgstOnIntra: null or exactly N; EcmGstin: null only |
| SellerDtls/BuyerDtls | TrdNm,Addr2,Ph,Em: null only |
| Item | ItemNo: numeric integer equal to its original one-based SlNo |
| Item | PrdDesc,Barcde,OrdLineRef,OrgCntry,PrdSlNo,BchDtls,AttribDtls: null only |
| Item | FreeQty,Discount,PreTaxVal,CesRt,CesAmt,CesNonAdvlAmt,StateCesRt,StateCesAmt,StateCesNonAdvlAmt,OthChrg and absent IgstAmt/CgstAmt/SgstAmt: numeric zero only |
| ValDtls | CesVal,StCesVal,Discount,OthChrg,RndOffAmt and absent IgstVal/CgstVal/SgstVal: numeric zero only; TotInvValFc: null only |

These are Yellow's conservative compatibility policy, NOT an assertion that a
provider supplies those defaults. Reject every other new/missing/type-changing or
nondefault field, especially extra financial value, rather than silently discarding
it. Unknown signed shapes must remain distinguishable from a signature failure
for later discrepancy handling; authentic provider fixtures may justify a separately
reviewed versioned profile, never a silent weakening of this comparison.

SignedQRCode has exact required keys
`SellerGstin,BuyerGstin,DocNo,DocTyp,DocDt,TotInvVal,ItemCnt,MainHsnCode,Irn`
and optional IrnDt. Bind identities/date to original wire, total by exact numeric
equality, ItemCnt to number of original lines and IRN to the signed invoice/expected
metadata. If IrnDt is present, this conservative profile requires exact AckDt
equality; do not infer a provider timezone/normalization from examples.

Primary [IRIS/GSTN FAQ](https://einvoice6.gst.gov.in/content/faq-powered-by-irisirp/)
and ClearTax e-invoicing basics identify QR main HSN as the code of the line with
highest taxable value, not the largest grouped HSN. Compute maximum original AssAmt
using exact arithmetic. Equal maxima sharing one HSN are unambiguous; distinct HSNs
tied at maximum require unsupported-shape failure pending a documented tie rule.
Use line count, not distinct HSN count. This does not derive or change any tax policy.

Successful deeply frozen evidence contains profile/issuer/verification instant,
document ID/hash, exact wire/hash, IRN, canonical acknowledgement digits/raw date,
and both unchanged signature evidence objects. It explicitly records
`providerAcceptanceEstablished:false` and `authenticatedProviderSandboxCertified:false`.
Authentication, current delivery status/attempt, tenant/property authority, retention
and sandbox acceptance are established by later integration, not this private
helper. No boolean/input data may bypass signature/source/metadata comparison.
All typed failure messages are fixed/sanitized without raw values, tokens or keys.

Intentional missing-module red before implementation. Prove genuine two-token
success for IGST/split and366-line source, numerically equivalent representations,
unsafe changed-cent/AckNo collisions, every identity/line/tax/total/metadata mismatch
using newly signed valid tokens, missing/extra/default-field policy, wrong issuer,
expired/wrong/removed keys, swapped invoice/QR tokens, malformed nested JSON,
decoded duplicate keys, Unicode, huge numeric/exponent limits, source hash mismatch,
HSN maximum/grouping/tie rules, optional IrnDt, input mutation across await,
getter/proxy rejection, deeply frozen output and sanitized failures. Root is
independent of the builder and must inspect/execute this proof before publication.

## Required executable acceptance

Golden protocol fixtures with generated test-only keys and a local HTTP server;
auth success/expiry/abort and bounded streams; wrong signature/key/issuer/claims,
duplicate decoded JSON keys, huge values and decimal-rounding attacks; actual
native-issued submit and fresh-worker lookup preserving exact artifacts; malformed
or missing artifacts never accepted; unknown delivery without resend; stale claims,
concurrency, forced-outbox rollback, late transport and exact replay; terminal
UPDATE/DELETE denial and unchanged financial census; revoked permission and
cross-tenant/property reads; actual80→81 rollback/no-op/equivalence; exact schema,
readiness, full CI and referee11/11, personally executed by a non-implementer.

The complete Phase7 acceptance must additionally prove the authentic sandbox
round-trip and operator invoice/QR rendering/printing from these durable receipts.
