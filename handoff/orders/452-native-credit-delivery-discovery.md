# Order452 — Native credit document fiscal-delivery discovery

**Status: BUILT — independent native and canonical89 proofs pass; full standing/publication pending.** Admitted 2026-09-08 under the founder's functional-build-only directive. Root executed rollback3/0, SQL11/0, signed HTTP3/0, populated88→89/no-op, clean schema equality/referee11/11 and30 readiness denials/restores through separate Q241 handoffs. This order alone grants no database or live-app execution authority. UI/UX remains paused.

## Outcome

An authorized caller with an issued credit document UUID can retrieve its existing
durable fiscal-delivery state and signed receipt without retaining a submission
UUID. GET `/api/v1/properties/:property/credit-notes/:creditDocument/delivery`
requires BOTH current `tax-fiscal.documents:read` and `tax-fiscal.submissions:read`
for that property. Neither permission implies the other. Missing credit and missing
submission cannot bypass current database authorization.

This is read-only discovery, not issuance, submission, retry, provider selection,
IRP cancellation, tax calculation, debit-note accounting, printing or UI work.
Q187/D1302 supplies immutable native document principles; D1427/Order446 supplies
full-credit binding; D1429/Order447 supplies genuine CRN delivery and signed receipt
semantics. D1432 explicitly retains the separate DBN economic-source boundary.
No new founder business-policy decision is required for this read-only operation.

## Existing boundary and minimal implementation

0081 deliberately restricts app_role fiscal_submission SELECT to tenant_id,
document_id,status and removes history SELECT. A service cannot discover submission
id/property/delivery_version directly. Existing0082 by-document discovery requires
an invoice-origin binding, while0086 signed receipt reading needs an already known
submission UUID. Do not use outbox/fact payloads or broader column grants to bypass
that design. See the implementation contract below for the complete four-UUID contract.

Add only `read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)` in
forward0089. It is an owner-mediated SELECT-only capability with explicit current
authority BEFORE absence, genuine credit/document/hash authentication, and a
bounded two-head lookup. Zero heads means not_requested; multiple heads mean
ambiguous with no chosen head or receipt. One supported head delegates unchanged
0086 receipt projection; legacy heads remain explicitly unsupported. Existing INV
discovery and generic submission-ID GET behavior remain unchanged.

## Scope and exclusive lane ownership

SQL/proof lane:

- `handoff/drafts/order452/0089_native_credit_delivery_discovery.sql` (new draft)
- `tests/india-native-credit-delivery.integration.test.ts` (new)
- `tests/india-native-credit-delivery-upgrade.integration.test.ts` (new)
- `tests/fixtures/india-native-credit-delivery-fixture.ts` (new wrapper reusing
  existing446/447 genuine issuance and encrypted protocol exports; no historical
  shared fixture rewrite)

Typed/API lane:

- `src/contexts/tax-fiscal/india-native-credit-delivery.ts` (new)
- `src/commands/read-india-native-credit-delivery.ts` (new)
- `src/contexts/tax-fiscal/index.ts` (narrow exports)
- `src/http/operator.ts` and `src/app.ts` (one GET only)
- `tests/india-native-credit-delivery.test.ts` (new)
- `tests/operator-native-credit-delivery.integration.test.ts` (new)

Root release integration, only after frozen draft proof:

- `migrations/0089_native_credit_delivery_discovery.sql` (exact tested draft bytes)
- `src/kernel/build-info.ts`
- `tests/build-readiness.test.ts`, `tests/build-readiness.integration.test.ts`
- `tests/schema/expected.sql` (generated from executed canonical89 only)
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`
- `tests/runtime-database-authority.integration.test.ts`
- `tests/security-definer-containment.integration.test.ts`
- `tests/setup-current-catalogue-oracle.test.ts`
- `tests/native-fiscal-release-containment.integration.test.ts`
- `tests/fiscal-retry-readiness.integration.test.ts`
- `tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts`
- `tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts`
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- `scripts/local-review.sh`, `setup.sh`, `setup.ps1`
- `tests/free-host-arm64.test.ts`, `tests/release-workflow.test.ts`,
  `tests/fiscal-replay-workflow.test.ts`

Root-owned governance scope: this order; `handoff/reviews/452-native-credit-delivery-discovery.md`; `docs/PROJECT-STATUS.md`; `docs/CONTRACTS.md`; `DECISIONS.log`; `handoff/LEDGER.md`; the existing orders and reviews449/450/451 for the published checkpoint; and `handoff/questions/241-credit-delivery-native-target-admission.md` for exact later native targets. Private future proof helpers remain under `.yellow/evidence/order452` after
separate full-read execution admission. Any other path requires a scope amendment.

## Executable acceptance

1. Pure red precedes implementation. Exact snapshot input/result shapes reject
   extra/duplicate selectors, getters/proxies, wrong row count, foreign identities,
   malformed union variants and corrupt signed receipt metadata with no DB call or
   partial success. Reuse existing receipt validator, never duplicate it.
2. Personally executed separate-login native tests use genuine invoice -> full
   credit. Prove not_requested, pending/lookup/retry binding, signed accepted CRN,
   authenticated rejected terminal, and retrieval after owned published-outbox
   pruning. Retrieval must make zero provider calls or SQL writes and return the
   same0086 receipt values. No outbox dependency or newly inferred retry authority.
3. Prove BOTH permissions independently at HTTP and direct runtime app-role SQL:
   document-only, submission-only, neither, revoked actor, revoked role permission
   and revoked property membership, each on existing AND absent UUID. Authorized
   missing/foreign objects are concealed; wrong-property grants cannot transfer.
4. Defensive ambiguous/legacy variants fail closed and retain pure-boundary
   coverage. Canonical0078 requires legacy property_node NULL; canonical0079
   refuses a second tenant/document head irrespective of provider. Prove those
   real exclusions and second-provider denial without fabricating impossible CRN
   lifecycle states. See Q241 for the source-grounded reachability clarification.
   Malformed storage proofs are isolated rollback-only fixed-cohort test helpers,
   never production mutation hooks; exact execution still requires root handoff.
5. Production runner performs real populated canonical88->89 upgrade, preserves
   every prior row and ledger checksum, and proves exact no-op. Injected late
   migration failure rolls back new function and ledger together. Clean canonical89
   schema equals upgraded schema; unchanged seed/referee is11 passed/0 failed.
6. Runtime readiness denies canonical88 and altered new signature/body/owner/ACL/
   configuration, accepts only restored exact89. All earlier private-projector,
   credit and invoice checks remain. Independent reviewer personally executes these
   proofs; implementation results alone are not D84 acceptance.

Native databases, ports, protected credential loading, cohort/global-code ownership,
outbox-pruning eligibility and complete before/after preservation require a NEW
explicit target admission. No retained database or fixture is admitted by this order. No Docker/WSL, new cluster, global role, live app or runtime promotion.

## Release consequences

Frontier88->89; one public function and one narrowly authorized EXECUTE capability.
No tables/RLS/policies/views/permission-dictionary additions: expected structural
counts remain129 tables/119 RLS/119 policies/28 FORCE RLS/2 views, clean permission
dictionary15. Actual execution must confirm them; proof-only21 permissions are not
clean-seed truth. Normalize schema from real canonical execution, not a text patch.

Keep historical86->87,87->88 and older prefix tests exact. Retain fixed current88
Order447 CI proof as a genuine prefix88 suite instead of relabeling its frozen
guards to accept89. Add dedicated current89/upgrade88 targets and mandatory452 test
flags. Advance only genuine full-current setup/release/oracle assertions. Any CI
block that currently runs all migrations into an88-labelled target must explicitly
use the preserved88 prefix or be separately renamed with its dependent fixtures;
do not introduce permissive88-or89 checks. Exact candidate standing/CI and safe
selective publication remain root-owned after proof; no main merge is granted.

## Implementation contract

Binding contract admitted before implementation; executed results are recorded
in the current status above and the separate Order452 review.

## Authority and predecessor evidence

- Q187 clauses1/5/7: native immutable originals, separately numbered corrections,
  server-owned authority (`DECISIONS.log` D1302).
- 0087:155–209 private `assert_india_native_credit_authority` checks governed
  runtime session/role/tenant, active actor and tenant, INR property, tenant-coherent
  user role, each requested permission and ancestor scope. With p_lock=false it
  performs no locking or mutation.0087:562–569 public credit reader requests only
  document-read permission; it cannot stand in for submission-read permission.
- 0081:662–664 protects head columns/history.0082:177–218 discovers only invoice
  origins;0083/0084 correct aggregate/role details without broadening document kind.
- 0086:48–118 is the sole current signed receipt projector; reuses canonical retry
  binding.0088 changes only private CRN wire projection. Do not modify these bodies.

## Exact SQL surface

Function name: `public.read_india_native_credit_delivery_by_document`.
Parameters in order: `(p_tenant uuid,p_property uuid,p_actor uuid,p_document uuid)`.
Result: one nullable jsonb value, no SETOF/table or default/variadic arguments.
Language plpgsql; VOLATILE; SECURITY DEFINER; CALLED ON NULL INPUT; PARALLEL UNSAFE;
not leakproof; owner yellow_owner; search_path pg_catalog,public,pg_temp; TimeZone
UTC; DateStyle ISO,YMD. Only owner and app_role EXECUTE, no grant option/PUBLIC or
direct yellow_runtime grant. No table/column/default ACL changes.

One tagged template query from the service:

```sql
SELECT public.read_india_native_credit_delivery_by_document(
  $1::uuid,$2::uuid,$3::uuid,$4::uuid
) AS delivery;
```

Function execution order:

1. Always call the existing owner-private assertion FIRST with exactly
   `ARRAY['tax-fiscal.documents:read','tax-fiscal.submissions:read']` and default
   p_lock=false. This is not conditional on a credit/submission row. Wrong runtime
   identity/context or missing current authority raises42501, even for absence.
   Then reject null p_document with22023. No client-supplied permission list.
2. Select one binding by tenant/property/document through its existing unique
   key. No row => NULL. If binding exists, separately require its document and
   original origin/document; a broken local join is55000, not NULL. Require issued
   credit_note, matching tenant/property/document/series/date, original-origin ID
   and original document ID, native_current_transaction_graph origin, correction
   journal identity and original/credit hashes.
3. Use the existing immutable planned_document as exact row binding: require
   `to_jsonb(document_row)=credit.planned_document`. Recompute the credit hash using
   the established0087 rule `encode(digest(convert_to(document_row.content::text,
   'UTF8'),'sha256'),'hex')`, not raw HTTP JSON, hash-chain concatenation or current
   price data. Bind DocDtls.Typ=CRN and the five YellowCredit values to the credit
   row/original (originalDocumentId,originalSha256,reason,correctionJournalId,
   sourceEvidenceHash). Bind preceding invoice number/date to the original immutable
   invoice and issuance receipt document/hash values. Reject null/missing comparisons
   with IS DISTINCT FROM. Do not rerun birth triggers: their outbox publication
   checks are intentionally incompatible with legitimate later pruning.
4. Owner SELECT from fiscal_submission WHERE tenant_id/property_node/document_id
   match, ORDER BY id LIMIT2. Use india_native_operator_submission_document from
   0082:32; no matching count or unbounded history scan. Include legacy rows and
   every provider; do not silently choose the latest or enabled provider.
5. Zero => not_requested; two => ambiguous. For exactly one unsupported delivery
   version => legacy_unsupported. For one v1 require its immutable document_sha256
   equal verified credit hash, then call unchanged0086 read function with the exact
   selected id. NULL or any tenant/property/document/submission/document-hash/wire-
   hash disagreement =>55000. Return receipt envelope only after these checks.

No prerequisite demands active original issuer or current original buyer data;
current READ actor authority is distinct from historical issuance authority.
Do not claim re-verification of provider signatures at GET time: return the stored
verified receipt through its existing validator; genuine signing proof is upstream.

## Typed and HTTP contract

Input: exact `{tenantId,propertyNode,actorId,creditDocumentId}` canonical UUIDs.
Proposed service `IndiaNativeCreditDeliveryService.read(tx,input)` and helper
`readIndiaNativeCreditDeliveryInTransaction(tx,input)`; outer command uses existing
tenant transaction infrastructure. Snapshot inputs before async work. No browser
tenant/actor/provider/submission/hash selector.

Returned value is null or existing by-document union semantics:

```text
{kind:'not_requested',documentId}
{kind:'ambiguous',documentId}
{kind:'legacy_unsupported',documentId,submissionId}
{kind:'receipt',documentId,receipt: FiscalSubmissionDeliveryReceipt}
```

`ambiguous` is explicit fail-closed discovery, not successful provider selection:
HTTP200 may report that state but contains NO chosen submission, receipt or new
action. No matching-count field or fabricated retry binding. This preserves the
existing by-document discovery state convention without granting retry authority.

Reuse `snapshotFiscalSubmissionDeliveryReceipt` (receipt.ts:258), including accepted,
rejected, cancelled, pending and legacy variants. Validate one driver row via own
data descriptors (driver metadata is allowed), exact wrapper/union keys and input
bindings; freeze output. Do not duplicate lossless money/signature validators or
expose raw provider response. Preserve existing signed strings and receipt values.

HTTP GET `/api/v1/properties/:property/credit-notes/:creditDocument/delivery`;
existing trie may require the established parameter label, with identical URL
semantics. No query/body. Both signed-session scopes and both current property
grants before service; database remains final authority. Success `{delivery}`200,
authorized NULL404, invalid400, authority403, corrupt/unexpected503. All responses
no-store; no idempotency/replay header. Existing invoice/generic receipt routes and
all issuance/provider commands stay unchanged.

## Migration/readiness and proof binding

0089 preconditions: genuine canonical88 ledger/checksum, expected unchanged0086
receipt and0087 private authority signatures/configurations/definitions, absent new
function. Pin executable predecessor hashes during source review, not invented in
this proposal. Full script transactional under production runMigrations; no manual
ledger insertion. Canonical file is exact independently proved draft.

Readiness frontier89 adds exact new signature/result/flags/configuration/body SHA
and effective ACL check; retain current private projector bodyb34eaf00 and all prior
capabilities. A label or CRN marker is not readiness. Test body, owner, SECURITY
DEFINER, volatility, strictness, search_path, PUBLIC/runtime/table-column grant
drifts and exact restoration. Existing protected-column checks must continue to
reject broad SELECT. Fresh89 and populated88->89 normalized schemas must agree.

Actual native proof must bind every GET to the same immutable credit/hash and
0086 receipt, assert zero SQL/provider writes, and fingerprint all prior financial,
document, submission/history and numbering records. Revocation tests cover both
scopes separately on existing/missing rows. Governed multi-provider ambiguity and
historical unsupported versions need legitimate fixtures, not constraint bypass.
Read after bounded owned-outbox pruning proves durable-head discovery. Any pruning
or synthetic dictionaries/cohorts require explicit separate target admission.
