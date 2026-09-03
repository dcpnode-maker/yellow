# Order 403 — Order400 calendar ancestry binding repair

**Status:** ACTIVE-D1182
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-quoted-rate-applicability-evidence`
**Base:** exact Order402 red working state after `64efa50`
**Risk tier:** 3 — statutory Section14/calendar ancestry
**Owner:** Codex implementation; fresh non-implementing Tier-3 reviewer

## Outcome

Repair the D1181 executable defect without adding authority or trusting a caller
digest. Migration0069's owner capability must cryptographically rederive the complete
approved Section14 evidence hash from persisted statutory predecessors and typed
calendar evidence, including authority, source digest, dense classified dates and
governed payment derivation, then require exact equality with the Order341 predecessor
hash already embedded in the current final valuation's evidence chain.

## Exact implementation scope

- `migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql` for the
  bounded capability-only ancestry repair; the three-table model remains fixed;
- `tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts`
  for D1181 and mutation-sensitive Section14/calendar proof;
- migration0069 checksum entries in `tests/migrate.integration.test.ts` and
  `tests/database-acceptance.integration.test.ts` only after SQL is final;
- normalized `tests/schema/expected.sql` only if the official PG16 dump changes;
- this order, Orders400–402 status, its review, `DECISIONS.log`, and
  `handoff/LEDGER.md`.

The capability signature, recorder, three tables and catalogue counts stay unchanged
unless executable proof demonstrates they cannot support the repair; any such change
requires a recorded scope correction first. Pure predecessor implementation/tests,
setup, API/UI/local and all unrelated files are byte-frozen.

## Required proof

D1181 red-to-green; mutation of each calendar authority/source/date/state/through-date
and every reconstructed Section14 predecessor hash fails before writes; ordinary and
calendar-governed happy paths remain exact; Order402's remaining hostility completes;
fresh PG16.15 migration/catalogue/schema/acceptance/runtime/referee/standing/static
gates; and fresh non-implementing Tier-3 review.

## Forbidden

No new table, permission, caller-trusted hash, proof waiver, final-tax/API/UI/local
change, deploy, merge or push. Orders400/402 remain unapproved and Order367 paused
until Order403 plus the resumed Order402 proof are independently approved.
