# Order 307 — India GST accommodation rate-change date evidence

**Status:** READY-D845
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-accommodation-rate-change-date`
**Base:** `2c1edcc` (independently approved Order 306 governance head)
**Risk tier:** 3 — statutory rate-change date evidence; fresh independent executable
review mandatory

## Outcome

Derive the authoritative India lodging rate-change date `2025-09-22` from the exact
approved Order304/305 predecessor/successor evidence. The pure result binds the
official Notification15/2025 source and pair evidence without accepting a caller
date, clock, timezone, calendar, “latest” selection or tax conclusion.

## Exact contract

- Accept one exact `IndiaGstAccommodationRateVersionPairResult` only.
- Revalidate the complete deterministic ids, v1-retired/v2-active identity,
  Kolkata-midnight adjacent periods, unchanged upper band, 12%-ITC to 5%-no-ITC
  lower-band transition, thresholds, nil-band absence and official source hashes.
- Require cutover instant `2025-09-21T18:30:00.000000Z` and derive, never accept,
  statutory rate-change date `2025-09-22` from the source-bound transition.
- Return recursively frozen evidence containing the exact predecessor/successor
  identities, cutover instant, rate-change date, Notification15 source hash, pair
  evidence hash and deterministic evidence hash.
- The output is evidence only. It does not decide section14 applicability or count
  working days.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap;
- one pure tax-fiscal module and exact context exports;
- intentional-red and permanent mutation-sensitive unit proof;
- bounded contract/domain/security/QA documentation;
- fresh independent Tier-3 review evidence.

## Forbidden boundary

No SQL/database/migration/schema/RLS/grant/seed/writer or installed-data change; no
property/timezone/date arithmetic, clock, caller date or rate-version selection; no
working-day/weekend/holiday calendar, section14 matrix, rate application, tax/GST
decomposition, posting, correction, fiscal document, IRP, API/UI, local promotion,
merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** the governed rate-change date builder/export is absent.
- **P1 exact derivation:** the exact pair yields only 2025-09-22 and the exact
  Kolkata cutover/source/pair evidence.
- **P2 hostility:** ids, versions, statuses, periods, rates, threshold, ITC, nil
  bands, source hashes, pair hash and surplus caller date/clock/calendar fields fail.
- **P3 evidence:** output is recursively frozen, byte-stable and its hash changes for
  every legally relevant accepted predecessor field.
- **P4 preservation:** no SQL/write exists; standing/static/setup/schema/referee stay
  green.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Focused mutation-sensitive proof is green.
- [ ] Standing/static/setup/schema/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.
