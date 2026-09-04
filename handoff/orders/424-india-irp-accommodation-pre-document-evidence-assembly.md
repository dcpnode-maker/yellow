# Order 424 — India IRP accommodation pre-document evidence assembly

**Status:** ACTIVE — OUTPUT CLARIFIED — D1270
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
