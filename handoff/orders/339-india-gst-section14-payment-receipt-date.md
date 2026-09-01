# Order 339 — India GST section 14 governed payment-receipt date

**Status:** READY-D949
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-section14-payment-receipt-date`
**Base:** `3f91134` (independently approved Order338 governance head)
**Risk tier:** 3 — statutory payment-date conclusion; fresh independent executable review mandatory

## Outcome

Compose approved Orders302, 307 and 338 into the one statutory payment-receipt-date
conclusion needed when bank credit is after the rate-change date. This order decides
only whether the ordinary earlier-of-books/bank date survives or the Section 14
four-working-day proviso substitutes the bank-credit date.

## Exact contract

- Accept exactly `tenantId`, complete Order307 pair input and supplied result,
  `supplierBooksEntryDate`, `supplierBankCreditDate`, supplied Order302 result,
  Order338 `throughDate`/calendar input and supplied result.
- Rerun Orders307, 302 and 338 and require insertion-byte equality for every supplied
  predecessor rather than trusting public hashes.
- Require Order302's `working_day_calendar_required` branch and a governed calendar
  window that contains the bank-credit date and establishes the fourth working day.
- If bank credit is strictly after the fourth working-day date, return bank credit as
  `paymentReceiptDate`; otherwise retain the ordinary earlier of books and bank.
- Return the exact branch, dates, legal rule and predecessor hashes as a recursively
  frozen tenant-hidden, tenant-bound result.

## Scope

- this order plus bounded decisions/roadmap/plan/ledger and contract/domain/security docs;
- new `src/contexts/tax-fiscal/india-gst-section14-payment-receipt-date.ts`;
- value/type/error exports in `src/contexts/tax-fiscal/index.ts`;
- focused intentional-red and permanent hostile/mutation-sensitive tests.

## Forbidden boundary

No migration/schema/query/writer/RLS/grant/seed/calendar ingestion/network/API/UI/local
operation; no Section14 applicability or six-case old/new-rate time-of-supply matrix;
no stay splitting, taxable value, component amount, rounding, posting, correction,
fiscal document, IRP, merge, deploy, Phase-complete or application-complete claim.

## Pre-registered proof

- **P0 intentional red:** no production composer/export exists.
- **P1 statutory boundary:** bank on/before fourth working date retains ordinary
  earlier-of; bank one civil day after substitutes bank date.
- **P2 complete replay:** any coherent mutation of pair/date/proviso/calendar evidence
  fails even if a public hash is recomputed.
- **P3 calendar containment:** calendar must include bank date and establish the exact
  fourth working date; off-by-one, missing and unrelated windows fail.
- **P4 evidence/containment:** recursively frozen, deterministic, tenant-hidden,
  tenant/predecessor-bound output contains no rate, amount, matrix or downstream state.
- **P5 preservation:** focused/adjacent/standing/static gates remain green with no
  database or retained runtime change.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Exact boundary, replay and hostile proof passes.
- [ ] Standing/static preservation gates pass.
- [ ] Fresh non-implementing Tier3 reviewer personally executes proof and approves.
