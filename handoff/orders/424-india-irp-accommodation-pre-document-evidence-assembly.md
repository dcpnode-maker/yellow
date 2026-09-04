# Order 424 — India IRP accommodation pre-document evidence assembly

**Status:** ACTIVE — D1269
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
- `explicitlyExcludedEvidence:["DocDtls","ItemList[].Qty","ItemList[].Unit"]`;
- `sections` with exact `Version:"1.1"`, `TranDtls`, `SellerDtls`, `BuyerDtls`,
  `ItemList` and `ValDtls` projections, plus canonical `sectionsJson`;
- lineage containing common source hash and each child evidence hash, then the common
  source hash and one tenant-bound deterministic final evidence hash.

All child source hashes must equal the supplied Order413 hash. Formats, B2B code, INR
currency, item count, component family, item-source lineage and Order420's Order419
hash must agree exactly. No values may be recalculated, rerounded or defaulted. The
result is deeply frozen and tenant-hidden.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-pre-document-evidence-assembly.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Exact shape/order/JSON and explicit false readiness/exclusions are stable; no
   `DocDtls`, `Qty`, `Unit` or uninvented optional fields occur.
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
