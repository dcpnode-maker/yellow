# Order 300 — Property-local business-day instant evidence

**Status:** CHANGES-REQUIRED-D824
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/property-local-business-day-instant-evidence`
**Base:** `0b90973` (independently approved Order 299)
**Risk tier:** 3 — tenant/property timezone and statutory temporal evidence

## Outcome

Bind the active same-tenant property's database-owned IANA timezone and the exact UTC
start/end instants of the caller's already-derived property-local business date into
Order 238's frozen tax-jurisdiction resolution evidence. PostgreSQL derives both
instants from local calendar midnights; no host clock, JavaScript timezone conversion,
fixed 24-hour assumption or extension-applicability decision is admitted.

## Fixed contract

- the input remains exact `propertyNode` plus already-derived property-local
  `YYYY-MM-DD` business date; callers cannot supply timezone or instants;
- the existing active-tenant property read returns its exact nonblank IANA timezone and
  PostgreSQL derives `[businessDate 00:00, next local calendar date 00:00)` as two UTC
  instants in the same tenant transaction and snapshot;
- canonical six-digit UTC instant strings preserve database truth; invalid timezone,
  impossible calendar date, missing/foreign/non-property/inactive truth or malformed
  returned values fail closed before partial evidence;
- resolved and unassigned results both bind `propertyTimezone`,
  `businessDayFromInstant` and `businessDayToInstant`; resolved evidence references bind
  the same property-day envelope alongside Order 299's extension bounds;
- DST gap/fold zones prove 23/25-hour local days, and awkward offsets prove no fixed
  offset or 24-hour arithmetic is used.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap entries;
- `src/contexts/tax-fiscal/resolution.ts` and existing tax-fiscal export surface only if
  its public types require it;
- new Order300 intentional-red proof and bounded additions to
  `tests/tax-jurisdiction-resolution.integration.test.ts` /
  `tests/tax-jurisdiction-effective-period.test.ts`;
- bounded `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` evidence text.

## Forbidden boundary

No migration/schema/function/RLS/grant/table/index/configuration write; no JavaScript
`Date` timezone derivation, server/process clock, caller timezone/instant, fixed-24-hour
math, latest-version selection or extension-period containment/overlap/start-instant/
split-day rule; no rate evaluation, section14, multi-night composition, SEZ zero-rating,
GST decomposition, quote/reservation/folio/posting/correction/document/IRP/API/UI/local
promotion, merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** permanent proof fails because property timezone/day-envelope evidence is absent.
- **P1 database time:** UTC/Kolkata and DST 23/25-hour local dates return exact canonical
  UTC bounds; an awkward offset proves no offset table or fixed arithmetic.
- **P2 tenant/property:** exact active same-tenant property is required; missing, foreign,
  non-property, inactive tenant and malformed stored timezone reveal no partial truth.
- **P3 input/result:** impossible/low-year/extra-key/caller-timezone inputs and malformed,
  non-increasing or changed database-returned evidence fail closed.
- **P4 evidence:** resolved/unassigned results are deeply frozen; repeated reads are
  stable; timezone or either bound changes the evidence reference.
- **P5 zero effect:** the complete read writes no extension, assignment, fact/outbox,
  financial, document or fiscal state.
- **P6 preservation:** Order299 exact extension bounds, standing/static/setup/referee and
  unchanged 59-migration/110-table schema remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact PostgreSQL-derived local-day evidence and DST/tenant hostile proof are green.
- [x] Standing/static/setup/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Built evidence

- Intentional red failed `0/1` before the property timezone/day evidence existed.
- Focused/adjacent proof passes `20/0` with 13 expected database skips; required live
  PostgreSQL proof passes `18/0` with 103 assertions, including UTC, Kolkata, New York
  23/25-hour DST dates and Kathmandu.
- Standing passes `1058/0` with 882 expected database skips, 16,069 assertions and
  1,940 tests across 345 files. Typecheck, 120-file boundaries, 23-package licence
  policy, dependency audit and whitespace checks are green.
- Fresh isolated setup preserves 59 migrations, 110 public tables and referee `11/11`.
  Order300 adds no schema or local product instance.
- D-822's proof gap is repaired: permanent assertions vary timezone, lower instant and
  upper instant independently and require both assignment and jurisdiction evidence
  references to change. The reviewer's exact upper-bound-removal mutant is red.
- D-824's fresh final rereview finds the executable product and mutation proof green,
  but the exact candidate fails `git diff --check` because the prior review file has a
  surplus blank line at EOF. Final DoD remains unchecked pending repair and rereview.
