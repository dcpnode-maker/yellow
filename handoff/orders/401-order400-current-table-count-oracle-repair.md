# Order 401 — Order400 current table-count oracle repair

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D1187
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-quoted-rate-applicability-evidence`
**Base:** exact reviewed Order400 candidate `417c84d` plus withholding governance `62ece4a`
**Risk tier:** 3 — mandatory migration/schema proof repair for statutory persistence
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair exactly the two stale pre-Order400 public-table assertions independently
reproduced under D1176. The authoritative migration0069/schema frontier contains
119 public tables, not 116. No product, migration, schema snapshot, setup, runtime or
authority semantics may change.

## Exact implementation scope

- `tests/setup-current-catalogue-oracle.test.ts`: change only the derived
  `publicBaseTables` expected value from 116 to 119;
- `tests/migrate.integration.test.ts`: change only the live public table count from
  116 to 119;
- this order, its fresh review, `DECISIONS.log`, and `handoff/LEDGER.md`.

## Required proof

Exact two-token product-test diff; both D1176 reds green; Order400 focused and
migration/catalogue/schema/acceptance/runtime/referee proof on fresh PostgreSQL
16.15; standing/static gates; and a different fresh Tier-3 reviewer.

## Forbidden

No production source, migration, schema snapshot, setup script, role, permission,
seed, API/UI/local, deploy, merge, push, Order400 approval or Order367 resumption
until the different reviewer personally approves the repaired candidate.
