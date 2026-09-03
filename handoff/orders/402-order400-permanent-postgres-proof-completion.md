# Order 402 — Order400 permanent PostgreSQL proof completion

**Status:** ACTIVE-D1180
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-quoted-rate-applicability-evidence`
**Base:** exact reviewed repaired candidate `22182d6` plus withholding governance `64efa50`
**Risk tier:** 3 — statutory persistence executable proof
**Owner:** Codex implementation; fresh non-implementing Tier-3 reviewer

## Outcome

Close only the proof gaps independently identified under D1179. Repair four stale
migration-frontier assertions and make every Order400-required hostile path execute
against a freshly migrated PostgreSQL database rather than relying on source-string
or pure-predecessor assertions.

## Exact implementation scope

- `tests/migrate.integration.test.ts`: only the four D1179 frontier repairs:
  upgraded ledger length 68→69, discovered files 68→69, include version69 in the
  queried ledger, and the remaining public table count 116→119;
- `tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts`:
  permanent executable capability challenges for 366/367 bounds, governed calendar
  hostility, stale/foreign/forged selectors, dense gaps/duplicates, divergent replay,
  concurrent same-key arbitration, and `pg_temp` shadow containment;
- this order, its review, `DECISIONS.log`, and `handoff/LEDGER.md`.

Production source, migration0069, normalized schema, setup, pure predecessor tests
and all other files are byte-frozen. If an executable test exposes a production
defect, stop and record a separate scope decision before any product edit.

## Required proof

All four D1179 migration reds green; mutation-sensitive permanent PostgreSQL tests
for every named hostility; exact catalogue `69/119/109/109/18/2`; complete migration,
focused, acceptance, seed, runtime/app-role, schema, standing/static and referee11/11
gates on PostgreSQL16.15; and fresh non-implementing Tier-3 execution.

## Forbidden

No production/migration/schema/setup/authority/API/UI/local change, no proof waiver,
and no Order400 approval or Order367 resumption before fresh Tier-3 approval. No
deploy, merge or push authority.
