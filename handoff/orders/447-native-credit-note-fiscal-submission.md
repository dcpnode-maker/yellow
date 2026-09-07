# Order447 — Native credit-note fiscal submission and signed receipts

**Status:** ACTIVE, non-UI implementation admission; no database or provider activation.
**Owner:** Codex coordinator. **Phase:**7. **Date:**2026-09-08 (Asia/Kolkata).
**Authority:** PROJECT.md, Q187/D1302, founder functional-only directive D1426.
**Predecessor:** independently verified Order446 native full-credit backend,
canonical0087 SHA256c8b4ada5702807a0705a13e888e95730e0dbcc8ac7796e0ad2358208a5f873ba.

## Complete outcome

An authorized user can request fiscal registration of a genuinely issued full
credit note through the existing document submission API. The existing worker
sends the exact stored-source CRN wire, verifies the provider-signed invoice and
QR against that wire, persists the immutable receipt and exposes it through the
existing authorized receipt GET. Retry, uncertain-send recovery, durable replay,
provider-version binding and crash/lease behavior remain the existing engine.
Do not create a second ledger, submission table, queue, HTTP API or numbering path.
Never change original invoices, credit journals, postings, numbers or source hashes
while reporting. Genuine synthetic signed-provider proof is required; it is not
authenticated external IRP acceptance or a reason to enable a real provider.

## Existing gaps and exact contract

Canonical0087 credit content contains the original seven invoice sections plus
RefDtls.PrecDocDtls with exactly one original InvNo/InvDt, and YellowCredit with
originalDocumentId, originalSha256, reason, correctionJournalId, sourceEvidenceHash.
DocDtls.Typ is CRN and its number/date belong to the new C-series document. Amounts
are the original positive exact tax/consideration magnitudes; accounting reversal
is already completed by446. No new tax calculation or negative provider amounts.

The current TypeScript wire projector accepts only seven-section INV. Extend it
to this one exact nine-section native CRN source, retaining every current INV byte
and denial. Validate all five YellowCredit fields and the source hash, but OMIT
YellowCredit from provider wire. Do not transmit internal UUIDs, source hashes or
the internal reason. Emit the preceding reference exactly; no supplied arbitrary
RefDtls/other document types/imported credit origins. Plain copied markers are
never database authority: SQL separately authenticates the immutable credit binding,
its exact original native origin, planned credit document and completed correction
graph. Keep JSON/accessor/proxy/duplicate-key/Unicode/size/depth/366-item/int64 guards.

Use the existing read-only owner-private SQL projection capability. Its INV branch
must remain byte-identical. The new CRN branch requires the same tenant/property,
issued status, exact document/content hash and complete native credit binding;
authenticate original and correction identities without weakening tenant RLS or
requiring a fictitious invoice-origin row for a credit. Strip only YellowCredit
after its full exact native-source validation, never by accepting arbitrary extras.
Prefer shared existing scalar wire validators, not a second divergent serializer.
No generic runtime DML, new GUC bypass, broad grant or mutable adoption shortcut.

Signed receipts must bind credit DocTyp/number/date/GSTIN/totals, all original wire
fields and the preceding invoice number/date. Missing, substituted, reordered,
duplicated or mismatched references fail closed. Provider-added nullable fields
may be accepted only within the existing pinned profile; do not relax INV handling
or allow extra reference semantics. Existing signature algorithm/key/issuer/time,
QR hash, IRN/Ack and durable receipt guards remain exact. No signature mocking in
the final integration proof.

## Primary-source basis and limits

Checked2026-09-07UTC: [GSTN IRP6 validation guidance](https://einvoice6.gst.gov.in/content/validation-rules-for-e-invoicing-that-you-must-take-care-to-avoid-errors/)
identifies CRN as credit-note document type. The
[Clear official schema](https://docs.cleartax.in/cleartax-docs/e-invoicing-api/e-invoicing-api-reference/resources-and-master/e-invoice-object)
defines RefDtls.PrecDocDtls as an array and identifies preceding InvNo/InvDt.
Yellow's exactly-one-reference and private-metadata stripping are scoped technical
choices derived from its approved single-original full-credit operation, not a
claim that every IRP credit requires precisely one reference.

Direct NIC and IRP developer-console pages timed out during this check. Existing
Q206 pinned ClearIRP protocol remains authoritative for the selected transport;
do not substitute commercial-gateway endpoints or claim new provider certification.
The schema page's older turnover/date advisory is not current eligibility evidence.
Taxpayer eligibility/reporting age/provider availability remain separate decisions;
the [IRP6 current notices](https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/)
must not be replaced with old schema-page regulatory text. No legal cutoff, new
tax rate or exemption is being implemented by this order.

## Scope and ownership

Initial lane A (typed builder):
- src/contexts/tax-fiscal/india-irp-issued-wire-candidate.ts
- src/contexts/tax-fiscal/india-irp-signed-receipt-binding.ts
- tests/india-irp-issued-wire-candidate.test.ts
- tests/india-irp-signed-receipt-binding.test.ts

Initial lane B (SQL builder after coordinator handoff):
- handoff/drafts/order447/0088_native_credit_fiscal_submission.sql
- tests/india-native-credit-submission.integration.test.ts
- tests/india-native-credit-submission-upgrade.integration.test.ts
- tests/fixtures/india-native-credit-submission-fixture.ts

Coordinator integration scope (only if exact existing composition requires it):
- tests/india-native-credit-operator-origin.integration.test.ts (Q222 preparation-interface compatibility)
- handoff/questions/222-credit-operator-origin-proof.md
- tests/india-native-credit-provider-journey.integration.test.ts (Q219 dedicated current proof; historical suites remain unchanged)
- handoff/questions/219-credit-signed-provider-journey-proof.md
- src/contexts/tax-fiscal/fiscal-submission-repository.ts
- src/contexts/tax-fiscal/fiscal-submission-delivery-runtime.ts
- tests/fiscal-signed-provider-journey.integration.test.ts
- tests/fiscal-signed-receipt-durability.integration.test.ts
- tests/operator-fiscal-submission.integration.test.ts
- docs/CONTRACTS.md, docs/EVENTS.md, docs/STATE-MACHINES.md
- docs/PROJECT-STATUS.md, DECISIONS.log, handoff/LEDGER.md
- this order and handoff/reviews/447-native-credit-note-fiscal-submission.md
- .yellow/evidence/order447/ (bounded private evidence only; excluded from Git)

Before editing a named path, confirm that it exists or is the intended new file;
if actual filenames or necessary scope differ, raise a scoped written question.
No edits to0087 or predecessors, build-frontier/schema/release files, provider
configuration, live app, UI, credentials, deployment, database creation or shared
roles are authorized yet. Canonical0088 and readiness/release promotion require
separate exact scope after executed draft proof. Preserve frozen446 publication
inputs while447's disjoint source work proceeds; never mix447 into its exact tree.

## Acceptance

1. Red/green exact INV compatibility and bounded CRN source/wire/signature tests;
   strict all-reference/metadata mismatch, malformed data and forbidden DBN guards.
2. Genuine invoice→446credit→existing request→real worker→cryptographically signed
   synthetic provider→durable authorized GET, including byte-identical replay.
3. Tenant/property/permission/provider-version isolation, hostile forged/unbound
   credit, concurrent requests, uncertain-send/no-blind-resend, process/lease
   recovery, pruning and both terminal states with immutable financial fingerprints.
4. Exact same CRN projection bytes in SQL and TypeScript, original INV equivalence,
   compatibility with existing v2 and operator-v3 preparation interfaces (both
   retain native origin source_version=2), no account/number/posting mutation.
5. Populated87→88 preservation/atomic rollback, clean current schema/referee11/11,
   independent personal high-risk proof, nonvisual standing and exact-source CI.

All database execution needs an exact admitted target/source/preservation plan.
Do not start generic integration bootstrap on the shared native cluster. No
authenticated provider call, credential request or spending is needed to implement
and test this bounded synthetic workflow. External certification stays open.

## Bounded native proof prerequisites — coordinator admission

Read-only preflight2026-09-07T19:04UTC proves canonical87/c8b4 on both existing
databases: candidate yellow_order446_credit_upgrade_20260907 and rollback target
yellow_order446_referee87_20260907. Both have129tables/119RLS/119policies/28forced/2views,
the exact owner-private original projector and no app/runtime EXECUTE. Candidate
has15 permission rows/377 total rows; rollback target has19/1261. Both lack two
existing adjustment dictionary codes and the fiscal_provider extension-type row.

Admit preparation of an explicit proof-only prerequisite mode inserting exactly
financials.adjustments:write and financials.adjustments:post-seal with descriptions
from the existing446 fixture, and exactly fiscal_provider with the canonical
LAUNCH_EXTENSION_TYPES schema, on these TWO named proof databases only. Require
absence before insertion; never overwrite/adopt divergent existing values. Verify
all old table-row hashes, full1–87 ledger, catalogue/function/ACL/config hashes;
the only allowed added rows are those three exact dictionary rows per target.
No grants, role changes, template/outside database or existing tenant changes.
This does not grant permissions to any hotel operator or configure a real provider.

The candidate may then install the complete frozen unapplied0088 draft within
one transaction, preserving every row and ledger87. The other87 target retains
the original projector for whole-draft and actual production-migrator deliberate
PZ447 rollback proofs. Synthetic test cohorts may be added only through the
named tests; old rows and all outside identities must remain unchanged. Separate
hash-pinned root ExecuteAfterHandoff is required for every write mode after full
helper/source inspection. Prepared mode alone is not execution authority.

Q219 crypto fixture ownership is split explicitly: SQL builder freezes the
existing fixture section while the typed journey builder appends only Order447
real encrypted/RS256 synthetic-provider helpers. Historical provider fixtures
and production behavior are unchanged. Refresh source pins after that append.

Root full-read execution handoff2026-09-07T19:22UTC pins native source snapshot
`.yellow/evidence/order447/native-logs/20260907-191948-765-preflight.json`
SHA256cb1e6db8a36c5aad505f656113183ad58aa8928571a9e52d19387a924881ccc0.
All11 source hashes match on recheck, including helper4b633e2e/f444bf7d,
draft214754e9, fixturead6494fd and journeyc9f56db3. Root personally read the
complete helpers, draft and tests; independently executed typed/crypto/transport
57/0(743) and same-factory positive/hostile protocol1/0(6), with four explicit
DB skips. The reported missing tenant predicate was a reviewer misread and was
retracted after exact line49 verification; it is not a defect or a code repair.

Root may execute Prerequisites now, then InstallDraft only if its exact three-row
per-target deltas and preservation pass. Synthetic SqlTests, UpgradeProof and
Journey follow separately with the same source pins; any source drift or genuine
failure stops that execution pending bounded repair and a fresh admission. No
canonical88, provider activation, liveapp or outside database action is admitted.

Prerequisites executed2026-09-07T19:23UTC with exact3 inserted dictionary rows per
target and unchanged old rows/catalogue/ACL/ledger/outside/template/live identities.
Attempt evidence SHA2564fd60b4901a87ec113b8c6076330f929416736f9640f3d16744f0e54fa3c54e5.
Root separately compares BOTH complete actual attempt baselines to the reviewed
cb1e6d preflight: exact equality. Independent review identified a prospective
helper gap: that equality was not enforced before writes. A scoped helper repair
must pin and compare reviewed target snapshots before subsequent modes. There was
no actual target drift adopted in this execution. Do not rerun prerequisites or
overwrite their retained evidence; fresh preflight includes the admitted additions.

The repaired helper pair ba75251d/e114f060 is fully read by root; pure comparison
proves one exact positive and eight target-only drift denials with zero connections
or effects. New reviewed preflight192842-781 SHA256b541a394d4546a217dad8aa53217f82cb946fdae7b3d892b442cb0d0315d5925
pins all11 unchanged sources plus BOTH complete targets including the prior
three-row additions. It supersedes the old execution baseline. Root admits
InstallDraft with this exact snapshot/hash; no prerequisite replay. Later tests
must each use a freshly checked snapshot after the previous admitted mutation.

Independent first actual proof: SqlTests8/0(81), whole-draft and production-runner
rollback1/0(15). Journey2/1(60) reaches signed acceptance and durable authorized
GET, but its final same-request-key assertion incorrectly expects the mutable
accepted head. Canonical0079/Q205 deliberately replays the immutable original
pending/send/sequence1 command receipt. Root reads exact failed log33189d24 and
0079 lines89/104, then repairs only that test to compare the whole original receipt
with replayed=true, separately retaining current accepted head/GET assertions.
New test SHA256c2a6c9b4f56a683091e4c3c34bc81b8e8fe7a4ab055df29a63e9e6ec47c09646;
types and source-only crypto1/0(6) pass with four explicit database skips.
All other pinned sources remain unchanged. Admit a new reviewed preflight followed
by independent Journey only, preserving prior failed cohorts and evidence. No
product fix, SQL alteration, receipt-semantics change or weakened assertion.
