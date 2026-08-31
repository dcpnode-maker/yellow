# Order 301 — Property-day extension containment

**Status:** APPROVED-D829
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/property-day-extension-containment`
**Base:** `e352a91` (independently approved Order 300)
**Risk tier:** 3 — statutory effective-date and tenant-scoped tax applicability

## Outcome

Require the exact already-selected visible tax-jurisdiction extension period to contain
the caller's complete PostgreSQL-derived property-local business-day interval before a
resolved jurisdiction may be returned. Correct only the explicit India 2026 test
fixture temporal lower bound to Kolkata civil midnight. This closes the deliberately
deferred Order 299/300 applicability gap; it does not implement CGST Act section 14.

## Fixed contract

- both intervals are canonical half-open UTC intervals: extension `[effectiveFrom,
  effectiveTo)` and property day `[businessDayFrom,businessDayTo)`;
- containment succeeds exactly when the lower extension bound is absent or no later
  than the day start, and its upper bound is absent or no earlier than the day end;
- equality at either edge is valid; a one-microsecond partial edge, any-overlap,
  start-only containment, no-overlap and malformed/non-increasing truth fail closed;
- unassigned results do not read an extension period and remain unchanged;
- the India `in-gst-lodging` fixture's explicit 2026 civil-date temporal lower bound is
  `2025-12-31T18:30:00Z`, the UTC instant for 2026-01-01 00:00 Asia/Kolkata;
- no server clock, JavaScript date/timezone conversion, fixed 24-hour arithmetic,
  implicit session timezone or caller-supplied instant participates.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap entries;
- `src/contexts/tax-fiscal/resolution.ts` only;
- `tests/seed_fixture.sql`, new Order301 intentional-red proof, and bounded additions to
  `tests/tax-jurisdiction-effective-period.test.ts` and
  `tests/tax-jurisdiction-resolution.integration.test.ts`;
- bounded `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, and
  `docs/EXTENSIONS.md` containment/effective-date text.

## Forbidden boundary

No migration/schema/function/RLS/grant/table/index/new registry capability or writer;
no version selection by date/clock, old/new extension pair, multiple-version resolver,
partial-day split or allocation; no CGST section 14 composer, working-day calendar,
rate evaluation/change, levy/decomposition, SEZ zero-rating, quote/reservation/folio/
posting/correction/document/IRP/API/UI/local promotion, merge/deploy or Phase/application-
complete claim. Do not alter `migrations/0001_init.sql`, production seed rate content or
any non-India fixture.

## Pre-registered proof

- **P0 red:** a selected extension that starts after the property day begins currently
  resolves; the permanent proof must fail before implementation.
- **P1 exact containment:** both equal edges and lower/upper/full unbounded periods pass;
  one-microsecond lower/upper truncation, lower/upper overlap, midday end and disjoint
  periods fail closed.
- **P2 temporal diversity:** UTC, Kolkata, New York 23/25-hour days and Kathmandu prove
  the predicate consumes exact Order300 bounds without fixed-duration math.
- **P3 India fixture:** exact explicit Kolkata-midnight lower instant passes, while the
  prior UTC-midnight lower instant fails for the 2026-01-01 Kolkata day.
- **P4 evidence/identity:** selected identity and both interval bounds remain revalidated
  and hash-bound; foreign/malformed/changing truth fails without partial output.
- **P5 tenant/zero effect:** unassigned skips registry-period reads; tenant concealment
  and zero extension, assignment, fact/outbox, financial, document or fiscal writes hold.
- **P6 preservation:** standing/static checks, unchanged 59 migrations/110 tables,
  setup and referee `11/11` remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact whole-day containment, India fixture and hostile temporal proof are green.
- [x] Standing/static/setup/referee preservation gates are green.
- [x] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Built evidence

- Intentional red failed `0/1` before production contained either interval.
- The resolver adds one pure fail-closed whole-day predicate after both approved
  envelopes are normalized and before jurisdiction evidence is constructed. Separate
  lower-bound and upper-bound removal mutants each make permanent proof red.
- Focused pure proof passes `15/0` with 6 expected database skips. Required live
  PostgreSQL proof passes `21/0` with 123 assertions, including explicit Kolkata
  legacy-UTC rejection, exact local-midnight acceptance, UTC, New York 23/25-hour
  dates, Kathmandu, tenant concealment, stable frozen evidence and zero writes.
- The exact India test fixture now stores `2025-12-31T18:30:00Z` as the extension
  temporal lower instant; rates and every non-India fixture remain unchanged.
- Standing passes `1061/0` with 883 expected database skips, 16,095 assertions and
  1,944 tests across 346 files. Typecheck, 120-file boundaries, 23-package licence
  policy, dependency audit and whitespace are green.
- Fresh isolated setup applies 59 migrations, preserves 110 public tables and referee
  `11/11`. Order301 adds no migration, schema or retained app instance.
- Fresh non-implementing Tier-3 review remains mandatory.
