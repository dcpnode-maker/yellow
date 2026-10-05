# Order 339 — India GST section 14 governed payment-receipt date

**Status:** APPROVED-D953
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
- **P2 complete replay:** any supplied date/proviso/calendar result mutation without
  the corresponding complete input ancestry fails even if a public hash is recomputed;
  pair-input mutations continue to fail under Order307's governed statutory contract.
- **P3 calendar containment:** calendar must include bank date and establish the exact
  fourth working date; off-by-one, missing and unrelated windows fail.
- **P4 evidence/containment:** recursively frozen, deterministic, tenant-hidden,
  tenant/predecessor-bound output contains no rate, amount, matrix or downstream state.
- **P5 preservation:** focused/adjacent/standing/static gates remain green with no
  database or retained runtime change.

## Definition of done

- [x] Intentional red precedes production.
- [x] Exact boundary, replay and hostile proof passes.
- [x] Standing/static preservation gates pass.
- [x] Fresh non-implementing Tier3 reviewer personally executes proof and approves.

## Built evidence

- Intentional red failed `0/1` before the production composer/export existed.
- Focused Orders302/307/338/339 pass `27/0` with 235 assertions; permanent Order339
  passes `7/0` with 46 assertions across first/fourth/strictly-after boundaries,
  ordinary earlier-of directions, missing bank coverage, exact predecessor replay,
  hostile shapes, recursive freeze and complete tenant/predecessor hashing.
- Standing passes `1169/0` with 890 expected database skips, 17,686 assertions and
  2,059 tests across 380 files. Typecheck, 130-file boundaries, 23-package licence
  policy, zero-vulnerability audit and diff hygiene are green.
- No migration/schema/seed/query/writer/database/runtime/local artifact changed.
  Fresh independent Tier3 executable review remains mandatory.

## Fresh independent Tier3 review — D951

- **WITHHOLD** exact candidate `ea190dd` on permanent-proof sensitivity only. Source
  and statutory semantics have no product finding: official CGST Act section14 says
  ordinary receipt is books/bank earlier-of and substitutes bank only when credit is
  after four working days; production uses strict `>` with governed coverage.
- Reviewer mutants for `>=`,always-bank,always-earlier,missing bank coverage,ignored
  Order307/302/338 supplied-result replay and omitted tenant final-hash binding all
  fail. Full ancestry,freeze,insertion-byte replay,scope and containment pass.
- One non-equivalent mutant replacing returned `calendarSourceDigestSha256` with an
  unrelated constant survives. The permanent proof recomputes the final hash over
  the mutant's own body but never asserts that returned calendar authority/source
  equal the rederived Order338 evidence. Permanently bind both returned source fields
  to `workingDayEvidence`/calendar input and kill this mutant.
- Removing the explicit calendar-required-state guard also survives because the
  current negative case is rejected independently by missing coverage; under valid
  Order302+338 ancestry the coverage invariant makes this guard behaviorally
  redundant. Add an explicit structural/source assertion pinning the required guard,
  or document/prove the redundancy without weakening the contract.
- Personal focused Orders302/307/338/339 pass26/0(233);standing1169/0 plus890
  expected skips(17686;2059 tests/380 files),typecheck,130 boundaries,23 licences,
  audit0,ancestry/scope/diff pass. No repository product/test or runtime/data surface
  was changed.

## Permanent-proof repair — D952

- The permanent result proof now exact-binds returned `calendarAuthorityId` and
  `calendarSourceDigestSha256` independently to both the admitted governed calendar
  input and the completely rederived Order338 result. A returned-source substitution
  can no longer hide behind a self-consistent recomputed final hash.
- A dedicated source-structural assertion pins the explicit
  `working_day_calendar_required` guard and exact failure boundary. This is necessary
  because valid Order338 calendars start after the rate-change date, so their required
  bank-date coverage independently implies Order302's calendar-required branch; the
  structural proof preserves the deliberately redundant fail-closed guard.
- Focused Orders302/307/338/339 pass `27/0` with 240 assertions. Standing passes
  `1170/0` with 890 expected database skips, 17,693 assertions and 2,060 tests across
  380 files. Typecheck, 130-file boundaries, 23-package licence policy and
  zero-vulnerability audit pass. No product, database, runtime or local artifact
  changed. A different fresh non-implementing Tier3 rereviewer remains mandatory.

## Different fresh independent Tier3 rereview — D953

- **APPROVED** exact repaired head `26682ab` (implementation `ea190dd`, approved base
  `3f91134`) with no finding by `/root/order339_fresh_rereview_d952`.
- Official CBIC CGST Act section14 confirms ordinary books/bank earlier-of and bank
  substitution only when credit is strictly after four working days.
- Disposable source mutants replacing returned calendar authority/source and removing
  the explicit calendar-required guard both fail permanent proof. Independent mutants
  for `>=`, always-bank, always-earlier, missing coverage, omitted Order338 replay and
  tenant-free final hashing also fail.
- Personal focused `27/0` (240), standing `1170/0` plus 890 expected skips (17,693;
  2,060 tests/380 files), typecheck, 130 boundaries, 23 licences, audit0, ancestry,
  scope and diff hygiene pass. `.yellow`, port3000, containers, DB/data, credentials
  and local runtime were untouched. Approval grants no downstream authority.
