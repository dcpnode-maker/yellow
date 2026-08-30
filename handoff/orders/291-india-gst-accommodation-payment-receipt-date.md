# Order 291 — Build exact India GST accommodation payment-receipt-date evidence

**Status:** BUILT-PENDING-REVIEW-D772
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-payment-receipt-date`
**Base:** `31dd963` (independently approved Order290 descendant)
**Risk tier:** 3 — statutory payment-date evidence, migration and forced RLS;
fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one tenant-leading, forced-RLS, SELECT-only source root and exact resolver for
an externally evidenced full-coverage accommodation `paymentReceiptDate`, bound to
the exact approved Order290 service-provision root and its complete Order252/240
reservation/room-revenue lineage. Preserve the two statutory source dates and their
earlier date as frozen deterministic input evidence for a later CGST section 13
time-of-supply composer. This order neither ingests payment events nor decides time
of supply.

## Natural-Solution Test

CGST Act section 13(2)(a) and (b) both compare another date with the date of receipt
of payment. Its explanation defines receipt as the earlier of entry in the supplier's
books and credit to the supplier's bank account. Yellow currently stores payment,
operation, provider-receipt and journal creation/business timestamps, but none is
both statutory operands and none is bound to exact Order290/252/240 service truth.
Relabelling any such timestamp would fabricate legal evidence. Payment receipt is a
smaller independent prerequisite than fiscal invoice issuance because it participates
in both section 13 branches without deciding invoice timeliness. Partial/excess/cash/
refund allocation requires separate product policy; this first slice fails closed
unless one externally governed record covers the full canonical attribution amount.

## Exact contract

- migration `0057_india_gst_accommodation_payment_receipt_date.sql` adds only
  `india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,
  service_provision_snapshot_id,currency,amount_minor,coverage_scope,
  supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,
  payment_receipt_source,payment_receipt_evidence_sha256,legal_rule)`;
- tenant-leading identity and exact `(tenant_id,service_provision_snapshot_id)` FK to
  Order290 prevent duplicate property/reservation truth. One tenant/service root may
  have exactly one admitted full-attribution receipt snapshot;
- `amount_minor` is positive and must equal the reparsed canonical Order240 attribution
  grand total; currency must equal complete Order290/252/240 lineage currency;
- exact `coverage_scope='full_attribution'`; finite source/result dates; database check
  `payment_receipt_date = LEAST(supplier_books_entry_date,
  supplier_bank_credit_date)`; exact source
  `governed_supplier_payment_receipt_record`; exact legal literal
  `CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY`; lowercase SHA-256;
- forced RLS and `app_role` SELECT only; no app/runtime writer, ingestion command,
  bank/provider lookup or attestation policy is admitted;
- `resolveIndiaGstAccommodationPaymentReceiptDate({tenantId,propertyNode,
  reservationId,serviceProvisionSnapshotId,paymentReceiptSnapshotId,
  paymentReceiptDate})` accepts only an exact plain accessor/proxy/symbol-free six-key
  input, independently revalidates complete Order290→252→240 truth, reparses canonical
  `rate_quote` room/room-revenue attribution, equality-selects only the requested
  receipt root id/date and verifies both statutory source dates, full amount/currency,
  source/evidence/legal rule;
- return fixed-order recursively frozen minimized service lineage, both statutory
  source dates, exact receipt date, full covered amount/currency/source/evidence/legal
  rule and deterministic tenant-bound evidence hash while tenant remains unexposed;
- missing, duplicate, malformed, mixed-lineage or stale-hash evidence fails closed.

## Exact scope

- new `migrations/0057_india_gst_accommodation_payment_receipt_date.sql`;
- `tests/schema/expected.sql`, `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts` only for exact schema/ACL counts;
- `tests/migrate.integration.test.ts` only for exact post-0057 ledger/discovered/
  applied-file and catalogue expectations: 57 migrations, 109 public tables,
  99 RLS tenant tables, 99 policies and 9 FORCE-RLS tables, plus exact checksum;
- `setup.sh` only for public table count 108→109 and migrations 1-56→1-57;
- new `src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date.ts`
  and bounded-context index export only;
- new intentional-red and exact hostile/live integration tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`, this order,
  decisions, ledger and later independent review evidence.

## Forbidden

No writer/ingestion, API/UI/local promotion, network/live bank/provider lookup,
latest/nearest/clock, operator identity or source-attestation workflow. No inference
from `payment.created_at`, `payment_operation.created_at`,
`provider_event_receipt.received_at`, payment phase/reference, settlement, folio,
journal/posting/business-day dates, generic `document` fields, reservation or
operational dates. No one-source-only, partial, excess, cash, deposit allocation,
refund, reversal, void or failed-payment semantics. No invoice/document/receipt-
voucher issuance, due date, timing-regime or timely/late determination; no section13
earliest-date result, section13(2)(c), reverse charge, section14 change-in-rate,
Order289 consumption, effective GST/LoA status, zero rating/refund, levy/rate/amount
decomposition, `SupTyp`/`IgstOnIntra`, item, posting, correction, IRP/submission,
provider, merge/deploy/Phase7/application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/table/source/export are absent.
2. Exact checksum, schema mirror, acceptance manifest, `57/109/99/99/9` catalogue,
   SELECT-only ACL, forced RLS and referee `11/11` are green.
3. Golden explicit books-entry and bank-credit dates resolve to their earlier exact
   date through complete Order290/252/240 lineage with full amount/currency equality.
4. Equal source dates are accepted; source-date order in either direction produces
   only the statutory earlier date.
5. Missing/duplicate/date/id/hash/source/legal/currency/amount/coverage/shape defects
   fail closed; one-source-only and non-full coverage are rejected.
6. Tenant/property/reservation/service/lineage/attribution/hash mixtures reveal no
   row and write nothing; attribution snapshot hostility rejects.
7. Non-substitution canaries prove payment/operation/provider-receipt/journal/document/
   folio/reservation/operational timestamps and clocks are unused.
8. App-role INSERT/UPDATE/DELETE/TRUNCATE are denied; tenant isolation, replay,
   recursive freeze, canonical hash and complete zero-effect truth are executable.
9. Focused/adjacent/database/migration/schema/setup/referee/standing/static gates and
   fresh non-implementing Tier-3 review are green; stable local remains unchanged.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/RLS/ACL and hostile lineage/non-substitution proof is green.
- [x] Standing/static/referee gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
