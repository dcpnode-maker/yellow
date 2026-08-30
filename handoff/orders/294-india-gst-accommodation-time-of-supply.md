# Order 294 — Compose India GST accommodation time-of-supply evidence

**Branch:** `phase-7/india-gst-accommodation-time-of-supply`
**Base:** `809928f` (independently approved Order293 descendant)
**Risk tier:** 3 — statutory time-of-supply composer; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one migration-free, read-only, deterministic composer for the bounded ordinary
CGST section 13(2)(a)/(b) accommodation path. It consumes complete approved Order290
service-provision, Order291 payment-receipt and Order292 invoice-issue evidence, and
replays approved Order293 ordinary Rule47 timeliness inside one equality-bound read.

## Exact contract

- expose `resolveIndiaGstAccommodationTimeOfSupply(tx, input)` through the tax-fiscal
  boundary with the exact plain input keys `tenantId`, `propertyNode`, `reservationId`,
  `serviceProvisionSnapshotId`, `paymentReceiptSnapshotId`, `invoiceIssueSnapshotId`,
  `serviceProvisionDate`, `paymentReceiptDate`, `invoiceIssueDate`,
  `ordinaryRegimeSource`, `ordinaryRegimeEvidenceSha256`;
- one tenant-leading, transaction-local, equality-bound SELECT joins the approved
  service, payment, invoice, reservation-lineage and attribution roots; no sequential
  resolver calls, latest/nearest selection, clock, timezone conversion, network or write;
- revalidate complete Order290→252→240 lineage, canonical `rate_quote` / `room` /
  `room_revenue` full attribution, all predecessor source/legal/hash/identity fields,
  amount/currency equality, and Order291 payment-date invariant;
- replay Order293's inclusive 30-calendar-day boundary: timely uses the earlier of
  invoice issue and payment receipt under section13(2)(a); late uses the earlier of
  service provision and payment receipt under section13(2)(b); equal dates are valid;
- return a recursively frozen, fixed-order, deterministic, tenant-bound result that
  preserves all candidate dates, selected branch, selected time-of-supply date,
  predecessor identities and evidence hash without exposing tenant identity;
- missing, malformed, duplicate, stale, contradictory, unsupported or cross-lineage
  evidence fails closed.

## Scope

- `src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts`
- `src/contexts/tax-fiscal/index.ts`
- Order294 intentional-red, focused hostile and live integration tests
- bounded Order294 additions to `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`
- Order294 decision, ledger and independent review evidence

## Forbidden boundary

No migration/schema/writer/API/UI/local promotion. No section13(2)(c), section13(3),
foreign associated-enterprise, continuous/special supply, section14 change-in-rate,
Rule47 45-day/distinct-person exceptions, vouchers, partial/refund/reversal/void,
tax rate/levy/decomposition, invoice issuance/numbering, documents, journals/posting,
IRP/submission, Phase or application-complete claim.

## Definition of done

- [x] Intentional red precedes implementation.
- [ ] Focused hostile proof is green; live predecessor proof remains pending.
- [ ] Standing/static/setup/referee gates are green.
- [ ] Fresh independent Tier-3 approval is recorded.
