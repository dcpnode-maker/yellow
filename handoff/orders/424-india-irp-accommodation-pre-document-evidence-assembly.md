# Order 424 — India IRP accommodation pre-document evidence assembly

**Status:** INDEPENDENTLY APPROVED — CLOSED — D1274
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order423 coordination head `e729666`
**Risk tier:** 3 — statutory fiscal-payload composition
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that combines approved Orders419,
420, 422 and 423 into an explicitly incomplete, non-submit-ready IRP accommodation
pre-document evidence assembly. It proves cross-section coherence without representing
itself as a provider payload, fiscal document or invoice.

## Natural-Solution Test

The four approved composers already produce exact transaction, party, room-night item
and invoice-value evidence from the same Order413 source. One internal assembly is the
smallest safe integration proof. Current evidence deliberately lacks issued DocDtls
and governed Qty/UQC, so readiness must remain false and those omissions explicit.

## Exact contract

`composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input)` accepts only the
same exact deeply frozen `{tenantId,source}` input as Orders419/420/422/423, invokes
all four approved composers independently, and returns exact fixed-order:

- state `incomplete_non_submit_ready_irp_accommodation_pre_document_evidence`;
- format `irp_json_1_1` and `submissionReady:false`;
- exact outer key order `state`, `format`, `submissionReady`,
  `explicitlyExcludedEvidence`, `sections`, `sectionsJson`, `lineage`,
  `sourceEvidenceHash`, `evidenceHash`;
- `explicitlyExcludedEvidence:["DocDtls","ItemList[].Qty","ItemList[].Unit"]` as
  known governed omissions that keep readiness false, not an exhaustive provider
  validation result;
- `sections` in exact key order `Version`, `TranDtls`, `SellerDtls`, `BuyerDtls`,
  `ItemList`, `ValDtls`, with `Version:"1.1"` only as the fixed assembly-format
  discriminator authorized by both formatted child results, plus canonical
  `sectionsJson`;
- lineage in exact key order `sourceEvidenceHash`,
  `transactionDetailsEvidenceHash`, `partyDetailsEvidenceHash`,
  `itemCandidatesEvidenceHash`, `invoiceValueEvidenceHash`, then the common outer
  source hash and one tenant-bound deterministic final evidence hash.

All child source hashes must equal the supplied Order413 hash. Orders422/423 formats
must equal `irp_json_1_1`; Orders419/420 are intentionally formatless. Order423
`TranDtls.SupTyp`, Orders419/420 supply-type and currency, every Order419 per-item
component family, Order420 lineage family/item count/item-candidate hash and every
item-source backlink must agree at their actual approved locations. No financial or
tax value may be recalculated, rerounded or defaulted. The result is deeply frozen
and tenant-hidden.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-pre-document-evidence-assembly.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Exact shape/order/JSON and explicit false readiness/exclusions are stable; a
   recursive structural key census proves no `DocDtls`, `Qty`, `Unit` or uninvented
   optional field occurs without confusing legitimate text values for field names.
3. Exact 5/12/18-percent IGST, CGST+SGST and CGST+UTGST across one, multiple and 366
   nights remain byte-exact child projections with coherent totals/families/counts.
4. Each child composer is separately demonstrably load-bearing under permanent
   transaction, party/POS, item and value hostile mutations.
5. Cross-child hash/count/family/currency/supply-type mismatches reject; input remains
   unchanged; replay is byte-equivalent; output is deeply frozen and tenant-hidden.
6. Orders413–423, schema/catalogue/referee, standing and static gates remain green;
   a fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no submission-ready or provider-payload claim; no DocDtls,
Qty/UQC decision, optional-field inference, tax/rate/value recalculation, document/
series/number/hash-chain/issue, provider/submission/IRN/QR, API/UI/seed/runtime/local/
deploy/merge/push, Phase7 or application-completion authority.

## D1273 repair evidence

The three D1272 nested-lineage corruptions were first preserved as subprocess-isolated
permanent probes and failed independently (`6 passed, 3 failed`). Production now checks
the Order423 transaction, Order422 party and Order420 value nested source hashes against
the common Order413 source while retaining every Order419 item-source backlink.

After repair: focused `10/0` (76 assertions), IRP composition `91/0` plus 7 expected
database skips (1,015 assertions), standing `1406/0` plus 1,054 expected skips (20,471
assertions; 2,460 tests/458 files), typecheck, 157 boundaries, 23 licences, audit zero,
image pins and diff are green. A different fresh non-implementing Tier-3 reviewer must
still execute the complete proof.

## D1274 independent rereview

A different fresh non-implementing Tier-3 reviewer approves exact repaired candidate
`e4618d1`. The reviewer independently corrupted all four actual nested source-lineage
locations while preserving each child outer source hash; Order423 transaction,
Order422 parties, Order420 values and one Order419 item each rejected. Removing the
three repaired guards made the permanent focused proof red `5/4`; byte-exact restored
production passed focused `10/0`. Separate transaction, party, item and value projection
mutants were red `8/1`, `8/1`, `7/2` and `7/2`. Standing `1406/0` plus 1,054 expected
skips and all required static, preservation, scope and diff gates pass. Approval is
strictly bounded to this incomplete, false-readiness pure evidence assembly.
