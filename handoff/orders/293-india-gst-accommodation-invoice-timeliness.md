# Order 293 — Compose India GST accommodation invoice timeliness evidence

**Status:** BUILT-PENDING-REVIEW-D778
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-invoice-timeliness`
**Base:** `b5b2d45` (independently approved Order292 descendant)
**Risk tier:** 3 — statutory timeliness composer; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure, deterministic composer that consumes the independently approved
Order290 service-provision date and Order292 invoice issue date evidence, plus an
affirmative externally governed ordinary-Rule47-regime evidence object, to return
only a bounded `timely`/`late` invoice-timeliness result. It must not create data,
issue an invoice, or compute time of supply.

## Exact contract

- no migration, table, writer, API/UI or local promotion;
- `resolveIndiaGstAccommodationInvoiceTimeliness({tenantId,propertyNode,
  reservationId,serviceProvisionSnapshotId,invoiceIssueSnapshotId,
  serviceProvisionDate,invoiceIssueDate,ordinaryRegimeSource,
  ordinaryRegimeEvidenceSha256})` accepts only an exact plain,
  accessor/proxy/symbol-free input;
- the only accepted regime is exact externally governed
  `ordinary_rule47_30_day`, source
  `governed_rule47_ordinary_regime_record`, and legal rule
  `CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT`; no regime is inferred from
  SAC, GSTIN, taxpayer/property identity, timestamps, or absence of an exception;
- re-resolve and rehash complete approved Order290 and Order292 lineage, require
  exact full-attribution amount/currency/identity coherence, then compute
  `deadlineDate = serviceProvisionDate + 30 calendar days` using date-only
  semantics; day 30 is `timely`, day 31 is `late`;
- return fixed-order recursively frozen evidence containing the two dates,
  deadline, exact regime/source/legal literals, result, complete attribution and
  deterministic tenant-bound hash while omitting tenant from public disclosure;
- missing, malformed, duplicate, stale, unsupported, exception-bearing,
  cross-lineage, ambiguous or contradictory evidence fails closed; no current
  clock, timezone conversion, latest/nearest, fallback or implicit policy;
- the composer consumes exact approved Order290/292 evidence but does not derive,
  rewrite or substitute either date.

## Forbidden and proof boundary

No Rule47 regime selection beyond the explicit ordinary evidence, legal
validity/numbering, invoice issuance/rendering,
payment allocation, section13 result, tax/levy/rate/amount, posting, document,
IRP/submission, API/UI/local authority, or Phase/application-complete claim. No
reservation, room-night, checkout, business-day, payment/provider, journal/posting,
generic-document or clock timestamp substitution. Fresh non-implementing Tier-3
review and pure boundary/hostile matrix proof are mandatory.

Financial-institution/NBFC, distinct-person, continuous-supply, reverse-charge,
exempt/composition, low-value, receipt/refund voucher, revised/credit/debit/
consolidated invoice, partial/excess-attribution and every other exception regime
must fail closed rather than produce `timely` or `late`.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact pure input/output and hostile fail-closed proof is green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
