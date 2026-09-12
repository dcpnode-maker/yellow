# Question253 — Source of an additional charge on an issued invoice

**Status:** OPEN — founder business-policy decision required.
**Raised:** 2026-09-13, after resumed current91 build and Phase7 source inventory.

## Decision needed

Q187/D1302 already approves native invoice/credit/debit origin, separate gapless
series, immutable original records, exact component totals and authorized current-day
corrections. None of those decisions identifies the additional economic source for
a debit note. Order446 implements a full inverse credit, not an extra charge; its
negation algorithm cannot safely be reversed to charge the original invoice again.

## Recommended policy for approval

Use separately approved incremental charges, not a replacement invoice total:

1. Each debit note consumes one immutable approved positive adjustment explicitly
   linked to one original native India accommodation invoice. The adjustment must
   describe the shortfall in that original supply, not unrelated new services.
2. Persist and validate the adjustment's exact consideration and ordered tax-component
   differences through the governed valuation/tax path. The browser cannot provide
   authoritative totals; do not simply tax the increment at today's rate or reuse
   the original rate when corrected valuation changes its applicable slab.
3. Each adjustment can be used only once. Multiple separately approved adjustments
   may produce separately numbered debit notes against the same original invoice;
   concurrent issuance cannot charge an adjustment twice.
4. The original invoice and postings remain unchanged. Only the validated extra
   guest/revenue/tax amounts are posted atomically with the D-series document,
   original-reference binding, immutable audit/outbox and durable retry receipt.
5. Preserve tenant/property/supplier/buyer/currency/tax-treatment boundaries and the
   existing current-open-day/post-seal actor rules. Do not combine invoices or
   parties, infer an amount from a reason, edit a sealed day or authorize refunds.

Approval of this policy would allow a scoped implementation contract, not automatic
issuance, provider activation or waiver of independently executed financial tests.
Partial credit, tax-only/mixed-sign correction and correction of a credited/debited
chain remain explicitly bounded follow-up contracts, not silently claimed complete.

## Evidence and scope distinction

- `handoff/questions/187-phase7-fiscal-document-origin-and-numbering-policy.md`
  clauses1–7 and `DECISIONS.log` D1302 are unchanged.
- `handoff/orders/446-india-native-fiscal-full-credit-note-issuance.md` admits only
  full credit; D1427, D1432, D1436 and D1440 retain the debit source boundary.
- Existing debit-series configuration/discovery allocates no document and supplies
  no consideration/tax source. No debit issuer, debit test suite or debit migration
  exists in current source.
- CBIC's [current Section34](https://taxinformation.cbic.gov.in/content-page/explore-act/1000304/1000001)
  describes debit notes for value/tax shortfalls. It does not choose Yellow's internal
  adjustment-record model; the recommendation above is a product/business choice,
  not a claim that this data model is mandated by law. Consult the applicable tax
  professional for jurisdiction-specific operational compliance.

No debit implementation or financial data mutation is authorized by writing this
question. The separate Order465 print-compatibility repair can proceed meanwhile.
