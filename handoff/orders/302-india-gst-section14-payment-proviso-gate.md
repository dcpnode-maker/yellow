# Order 302 — India GST section 14 payment-proviso fail-closed primitive

**Status:** APPROVED-D832
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-section14-payment-proviso-gate`
**Base:** `5c4414a` (independently approved Order 301)
**Risk tier:** 3 — statutory payment-date proviso primitive; fresh independent executable review mandatory

## Outcome

Build one migration-free pure primitive that classifies whether CGST Act section 14's
bank-credit proviso can safely retain the ordinary Explanation payment-receipt date or
must stop for governed four-working-day calendar evidence. It is not section 14
applicability authority and does not implement the six-case old/new-rate matrix.

## Fixed contract

- exact input is `supplierBooksEntryDate`, `supplierBankCreditDate` and an explicitly
  asserted `rateChangeDate`, each a canonical civil date;
- if bank credit is on or before the asserted rate-change date, the proviso cannot be
  triggered and the frozen result may retain the ordinary earlier-of-books/bank date;
- if bank credit is after the asserted rate-change date, return a frozen
  `working_day_calendar_required` result with no statutory payment-receipt date and no
  inferred elapsed-working-day count;
- equality is in the safe branch; malformed dates, extra/missing keys and unsupported
  values fail closed;
- deterministic fixed-order evidence is SHA-256 bound and recursively frozen;
- no JavaScript `Date`, weekday/weekend/holiday guess, property timezone, clock,
  database, network or mutation participates.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and bounded Phase-7 plan/roadmap text;
- new `src/contexts/tax-fiscal/india-gst-section14-payment-proviso.ts`;
- value/type/error exports only in `src/contexts/tax-fiscal/index.ts`;
- focused intentional-red and permanent pure hostile tests;
- bounded contract/domain/security documentation.

## Forbidden boundary

No migration/schema/query/writer/RLS/grant/seed/API/UI/local promotion; no governed
rate-change event or calendar source; no claim that the asserted date establishes
section 14 applicability; no old/new extension pairing, four-working-day calculation,
six-case section 14 time-of-supply matrix, rate/levy/tax/decomposition, posting,
document, IRP, merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** no production primitive exists before the intentional-red proof.
- **P1 exact branches:** bank before/equal boundary returns ordinary earlier-of date;
  bank one or many days after returns only calendar-required.
- **P2 hostile dates/shapes:** invalid civil dates, noncanonical forms, missing/extra
  keys and prototype tricks reject.
- **P3 no guessed calendar:** weekend/weekday/holiday-shaped examples after the change
  are indistinguishable and always calendar-required; source contains no `Date` or
  weekday/holiday calculation.
- **P4 evidence:** each input independently changes the deterministic evidence hash;
  output and nested evidence are frozen.
- **P5 preservation:** focused/standing/static/setup/referee gates remain green and no
  migration, schema, database or retained local changes.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Focused hostile and mutation-sensitive proof is green.
- [x] Standing/static/setup/referee preservation gates are green.
- [x] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Built evidence

- Intentional red failed `0/1` before the production module/export existed.
- Focused permanent plus historical-red proof passes `6/0` with 49 assertions. It
  covers before/equal safe branches, every later-credit calendar-required branch,
  books-before-bank hostility, exact shapes, invalid civil dates, accessors, proxies,
  symbols, recursive freezing, deterministic replay and independent three-input hash
  sensitivity. The source proof rejects clocks and guessed calendar vocabulary.
- Standing passes `1067/0` with 883 expected database skips, 16,144 assertions and
  1,950 tests across 348 files. Typecheck, 121-file boundaries, 23-package licence
  policy, zero-vulnerability audit and diff hygiene are green.
- A fresh disposable PostgreSQL 16 proof applies the unchanged 59 migrations, loads
  110 public tables and passes referee `11/11`; the exact proof containers, network
  and volume were removed. Order302 adds no migration or retained local runtime.
- Fresh non-implementing Tier-3 reviewer `/root/order302_fresh_review` approves exact
  candidate `1d0e8f94417f13368b6ec6c2f676b27e5b75dbc0` under D-832 after personally
  proving the bank-after guard mutation red, standing/static preservation, isolated
  59-migration/110-table truth and referee `11/11`; isolated resources were removed.
