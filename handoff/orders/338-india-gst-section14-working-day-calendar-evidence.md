# Order 338 — India GST section 14 governed working-day calendar evidence

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D947
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-section14-working-day-calendar-evidence`
**Base:** `9fd55d8` (independently approved Order337 governance head)
**Risk tier:** 3 — statutory working-day evidence; fresh independent executable review mandatory

## Outcome

Close Order302's explicit calendar-evidence gap with one pure, migration-free boundary
that validates a complete, explicitly governed civil-day sequence and derives the
fourth working day after an asserted rate-change date. This order supplies evidence
only; it does not decide the section14 payment proviso or old/new rate matrix.

## Exact contract

- Accept exactly `tenantId`, `rateChangeDate`, `throughDate`, and `calendarEvidence`.
- `calendarEvidence` contains an exact jurisdiction `IN`, authority identity, immutable
  64-hex source digest, and a dense ordered day sequence beginning the civil day after
  `rateChangeDate` and ending at `throughDate`.
- Every day is explicitly classified `working` or `non_working`; no weekday, weekend,
  holiday, locale, timezone, host clock, or JavaScript `Date` inference is allowed.
- Require at least four explicitly classified working days and return their first four
  dates plus `fourthWorkingDayDate`, source lineage, and a tenant-bound deterministic
  evidence hash. Duplicate, missing, non-contiguous, out-of-range, surplus, proxy,
  accessor, symbol, malformed, or mutable evidence fails closed.
- Output is recursively frozen and tenant-hidden.

## Scope

- this order, `DECISIONS.log`, `handoff/ROADMAP.md`, `BUILD-PLAN.md`, and
  `handoff/LEDGER.md`;
- new `src/contexts/tax-fiscal/india-gst-section14-working-day-calendar-evidence.ts`;
- value/type/error exports in `src/contexts/tax-fiscal/index.ts`;
- focused intentional-red and permanent hostile tests;
- bounded contract/domain/security documentation.

## Forbidden boundary

No migration/schema/query/writer/RLS/grant/seed/network/API/UI/local operation; no
calendar-authority ingestion or claim that Yellow authored the supplied classification;
no payment-date conclusion, section14 applicability, old/new rate selection, six-case
matrix, taxable value, tax amount, rounding, posting, fiscal document, IRP, merge,
deploy, Phase-complete or application-complete claim.

## Pre-registered proof

- **P0 intentional red:** the public export and production boundary do not exist.
- **P1 exact threshold:** four working dates are selected only from a contiguous,
  explicitly classified sequence; non-working dates never increment the count.
- **P2 hostile calendar:** omitted/duplicate/out-of-order/non-contiguous days, fewer
  than four working days, invalid dates, surplus fields, mutable graphs, accessors,
  proxies and symbols reject.
- **P3 no inference:** Saturday/Sunday-shaped dates can be either explicit state and
  production source contains no `Date`, weekday, weekend or holiday algorithm.
- **P4 evidence:** exact authority/source/day classifications are tenant-bound,
  deterministic, recursively frozen and tenant-hidden.
- **P5 preservation:** focused/adjacent/standing/static gates remain green; no database
  or retained runtime artifact changes.

## Definition of done

- [x] Intentional red precedes production.
- [x] Exact and hostile permanent proof passes.
- [x] Standing/static preservation gates pass.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Built evidence

- Intentional red failed `0/1` before the production module/export existed.
- Focused Order302/307/338 proof passes `21/0` with 191 assertions; the permanent
  Order338 proof passes `8/0` with 57 assertions and covers explicit weekend-shaped
  states, leap/non-leap-century/month/year boundaries, contiguous sequence hostility,
  exact fourth-date selection, bounds, recursive freeze and tenant/source hash binding.
- Standing passes `1162/0` with 890 expected database skips, 17,640 assertions and
  2,052 tests across 378 files. Typecheck, 129-file boundaries, 23-package licence
  policy, zero-vulnerability audit and diff hygiene are green.
- No migration, schema, seed, query, writer, database, container, credential or local
  runtime artifact changed. Fresh independent Tier3 executable review remains mandatory.
