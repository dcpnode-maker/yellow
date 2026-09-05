# Order 292 — Build exact India GST accommodation invoice-issue-date evidence

**Status:** APPROVED-D776
**Phase:** 7 — Tax engine and India IRP  
**Branch:** `phase-7/india-gst-accommodation-invoice-issue-date`  
**Base:** `1037f9d` (independently approved Order291 descendant)  
**Risk tier:** 3 — statutory invoice-date evidence, migration and forced RLS;
fresh independent executable review mandatory  
**Owner:** Codex implementation

## Outcome

Build one tenant-leading, forced-RLS, SELECT-only source root and exact resolver for
an externally evidenced, full-coverage accommodation tax-invoice issue date. Bind it
to the exact approved Order290 service-provision root and complete Order252/240
reservation/room-revenue truth. Preserve invoice identity and issue date only as
input evidence for later Rule47 timeliness and CGST section13 composition. This
order does not issue an invoice, decide timeliness or compute time of supply.

## Natural-Solution Test

CGST section13(2)(a) uses invoice issue date only when the invoice is issued within
the section31(2) prescribed period; section13(2)(b) instead uses provision of service
when it is not. Section31(2) requires the registered supplier to issue the service
invoice within the prescribed period. CBIC invoice rules require a financial-year-
unique consecutive serial and issue date, and set the ordinary service period at 30
days while preserving separate exceptions. Yellow has generic document, folio,
reservation, journal, payment and operational timestamps, but none proves the exact
supplier tax-invoice identity/date for the approved service root. Re-labelling them
would fabricate statutory evidence. This smallest slice therefore admits an
external full-attribution invoice record only; it deliberately leaves Rule47 regime
selection and timely/late composition to later orders.

## Exact contract

- migration `0058_india_gst_accommodation_invoice_issue_date.sql` adds only
  `india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,
  service_provision_snapshot_id,currency,amount_minor,coverage_scope,
  invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,
  invoice_issue_evidence_sha256,legal_rule)`;
- tenant-leading identity, exact `(tenant_id,service_provision_snapshot_id)` FK to
  Order290 and one full-attribution invoice snapshot per service root;
- non-empty bounded invoice series/serial; exact tenant series/serial identity is
  unique without deciding whether the external invoice is legally valid;
- positive amount equals reparsed canonical Order240 attribution grand total;
  currency equals complete Order290→252→240 lineage currency;
- exact `coverage_scope='full_attribution'`, finite issue date, exact source
  `governed_supplier_tax_invoice_record`, lowercase SHA-256, and exact legal literal
  `CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY`;
- forced RLS and `app_role` SELECT only; no app/runtime writer or ingestion command;
- `resolveIndiaGstAccommodationInvoiceIssueDate({tenantId,propertyNode,
  reservationId,serviceProvisionSnapshotId,invoiceIssueSnapshotId,
  invoiceIssueDate,invoiceSeries,invoiceSerial})` accepts only the exact plain
  accessor/proxy/symbol-free eight-key input, equality-selects every key, revalidates
  complete Order290→252→240 lineage and canonical rate-quote room/room-revenue
  attribution, and returns minimized recursively frozen tenant-bound evidence;
- missing, duplicate, malformed, mixed-lineage, non-full, stale-hash, amount/currency,
  source/legal or invoice-identity mismatch fails closed.

## Exact scope

- new migration `0058_india_gst_accommodation_invoice_issue_date.sql`;
- exact schema mirror, acceptance, migration/runtime-DML catalogue and `setup.sh`
  count updates to `58/110/100/100/10`;
- new bounded tax-fiscal resolver/module export and focused intentional-red,
  hostile, live RLS/ACL tests;
- contract/domain/security documentation and required build/roadmap/order/decision/
  ledger/review evidence only.

## Forbidden

No writer, ingestion, API/UI/local promotion, network lookup, source attestation,
clock/latest/nearest inference or generic `document` substitution. No derivation from
folio, journal, posting, reservation, check-in/out, business-day, payment/provider,
service-provision or room-night timestamps. No Rule47 regime/deadline or timely/late
decision; no section13 earliest-date result, section13(2)(c), reverse charge,
continuous supply, section14, credit/debit/revised/consolidated invoice, bill of
supply, receipt voucher, partial/excess allocation, invoice creation/numbering,
document rendering, IRP, Order289 consumption, tax/levy/rate/amount decomposition,
posting/submission, merge/deploy/Phase7/application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/table/source/export are absent.
2. Exact checksum/schema/ACL/catalogue `58/110/100/100/10`, setup and referee 11/11.
3. Golden exact series/serial/date resolves through complete Order290→252→240 full
   amount/currency lineage and returns frozen deterministic evidence.
4. Issue dates before, equal to and after service date are preserved as evidence only.
5. Shape/date/identity/source/hash/legal/coverage/amount/currency and mixed-lineage
   defects fail closed; generic document and operational timestamp canaries are unused.
6. App-role mutation is denied, tenant isolation and zero effects are executable.
7. Focused/database/migration/schema/setup/standing/static gates and a fresh
   non-implementing Tier-3 review are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/RLS/ACL and hostile lineage/non-substitution proof is green.
- [x] Standing/static/referee gates are green and no authority expands.
- [x] Fresh independent Tier-3 approval is recorded.
